const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { db } = require('../db/database');
const { SECRET } = require('./middleware');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan credenciales' });

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE username = ?',
      args: [username.trim()]
    });

    const user = result.rows[0];

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: '12h' });
    res.json({ token, username: user.username, role: user.role });
  } catch (error) {
    console.error('Error en el login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE username = ?',
      args: [username]
    });

    const user = result.rows[0];

    if (!user || !bcrypt.compareSync(oldPassword, user.password)) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);

    await db.execute({
      sql: 'UPDATE users SET password = ? WHERE username = ?',
      args: [hash, username]
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;