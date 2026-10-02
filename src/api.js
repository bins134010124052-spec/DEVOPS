const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));
app.use(express.static(path.join(__dirname, 'public')));

const defaultDbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');
const usdToVndRate = 25000;
const priceMigrationName = 'prices-usd-to-vnd-25000-v1';

let db;

function run(sql, parameters = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, parameters, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });
}

function get(sql, parameters = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, parameters, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

async function migrateLegacyUsdPrices() {
  await run(`CREATE TABLE IF NOT EXISTS app_migrations (
    name TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await run('BEGIN IMMEDIATE TRANSACTION');

  try {
    const applied = await get('SELECT name FROM app_migrations WHERE name = ?', [priceMigrationName]);
    if (!applied) {
      await run('UPDATE products SET price = ROUND(price * ?, 0)', [usdToVndRate]);
      await run('INSERT INTO app_migrations (name) VALUES (?)', [priceMigrationName]);
    }

    await run('COMMIT');
  } catch (error) {
    await run('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

function initializeDatabase(databasePath = defaultDbPath) {
  return new Promise((resolve, reject) => {
    if (databasePath !== ':memory:') {
      fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    }

    db = new sqlite3.Database(databasePath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.run(
        `CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          price REAL NOT NULL CHECK (price >= 0),
          sku TEXT UNIQUE,
          category TEXT NOT NULL DEFAULT '',
          stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        (createErr) => {
          if (createErr) {
            reject(createErr);
            return;
          }

          migrateLegacyUsdPrices().then(resolve).catch(reject);
        },
      );
    });
  });
}

function resetDatabase() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM products', (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }

    const database = db;
    db = null;
    database.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function all(sql, parameters = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, parameters, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

function validateProduct(product) {
  if (!product || typeof product !== 'object' || Array.isArray(product)) {
    return 'A product object is required';
  }
  if (typeof product.name !== 'string' || !product.name.trim()) {
    return 'Name is required';
  }
  if (typeof product.price !== 'number' || !Number.isInteger(product.price) || product.price < 0) {
    return 'Price must be a non-negative integer';
  }
  if (product.description !== undefined && typeof product.description !== 'string') {
    return 'Description must be a string';
  }
  if (product.sku !== undefined && product.sku !== null && typeof product.sku !== 'string') {
    return 'SKU must be a string';
  }
  if (product.category !== undefined && typeof product.category !== 'string') {
    return 'Category must be a string';
  }
  if (product.stock !== undefined && (!Number.isInteger(product.stock) || product.stock < 0)) {
    return 'Stock must be a non-negative integer';
  }
  return null;
}

function validId(id) {
  return /^[1-9]\d*$/.test(id);
}

function productValues(product) {
  return [
    product.name.trim(),
    (product.description || '').trim(),
    product.price,
    product.sku ? product.sku.trim() || null : null,
    (product.category || '').trim(),
    product.stock === undefined ? 0 : product.stock,
  ];
}

app.get('/health', async (req, res) => {
  try {
    await get('SELECT 1');
    res.json({ status: 'ok', uptime: process.uptime() });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({ status: 'error' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    res.json(await all('SELECT * FROM products ORDER BY id DESC'));
  } catch (error) {
    logger.error('Failed to fetch products', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) {
    return res.status(400).json({ error: 'Product ID must be a positive integer' });
  }

  try {
    const product = await get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    logger.error('Failed to fetch product', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

app.post('/api/products', async (req, res) => {
  const validationError = validateProduct(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const result = await run(
      'INSERT INTO products (name, description, price, sku, category, stock) VALUES (?, ?, ?, ?, ?, ?)',
      productValues(req.body),
    );
    res.status(201).json(await get('SELECT * FROM products WHERE id = ?', [result.lastID]));
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'SKU already exists' });
    }
    logger.error('Failed to create product', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) {
    return res.status(400).json({ error: 'Product ID must be a positive integer' });
  }
  const validationError = validateProduct(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const result = await run(
      `UPDATE products
       SET name = ?, description = ?, price = ?, sku = ?, category = ?, stock = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [...productValues(req.body), id],
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(await get('SELECT * FROM products WHERE id = ?', [id]));
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'SKU already exists' });
    }
    logger.error('Failed to update product', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) {
    return res.status(400).json({ error: 'Product ID must be a positive integer' });
  }

  try {
    const result = await run('DELETE FROM products WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(204).end();
  } catch (error) {
    logger.error('Failed to delete product', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = {
  app,
  initializeDatabase,
  resetDatabase,
  closeDatabase,
};
