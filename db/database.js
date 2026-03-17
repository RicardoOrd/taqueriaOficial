require('dotenv').config();
const { createClient } = require('@libsql/client/web');
const bcrypt = require('bcryptjs');

// Inicializamos el cliente de Turso
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Inicialización asíncrona del schema
async function initSchema() {
  try {
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS users (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        username  TEXT    UNIQUE NOT NULL,
        password  TEXT    NOT NULL,
        role      TEXT    NOT NULL DEFAULT 'staff',
        created_at TEXT   DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS products (
        id         TEXT    PRIMARY KEY,
        name       TEXT    NOT NULL,
        price      REAL    NOT NULL DEFAULT 0,
        category   TEXT    NOT NULL DEFAULT 'Tacos',
        image      TEXT,
        active     INTEGER NOT NULL DEFAULT 1,
        created_at TEXT    DEFAULT (datetime('now')),
        updated_at TEXT    DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS orders (
        id         TEXT    PRIMARY KEY,
        label      TEXT    NOT NULL,
        status     TEXT    NOT NULL DEFAULT 'active',
        total      REAL,
        paid       REAL,
        change_amt REAL,
        created_at TEXT    DEFAULT (datetime('now')),
        paid_at    TEXT
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id    TEXT    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id  TEXT    NOT NULL,
        name        TEXT    NOT NULL,
        price       REAL    NOT NULL,
        qty         INTEGER NOT NULL DEFAULT 1,
        person_name TEXT    NOT NULL DEFAULT '',
        notes       TEXT    NOT NULL DEFAULT ''
      );
    `);

    // Migración: agregar columnas nuevas si no existen
    const pragmaRes = await db.execute("PRAGMA table_info(order_items)");
    const cols = pragmaRes.rows.map(c => c.name);

    if (!cols.includes('person_name')) {
      await db.execute("ALTER TABLE order_items ADD COLUMN person_name TEXT NOT NULL DEFAULT ''");
    }
    if (!cols.includes('notes')) {
      await db.execute("ALTER TABLE order_items ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
    }

    // Usuario admin por defecto
    const existingAdmin = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: ['admin']
    });

    if (existingAdmin.rows.length === 0) {
      const hash = bcrypt.hashSync('1234', 10);
      await db.execute({
        sql: 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        args: ['admin', hash, 'admin']
      });
      console.log('✅ Usuario admin creado (contraseña: 1234)');
    }

    // Productos de ejemplo si no hay ninguno
    const countRes = await db.execute('SELECT COUNT(*) as c FROM products');
    const count = Number(countRes.rows[0].c);

    if (count === 0) {
      const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      const seed = [
        ['Taco de Asada', 25, 'Tacos'],
        ['Taco de Pollo', 22, 'Tacos'],
        ['Taco de Chorizo', 22, 'Tacos'],
        ['Taco Campechano', 25, 'Tacos'],
        ['Quesadilla', 45, 'Extras'],
        ['Torta', 55, 'Extras'],
        ['Agua Fresca', 20, 'Bebidas'],
        ['Refresco', 22, 'Bebidas'],
        ['Cerveza', 35, 'Bebidas'],
      ];

      const statements = seed.map(([name, price, cat]) => ({
        sql: 'INSERT INTO products (id, name, price, category) VALUES (?, ?, ?, ?)',
        args: [uid(), name, price, cat]
      }));

      await db.batch(statements, 'write');
      console.log('✅ Productos de ejemplo creados');
    }
  } catch (error) {
    console.error('❌ Error inicializando la base de datos:', error);
  }
}

module.exports = { db, initSchema };