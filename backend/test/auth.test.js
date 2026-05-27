const request = require('supertest');
const app = require('../server');
const db = require('../config/db');

jest.setTimeout(20000);

describe('Auth endpoints', () => {
    const timestamp = Date.now();
    const email = `prueba+${timestamp}@gmail.com`;
    const password = '123456';
    const newPassword = '654321';
    const telefono = '3001234567';
    let verificationToken;
    let passwordResetToken;

    test('register user missing fields should return 400', async () => {
        const res = await request(app).post('/api/auth/register').send({ email });
        expect(res.statusCode).toBe(400);
    });

    test('register new user should succeed', async () => {
        const res = await request(app).post('/api/auth/register').send({ nombre: 'Test User', email, password, telefono });
        expect([200, 201]).toContain(res.statusCode);
        expect(res.body.verification_preview_token).toBeTruthy();
        verificationToken = res.body.verification_preview_token;
    });

    test('register same user again should return 400 or 409 depending on implementation', async () => {
        const res = await request(app).post('/api/auth/register').send({ nombre: 'Test User', email, password, telefono });
        expect([400, 409, 500]).toContain(res.statusCode);
    });

    test('verify email should succeed', async () => {
        const res = await request(app).get(`/api/auth/verify-email?token=${verificationToken}`);
        expect(res.statusCode).toBe(200);
    });

    test('login with correct credentials should return token', async () => {
        const res = await request(app).post('/api/auth/login').send({ email, password });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
    });

    test('login wrong password should return 401', async () => {
        const res = await request(app).post('/api/auth/login').send({ email, password: 'wrong' });
        expect(res.statusCode).toBe(401);
    });

    test('request password reset should return preview token in test', async () => {
        const res = await request(app).post('/api/auth/forgot-password').send({ email });
        expect(res.statusCode).toBe(200);
        expect(res.body.reset_preview_token).toBeTruthy();
        passwordResetToken = res.body.reset_preview_token;
    });

    test('reset password should allow login with new credentials', async () => {
        const resetRes = await request(app)
            .post('/api/auth/reset-password')
            .send({ token: passwordResetToken, password: newPassword });
        expect(resetRes.statusCode).toBe(200);

        const oldLoginRes = await request(app).post('/api/auth/login').send({ email, password });
        expect(oldLoginRes.statusCode).toBe(401);

        const newLoginRes = await request(app).post('/api/auth/login').send({ email, password: newPassword });
        expect(newLoginRes.statusCode).toBe(200);
        expect(newLoginRes.body).toHaveProperty('token');
    });
});

    afterAll(async () => {
        if (db && typeof db.end === 'function') {
            await new Promise((resolve) => db.end(() => resolve()));
        }
    });
