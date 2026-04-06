const request = require('supertest');
const app = require('../server');
const db = require('../config/db');

jest.setTimeout(20000);

describe('Parqueadero endpoints', () => {
    const timestamp = Date.now();
    const email = `parqueaderoprueba+${timestamp}@gmail.com`;
    const password = '123456';
    let verificationToken;

    test('register parqueadero missing fields should return 400', async () => {
        const res = await request(app).post('/api/parqueaderos/register').send({ nombre: 'P' });
        expect(res.statusCode).toBe(400);
    });

    test('register new parqueadero should succeed', async () => {
        const res = await request(app).post('/api/parqueaderos/register').send({ nombre: 'Parque Test', direccion: 'Calle 1', cupos: 10, email, password });
        expect([200, 201]).toContain(res.statusCode);
        expect(res.body).toHaveProperty('id');
        expect(res.body.verification_preview_token).toBeTruthy();
        verificationToken = res.body.verification_preview_token;
    });

    test('register same parqueadero again should return 409 or 500', async () => {
        const res = await request(app).post('/api/parqueaderos/register').send({ nombre: 'Parque Test', direccion: 'Calle 1', cupos: 10, email, password });
        expect([409, 500, 400]).toContain(res.statusCode);
    });

    test('verify parqueadero email should succeed', async () => {
        const res = await request(app).get(`/api/parqueaderos/verify-email?token=${verificationToken}`);
        expect(res.statusCode).toBe(200);
    });

    test('login parqueadero success returns token', async () => {
        const res = await request(app).post('/api/parqueaderos/login').send({ email, password });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
    });

    test('login parqueadero wrong password returns 401', async () => {
        const res = await request(app).post('/api/parqueaderos/login').send({ email, password: 'bad' });
        expect(res.statusCode).toBe(401);
    });
});

    afterAll(async () => {
        if (db && typeof db.end === 'function') {
            await new Promise((resolve) => db.end(() => resolve()));
        }
    });
