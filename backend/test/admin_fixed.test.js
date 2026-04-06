const request = require('supertest');
const app = require('../server');
const db = require('../config/db');

jest.setTimeout(20000);

describe('Admin endpoints', () => {
    const timestamp = Date.now();
    const email = `admin+${timestamp}@gmail.com`;
    const password = '123456';
    let token;
    let userId;

    beforeAll(async () => {
        const registerRes = await request(app).post('/api/auth/register').send({
            nombre: 'Admin Test',
            email,
            password,
            telefono: '3009991122',
        });

        userId = registerRes.body.id;

        await request(app).get(`/api/auth/verify-email?token=${registerRes.body.verification_preview_token}`);

        await new Promise((resolve, reject) => {
            db.query(
                'UPDATE usuarios SET rol = ?, email_verificado = 1, email_verificado_en = NOW() WHERE id = ?',
                ['admin', userId],
                (err, result) => (err ? reject(err) : resolve(result)),
            );
        });
    });

    test('admin login should return token', async () => {
        const res = await request(app).post('/api/admin/login').send({ email, password });
        expect(res.statusCode).toBe(200);
        expect(res.body.token).toBeTruthy();
        token = res.body.token;
    });

    test('admin can list usuarios', async () => {
        const res = await request(app)
            .get('/api/admin/usuarios')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((item) => item.id === userId)).toBe(true);
    });
});

afterAll(async () => {
    if (db && typeof db.end === 'function') {
        await new Promise((resolve) => db.end(() => resolve()));
    }
});
