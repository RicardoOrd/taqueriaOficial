const express = require('express');
const { db } = require('../db/database');
const { authMiddleware } = require('./middleware');

const router = express.Router();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// Helper para obtener fecha/hora actual en America/Hermosillo
// Nota: America/Hermosillo es fijo en MST (UTC-7) sin horario de verano.
function getHermosilloTime() {
  const date = new Date();
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const offset = -7; // UTC-7 para Hermosillo
  const hermosilloDate = new Date(utc + (3600000 * offset));
  return hermosilloDate.toISOString().replace('T', ' ').substring(0, 19);
}

// Helper asíncrono para obtener una orden completa con sus items
async function getFullOrder(db, orderId) {
  const orderRes = await db.execute({
    sql: 'SELECT * FROM orders WHERE id = ?',
    args: [orderId]
  });

  if (orderRes.rows.length === 0) return null;

  const itemsRes = await db.execute({
    sql: 'SELECT * FROM order_items WHERE order_id = ?',
    args: [orderId]
  });

  return { ...orderRes.rows[0], items: itemsRes.rows };
}

// GET /api/orders  (activas + últimas 20 cobradas)
router.get('/', authMiddleware, async (req, res) => {
  try {
    // ⚡ Optimización: Ejecutamos las 3 consultas principales de forma concurrente
    const [activeRes, recentRes, cancelledRes] = await Promise.all([
      db.execute("SELECT * FROM orders WHERE status = 'active' ORDER BY created_at DESC"),
      db.execute("SELECT * FROM orders WHERE status = 'paid' ORDER BY paid_at DESC LIMIT 20"),
      db.execute("SELECT * FROM orders WHERE status = 'cancelled' ORDER BY created_at DESC LIMIT 5")
    ]);

    const allOrders = [...activeRes.rows, ...recentRes.rows, ...cancelledRes.rows];

    // Obtenemos los items de todas las órdenes en paralelo usando Promise.all
    const withItems = await Promise.all(allOrders.map(async (o) => {
      const itemsRes = await db.execute({
        sql: 'SELECT * FROM order_items WHERE order_id = ?',
        args: [o.id]
      });
      return { ...o, items: itemsRes.rows };
    }));

    res.json(withItems);
  } catch (error) {
    console.error('Error GET /orders:', error);
    res.status(500).json({ error: 'Error al obtener comandas' });
  }
});

// GET /api/orders/report?date=YYYY-MM-DD
router.get('/report', authMiddleware, async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Falta el parámetro date' });

  try {
    const ordersRes = await db.execute({
      sql: `
        SELECT * FROM orders
        WHERE status = 'paid' AND date(paid_at) = ?
        ORDER BY paid_at DESC
      `,
      args: [date]
    });

    const orders = ordersRes.rows;

    const withItems = await Promise.all(orders.map(async (o) => {
      const itemsRes = await db.execute({
        sql: 'SELECT * FROM order_items WHERE order_id = ?',
        args: [o.id]
      });
      return { ...o, items: itemsRes.rows };
    }));

    // En Turso, los números pueden venir como BigInt o strings dependiendo del tipo, 
    // nos aseguramos de sumarlos como Float.
    const total = orders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    const count = orders.length;
    const avg = count ? total / count : 0;

    res.json({ date, orders: withItems, summary: { total, count, avg } });
  } catch (error) {
    console.error('Error GET /orders/report:', error);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
});

// POST /api/orders  (crear nueva)
router.post('/', authMiddleware, async (req, res) => {
  const { label, items } = req.body;
  const id = uid();
  const hermosilloTime = getHermosilloTime();

  try {
    const statements = [
      {
        sql: `INSERT INTO orders (id, label, status, created_at) VALUES (?, ?, 'active', ?)`,
        args: [id, label || 'Comanda', hermosilloTime]
      }
    ];

    if (Array.isArray(items) && items.length > 0) {
      items.forEach(i => {
        statements.push({
          sql: 'INSERT INTO order_items (order_id, product_id, name, price, qty, person_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [id, i.productId, i.name, i.price, i.qty, i.person_name || '', i.notes || '']
        });
      });
    }

    // Ejecutamos todo como una sola transacción atómica en la nube
    await db.batch(statements, 'write');

    const newOrder = await getFullOrder(db, id);
    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error POST /orders:', error);
    res.status(500).json({ error: 'Error al crear la comanda' });
  }
});

// PUT /api/orders/:id  (actualizar — items, label, status)
router.put('/:id', authMiddleware, async (req, res) => {
  const id = req.params.id;
  const { label, items, status, total, paid, change_amt } = req.body;
  const hermosilloTime = getHermosilloTime();

  try {
    const existingRes = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
    if (existingRes.rows.length === 0) return res.status(404).json({ error: 'Comanda no encontrada' });
    const existing = existingRes.rows[0];

    // Preparamos todas las sentencias SQL para enviarlas en un solo viaje
    const statements = [
      {
        sql: `
          UPDATE orders SET
            label      = COALESCE(?, label),
            status     = COALESCE(?, status),
            total      = COALESCE(?, total),
            paid       = COALESCE(?, paid),
            change_amt = COALESCE(?, change_amt),
            paid_at    = CASE WHEN ? = 'paid' AND paid_at IS NULL THEN ? ELSE paid_at END
          WHERE id = ?
        `,
        args: [
          label || null,
          status || null,
          total != null ? total : null,
          paid != null ? paid : null,
          change_amt != null ? change_amt : null,
          status || existing.status,
          hermosilloTime,
          id
        ]
      }
    ];

    if (Array.isArray(items)) {
      statements.push({
        sql: 'DELETE FROM order_items WHERE order_id = ?',
        args: [id]
      });

      if (items.length > 0) {
        items.forEach(i => {
          statements.push({
            sql: 'INSERT INTO order_items (order_id, product_id, name, price, qty, person_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            args: [id, i.productId, i.name, i.price, i.qty, i.person_name || '', i.notes || '']
          });
        });
      }
    }

    await db.batch(statements, 'write');

    const updatedOrder = await getFullOrder(db, id);
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error PUT /orders/:id:', error);
    res.status(500).json({ error: 'Error al actualizar comanda' });
  }
});

// DELETE /api/orders/:id  (cancelar)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.execute({
      sql: "UPDATE orders SET status = 'cancelled' WHERE id = ?",
      args: [req.params.id]
    });

    if (result.rowsAffected === 0) return res.status(404).json({ error: 'Comanda no encontrada' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error DELETE /orders/:id:', error);
    res.status(500).json({ error: 'Error al cancelar comanda' });
  }
});

module.exports = router;