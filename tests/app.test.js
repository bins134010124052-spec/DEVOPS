const request = require('supertest');

const { app, initializeDatabase, resetDatabase } = require('../src/app');

beforeAll(async () => {
  await initializeDatabase(':memory:');
  await resetDatabase();
});

afterEach(async () => {
  await resetDatabase();
});

describe('Health and product CRUD API', () => {
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
        price: 89.99,
        sku: 'KEY-001',
        category: 'Accessories',
        stock: 12,
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Mechanical Keyboard');
    expect(response.body.description).toBe('Hot-swappable keyboard');
    expect(response.body.price).toBe(89.99);
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
        price: 10,
      });

    const response = await request(app)
      .put(`/api/products/${createResponse.body.id}`)
      .send({
        name: 'Updated product',
        description: 'Updated description',
        price: 14.5,
        category: 'Office',
        stock: 3,
      });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated product');
    expect(response.body.price).toBe(14.5);
    expect(response.body.stock).toBe(3);
  });

  test('DELETE /api/products/:id removes a product', async () => {
    const createResponse = await request(app)
      .post('/api/products')
      .send({
        name: 'Delete me',
        price: 1,
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

    const product = { name: 'Mouse', price: 25, sku: 'MOUSE-001' };
    const firstResponse = await request(app).post('/api/products').send(product);
    const duplicateResponse = await request(app).post('/api/products').send(product);

    expect(firstResponse.status).toBe(201);
    expect(duplicateResponse.status).toBe(409);
  });
});
