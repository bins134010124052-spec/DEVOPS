const request = require('supertest');

const { app, initializeDatabase, resetDatabase } = require('../src/api');

beforeAll(async () => {
  await initializeDatabase(':memory:');
  await resetDatabase();
});

afterEach(async () => {
  await resetDatabase();
});

describe('Health and product CRUD API', () => {
  test('GET / serves the product catalog frontend', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.text).toContain('Danh mục sản phẩm');
    expect(response.text).toContain('<html lang="vi">');

    const stylesheet = await request(app).get('/styles.css');
    expect(stylesheet.status).toBe(200);
    expect(stylesheet.headers['content-type']).toMatch(/text\/css/);

    const script = await request(app).get('/catalog.js');
    expect(script.status).toBe(200);
    expect(script.headers['content-type']).toMatch(/javascript/);
  });

  test('GET /health returns status ok', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  test('GET /api/products returns an empty array initially', async () => {
    const response = await request(app).get('/api/products');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('POST /api/products creates a product', async () => {
    const response = await request(app)
      .post('/api/products')
      .send({
        name: 'Mechanical Keyboard',
        description: 'Hot-swappable keyboard',
        price: 2249750,
        sku: 'KEY-001',
        category: 'Accessories',
        stock: 12,
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Mechanical Keyboard');
    expect(response.body.description).toBe('Hot-swappable keyboard');
    expect(response.body.price).toBe(2249750);
    expect(response.body.sku).toBe('KEY-001');
    expect(response.body.stock).toBe(12);
    expect(response.body.id).toBeDefined();

    const getResponse = await request(app).get(`/api/products/${response.body.id}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.id).toBe(response.body.id);
  });

  test('PUT /api/products/:id updates a product', async () => {
    const createResponse = await request(app)
      .post('/api/products')
      .send({
        name: 'Old product',
        price: 250000,
      });

    const response = await request(app)
      .put(`/api/products/${createResponse.body.id}`)
      .send({
        name: 'Updated product',
        description: 'Updated description',
        price: 362500,
        category: 'Office',
        stock: 3,
      });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated product');
    expect(response.body.price).toBe(362500);
    expect(response.body.stock).toBe(3);
  });

  test('DELETE /api/products/:id removes a product', async () => {
    const createResponse = await request(app)
      .post('/api/products')
      .send({
        name: 'Delete me',
        price: 25000,
      });

    const response = await request(app).delete(`/api/products/${createResponse.body.id}`);

    expect(response.status).toBe(204);
    const getResponse = await request(app).get(`/api/products/${createResponse.body.id}`);
    expect(getResponse.status).toBe(404);
  });

  test('POST /api/products validates product fields and duplicate SKUs', async () => {
    const invalidResponse = await request(app)
      .post('/api/products')
      .send({ name: 'Invalid product', price: -1 });
    expect(invalidResponse.status).toBe(400);

    const fractionalPriceResponse = await request(app)
      .post('/api/products')
      .send({ name: 'Fractional VND', price: 10.5 });
    expect(fractionalPriceResponse.status).toBe(400);

    const product = { name: 'Mouse', price: 625000, sku: 'MOUSE-001' };
    const firstResponse = await request(app).post('/api/products').send(product);
    const duplicateResponse = await request(app).post('/api/products').send(product);

    expect(firstResponse.status).toBe(201);
    expect(duplicateResponse.status).toBe(409);
  });
});
