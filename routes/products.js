const express = require('express');
const { db } = require('../db/database');
const { authMiddleware } = require('./middleware');

const router = express.Router();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// GET /api/products
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM products WHERE active = 1 ORDER BY category, name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error GET /products:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/products/all  (incluye inactivos, para admin)
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM products ORDER BY category, name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error GET /products/all:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/products
router.post('/', authMiddleware, async (req, res) => {
  const { name, price, category, image } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const id = uid();

  try {
    await db.execute({
      sql: 'INSERT INTO products (id, name, price, category, image) VALUES (?, ?, ?, ?, ?)',
      args: [id, name.trim(), parseFloat(price) || 0, category || 'Tacos', image || null]
    });

    const result = await db.execute({
      sql: 'SELECT * FROM products WHERE id = ?',
      args: [id]
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error POST /products:', error);
    res.status(500).json({ error: 'Error al crear el producto' });
  }
});

// PUT /api/products/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, price, category, image, active } = req.body;
  const id = req.params.id;

  try {
    const existingResult = await db.execute({
      sql: 'SELECT * FROM products WHERE id = ?',
      args: [id]
    });

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const existingProduct = existingResult.rows[0];
    const finalImage = image !== undefined ? image : existingProduct.image;

    await db.execute({
      sql: `
        UPDATE products SET
          name       = COALESCE(?, name),
          price      = COALESCE(?, price),
          category   = COALESCE(?, category),
          image      = ?,
          active     = COALESCE(?, active),
          updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [
        name?.trim() || null,
        price != null ? parseFloat(price) : null,
        category || null,
        finalImage,
        active != null ? (active ? 1 : 0) : null,
        id
      ]
    });

    const updatedResult = await db.execute({
      sql: 'SELECT * FROM products WHERE id = ?',
      args: [id]
    });

    res.json(updatedResult.rows[0]);
  } catch (error) {
    console.error('Error PUT /products/:id:', error);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
});

// DELETE /api/products/:id  (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.execute({
      sql: "UPDATE products SET active = 0, updated_at = datetime('now') WHERE id = ?",
      args: [req.params.id]
    });

    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error DELETE /products/:id:', error);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
});

module.exports = router;