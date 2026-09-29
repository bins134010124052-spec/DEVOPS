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
app.use(express.json());
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

const defaultDbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');
const dataDir = path.dirname(defaultDbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

function initializeDatabase(databasePath = defaultDbPath) {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(databasePath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.run(
        `CREATE TABLE IF NOT EXISTS items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        (createErr) => {
          if (createErr) {
            reject(createErr);
            return;
          }

          resolve();
        },
      );
    });
  });
}

function resetDatabase() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM items', (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/items', async (req, res) => {
  try {
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM items ORDER BY created_at DESC', (err, savedRows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(savedRows);
      });
    });

    res.json(rows);
  } catch (error) {
    logger.error('Failed to fetch items', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

app.post('/api/items', async (req, res) => {
  const { title, description } = req.body || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO items (title, description) VALUES (?, ?)',
        [title.trim(), description || ''],
        function onInsert(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this);
        },
      );
    });

    const item = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM items WHERE id = ?', [result.lastID], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });

    res.status(201).json(item);
  } catch (error) {
    logger.error('Failed to create item', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

app.put('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        'UPDATE items SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title.trim(), description || '', id],
        function onUpdate(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this);
        },
      );
    });

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM items WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });

    res.json(item);
  } catch (error) {
    logger.error('Failed to update item', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await new Promise((resolve, reject) => {
      db.run('DELETE FROM items WHERE id = ?', [id], function onDelete(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this);
      });
    });

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ deleted: true, id: Number(id) });
  } catch (error) {
    logger.error('Failed to delete item', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = { app, initializeDatabase, resetDatabase };
