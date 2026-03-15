const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { getDb } = require('../db/database');
const { SECRET } = require('./middleware');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan credenciales' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: '12h' });
  res.json({ token, username: user.username, role: user.role });
});

// POST /api/auth/change-password  (requiere auth – importarlo donde se use)
router.post('/change-password', (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(oldPassword, user.password)) {
    return res.status(401).json({ error: 'Contraseña actual incorrecta' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE username = ?').run(hash, username);
  res.json({ ok: true });
});

module.exports = router;
