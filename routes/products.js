const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('./middleware');

const router = express.Router();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// GET /api/products
router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY category, name').all();
  res.json(rows);
});

// GET /api/products/all  (incluye inactivos, para admin)
router.get('/all', authMiddleware, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM products ORDER BY category, name').all();
  res.json(rows);
});

// POST /api/products
router.post('/', authMiddleware, (req, res) => {
  const { name, price, category, image } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const db = getDb();
  const id = uid();
  db.prepare(`
    INSERT INTO products (id, name, price, category, image)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name.trim(), parseFloat(price) || 0, category || 'Tacos', image || null);

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  res.status(201).json(product);
});

// PUT /api/products/:id
router.put('/:id', authMiddleware, (req, res) => {
  const { name, price, category, image, active } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

  db.prepare(`
    UPDATE products SET
      name       = COALESCE(?, name),
      price      = COALESCE(?, price),
      category   = COALESCE(?, category),
      image      = ?,
      active     = COALESCE(?, active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name?.trim() || null,
    price != null ? parseFloat(price) : null,
    category || null,
    image !== undefined ? image : db.prepare('SELECT image FROM products WHERE id = ?').get(req.params.id).image,
    active != null ? (active ? 1 : 0) : null,
    req.params.id
  );

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  res.json(product);
});

// DELETE /api/products/:id  (soft delete)
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const result = db.prepare("UPDATE products SET active = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ ok: true });
});

module.exports = router;
