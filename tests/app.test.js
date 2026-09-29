const request = require('supertest');

const { app, initializeDatabase, resetDatabase } = require('../src/app');

beforeAll(async () => {
  await initializeDatabase(':memory:');
  await resetDatabase();
});

afterEach(async () => {
  await resetDatabase();
});

describe('Health and CRUD API', () => {
  test('GET /health returns status ok', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  test('GET /api/items returns an empty array initially', async () => {
    const response = await request(app).get('/api/items');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('POST /api/items creates a new item', async () => {
    const response = await request(app)
      .post('/api/items')
      .send({
        title: 'Task 1',
        description: 'Complete the project',
      });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Task 1');
    expect(response.body.description).toBe('Complete the project');
    expect(response.body.id).toBeDefined();
  });

  test('PUT /api/items/:id updates an item', async () => {
    const createResponse = await request(app)
      .post('/api/items')
      .send({
        title: 'Old task',
        description: 'Before update',
      });

    const response = await request(app)
      .put(`/api/items/${createResponse.body.id}`)
      .send({
        title: 'Updated task',
        description: 'After update',
      });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Updated task');
    expect(response.body.description).toBe('After update');
  });

  test('DELETE /api/items/:id removes an item', async () => {
    const createResponse = await request(app)
      .post('/api/items')
      .send({
        title: 'Delete me',
        description: 'Remove this item',
      });

    const response = await request(app).delete(`/api/items/${createResponse.body.id}`);

    expect(response.status).toBe(200);
    expect(response.body.deleted).toBe(true);
  });
});
