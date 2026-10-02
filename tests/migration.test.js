const fs = require('fs');
const os = require('os');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const request = require('supertest');

const {
  app,
  closeDatabase,
  initializeDatabase,
} = require('../src/api');

const databasePath = path.join(os.tmpdir(), `devops-price-migration-${process.pid}.db`);

function createLegacyDatabase() {
  return new Promise((resolve, reject) => {
    const legacyDatabase = new sqlite3.Database(databasePath, (openError) => {
      if (openError) {
        reject(openError);
        return;
      }

      legacyDatabase.exec(
        `CREATE TABLE products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          price REAL NOT NULL CHECK (price >= 0),
          sku TEXT UNIQUE,
          category TEXT NOT NULL DEFAULT '',
          stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO products (name, price, stock) VALUES ('Mouse', 49.99, 20);`,
        (migrationError) => {
          legacyDatabase.close((closeError) => {
            if (migrationError || closeError) {
              reject(migrationError || closeError);
              return;
            }
            resolve();
          });
        },
      );
    });
  });
}

describe('Legacy price migration', () => {
  beforeAll(async () => {
    await createLegacyDatabase();
    await initializeDatabase(databasePath);
  });

  afterAll(async () => {
    await closeDatabase();
    fs.rmSync(databasePath, { force: true });
    fs.rmSync(`${databasePath}-shm`, { force: true });
    fs.rmSync(`${databasePath}-wal`, { force: true });
  });

  test('converts existing USD prices to VND once', async () => {
    const firstResponse = await request(app).get('/api/products');
    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body[0].price).toBe(1249750);

    await closeDatabase();
    await initializeDatabase(databasePath);

    const secondResponse = await request(app).get('/api/products');
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body[0].price).toBe(1249750);
  });
});
