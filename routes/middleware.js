const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'taqueria-secret-2024';

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No autorizado' });

  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { authMiddleware, SECRET };
