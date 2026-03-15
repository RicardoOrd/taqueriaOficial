const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'taqueria.sqlite');
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
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

  // Migración: agregar columnas nuevas si no existen (para DBs existentes)
  const cols = db.prepare("PRAGMA table_info(order_items)").all().map(c => c.name);
  if (!cols.includes('person_name')) {
    db.exec("ALTER TABLE order_items ADD COLUMN person_name TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.includes('notes')) {
    db.exec("ALTER TABLE order_items ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
  }

  // Usuario admin por defecto
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existing) {
    const hash = bcrypt.hashSync('1234', 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
    console.log('✅ Usuario admin creado (contraseña: 1234)');
  }

  // Productos de ejemplo si no hay ninguno
  const count = db.prepare('SELECT COUNT(*) as c FROM products').get();
  if (count.c === 0) {
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const insert = db.prepare('INSERT INTO products (id, name, price, category) VALUES (?, ?, ?, ?)');
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
    const insertMany = db.transaction(() => seed.forEach(([name, price, cat]) => insert.run(uid(), name, price, cat)));
    insertMany();
    console.log('✅ Productos de ejemplo creados');
  }
}

module.exports = { getDb };
