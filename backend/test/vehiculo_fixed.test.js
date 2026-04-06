const request = require('supertest');
const app = require('../server');
const db = require('../config/db');

jest.setTimeout(20000);

describe('Vehiculo endpoints', () => {
    const timestamp = Date.now();
    const email = `vehiculo+${timestamp}@gmail.com`;
    const password = '123456';
    const telefono = '3001234567';
    let token;

    beforeAll(async () => {
        const registerRes = await request(app).post('/api/auth/register').send({
            nombre: 'Usuario Vehiculo',
            email,
            password,
            telefono,
        });

        expect([200, 201]).toContain(registerRes.statusCode);

        await request(app).get(`/api/auth/verify-email?token=${registerRes.body.verification_preview_token}`);

        const loginRes = await request(app).post('/api/auth/login').send({
            email,
            password,
        });

        expect(loginRes.statusCode).toBe(200);
        token = loginRes.body.token;
    });

    test('permite registrar bicicleta sin placa visible', async () => {
        const res = await request(app)
            .post('/api/vehiculos')
            .set('Authorization', `Bearer ${token}`)
            .send({
                tipo: 'bicicleta',
                color: 'Verde',
            });

        expect([200, 201]).toContain(res.statusCode);
        expect(res.body).toHaveProperty('vehiculo');
        expect(res.body.vehiculo.tipo).toBe('bicicleta');
        expect(res.body.vehiculo.placa).toBe('');
    });

    test('lista vehiculos ocultando placa de bicicletas', async () => {
        const res = await request(app)
            .get('/api/vehiculos/mios')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        const bicicleta = res.body.find((vehiculo) => vehiculo.tipo === 'bicicleta');
        expect(bicicleta).toBeTruthy();
        expect(bicicleta.placa).toBe('');
    });
});

afterAll(async () => {
    if (db && typeof db.end === 'function') {
        await new Promise((resolve) => db.end(() => resolve()));
    }
});
