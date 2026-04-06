const request = require('supertest');
const app = require('../server');
const db = require('../config/db');

jest.setTimeout(20000);

describe('Parqueadero endpoints', () => {
    const timestamp = Date.now();
    const email = `parqueaderoprueba+${timestamp}@gmail.com`;
    const password = '123456';
    let parqueaderoId;
    let parqueaderoToken;
    let verificationToken;

    test('register parqueadero missing fields should return 400', async () => {
        const res = await request(app).post('/api/parqueaderos/register').send({ nombre: 'P' });
        expect(res.statusCode).toBe(400);
    });

    test('register new parqueadero should succeed', async () => {
        const res = await request(app).post('/api/parqueaderos/register').send({
            nombre: 'Parque Test',
            direccion: 'Calle 1',
            cupos: 10,
            email,
            password,
            latitud: 1.2136,
            longitud: -77.2811
        });
        expect([200, 201]).toContain(res.statusCode);
        expect(res.body).toHaveProperty('id');
        parqueaderoId = res.body.id;
        verificationToken = res.body.verification_preview_token;
    });

    test('register same parqueadero again should return 409 or 500', async () => {
        const res = await request(app).post('/api/parqueaderos/register').send({
            nombre: 'Parque Test',
            direccion: 'Calle 1',
            cupos: 10,
            email,
            password,
            latitud: 1.2136,
            longitud: -77.2811
        });
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
        parqueaderoToken = res.body.token;
    });

    test('login parqueadero wrong password returns 401', async () => {
        const res = await request(app).post('/api/parqueaderos/login').send({ email, password: 'bad' });
        expect(res.statusCode).toBe(401);
    });

    test('get parqueaderos should return array', async () => {
        const res = await request(app).get('/api/parqueaderos');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('get parqueaderos incluye tipos de vehiculo habilitados por tarifa', async () => {
        await new Promise((resolve, reject) => {
            db.query(
                `
                    INSERT INTO tarifas (
                        parqueadero_id,
                        tipo_vehiculo,
                        tarifa_primera_hora,
                        tarifa_hora_adicional
                    )
                    VALUES (?, ?, ?, ?), (?, ?, ?, ?)
                `,
                [
                    parqueaderoId,
                    'moto',
                    1000,
                    1000,
                    parqueaderoId,
                    'carro',
                    2500,
                    2500,
                ],
                (err) => (err ? reject(err) : resolve()),
            );
        });

        const res = await request(app).get('/api/parqueaderos');
        expect(res.statusCode).toBe(200);

        const parqueadero = res.body.find((item) => item.id === parqueaderoId);
        expect(parqueadero).toBeTruthy();
        expect(Array.isArray(parqueadero.tipos_vehiculo_habilitados)).toBe(true);
        expect(parqueadero.tipos_vehiculo_habilitados).toEqual(
            expect.arrayContaining(['moto', 'carro']),
        );
    });

    test('get parqueadero publico no expone email del propietario', async () => {
        const res = await request(app).get(`/api/parqueaderos/${parqueaderoId}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.email).toBeUndefined();
    });

    test('get parqueadero del propietario si expone email autenticado', async () => {
        const res = await request(app)
            .get(`/api/parqueaderos/${parqueaderoId}`)
            .set('Authorization', `Bearer ${parqueaderoToken}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.email).toBe(email);
    });

    test('get tarifas should return array', async () => {
        // First create a parqueadero to get tarifas from
        const createRes = await request(app).post('/api/parqueaderos/register').send({
            nombre: 'Parque Tarifas',
            direccion: 'Calle Tarifas',
            cupos: 5,
            email: `tarifas+${timestamp}@gmail.com`,
            password: '123456',
            latitud: 1.0,
            longitud: -77.0
        });

        if (createRes.statusCode === 200 || createRes.statusCode === 201) {
            const parqueaderoId = createRes.body.id;
            if (createRes.body.verification_preview_token) {
                await request(app).get(`/api/parqueaderos/verify-email?token=${createRes.body.verification_preview_token}`);
            }
            const res = await request(app).get(`/api/parqueaderos/${parqueaderoId}/tarifas`);
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        }
    });
});

    afterAll(async () => {
        if (db && typeof db.end === 'function') {
            await new Promise((resolve) => db.end(() => resolve()));
        }
    });
