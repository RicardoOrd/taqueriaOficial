const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('./middleware');

const router = express.Router();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// Helper para obtener una orden completa con sus items
function getFullOrder(db, orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  return { ...order, items };
}

// GET /api/orders  (activas + últimas 20 cobradas)
router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const active    = db.prepare("SELECT * FROM orders WHERE status = 'active' ORDER BY created_at DESC").all();
  const recent    = db.prepare("SELECT * FROM orders WHERE status = 'paid' ORDER BY paid_at DESC LIMIT 20").all();
  const cancelled = db.prepare("SELECT * FROM orders WHERE status = 'cancelled' ORDER BY created_at DESC LIMIT 5").all();

  const withItems = [...active, ...recent, ...cancelled].map(o => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
    return { ...o, items };
  });
  res.json(withItems);
});

// GET /api/orders/report?date=YYYY-MM-DD
router.get('/report', authMiddleware, (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Falta el parámetro date' });

  const db = getDb();
  const orders = db.prepare(`
    SELECT * FROM orders
    WHERE status = 'paid' AND date(paid_at) = ?
    ORDER BY paid_at DESC
  `).all(date);

  const withItems = orders.map(o => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
    return { ...o, items };
  });

  const total   = orders.reduce((s, o) => s + (o.total || 0), 0);
  const count   = orders.length;
  const avg     = count ? total / count : 0;

  res.json({ date, orders: withItems, summary: { total, count, avg } });
});

// POST /api/orders  (crear nueva)
router.post('/', authMiddleware, (req, res) => {
  const { label, items } = req.body;
  const db = getDb();
  const id = uid();

  db.prepare(`
    INSERT INTO orders (id, label, status, created_at)
    VALUES (?, ?, 'active', datetime('now'))
  `).run(id, label || 'Comanda');

  if (Array.isArray(items) && items.length > 0) {
    const ins = db.prepare('INSERT INTO order_items (order_id, product_id, name, price, qty, person_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertAll = db.transaction(() => items.forEach(i => ins.run(id, i.productId, i.name, i.price, i.qty, i.person_name || '', i.notes || '')));
    insertAll();
  }

  res.status(201).json(getFullOrder(db, id));
});

// PUT /api/orders/:id  (actualizar — items, label, status)
router.put('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Comanda no encontrada' });

  const { label, items, status, total, paid, change_amt } = req.body;

  // Actualizar campos de la orden
  db.prepare(`
    UPDATE orders SET
      label      = COALESCE(?, label),
      status     = COALESCE(?, status),
      total      = COALESCE(?, total),
      paid       = COALESCE(?, paid),
      change_amt = COALESCE(?, change_amt),
      paid_at    = CASE WHEN ? = 'paid' AND paid_at IS NULL THEN datetime('now') ELSE paid_at END
    WHERE id = ?
  `).run(
    label || null,
    status || null,
    total != null ? total : null,
    paid  != null ? paid  : null,
    change_amt != null ? change_amt : null,
    status || existing.status,
    req.params.id
  );

  // Reemplazar items si se envían
  if (Array.isArray(items)) {
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
    if (items.length > 0) {
      const ins = db.prepare('INSERT INTO order_items (order_id, product_id, name, price, qty, person_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const insertAll = db.transaction(() => items.forEach(i => ins.run(req.params.id, i.productId, i.name, i.price, i.qty, i.person_name || '', i.notes || '')));
      insertAll();
    }
  }

  res.json(getFullOrder(db, req.params.id));
});

// DELETE /api/orders/:id  (cancelar)
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const result = db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Comanda no encontrada' });
  res.json({ ok: true });
});

module.exports = router;
