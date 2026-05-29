const request = require('supertest');
const app = require('../server');
const db = require('../config/db');

jest.setTimeout(20000);

describe('Reserva endpoints', () => {
    let userToken, parqueaderoToken, parqueaderoId, reservaId, userId;

    beforeAll(async () => {
        const timestamp = Date.now();
        const userEmail = `reserva.user+${timestamp}@gmail.com`;
        const userPassword = '123456';
        const registerUserRes = await request(app)
            .post('/api/auth/register')
            .send({
                nombre: 'Reserva Fixed User',
                email: userEmail,
                password: userPassword,
                telefono: '3001112233',
            });

        expect([200, 201]).toContain(registerUserRes.statusCode);
        expect(registerUserRes.body.verification_preview_token).toBeTruthy();

        await request(app).get(`/api/auth/verify-email?token=${registerUserRes.body.verification_preview_token}`);

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: userEmail, password: userPassword });

        expect(loginRes.statusCode).toBe(200);
        expect(loginRes.body.token).toBeTruthy();
        userToken = loginRes.body.token;

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(userToken, process.env.JWT_SECRET || 'secreto123');
        userId = decoded.id;

        const parqueaderoEmail = `parqueadero+${timestamp}@gmail.com`;
        const parqueaderoRes = await request(app)
            .post('/api/parqueaderos/register')
            .send({
                nombre: 'Parqueadero Test',
                direccion: 'Calle Test 123',
                cupos: 10,
                email: parqueaderoEmail,
                password: '123456',
                latitud: 1.2136,
                longitud: -77.2811
            });

        parqueaderoId = parqueaderoRes.body.id;

        await request(app).get(`/api/parqueaderos/verify-email?token=${parqueaderoRes.body.verification_preview_token}`);

        const parqueaderoLoginRes = await request(app)
            .post('/api/parqueaderos/login')
            .send({ email: parqueaderoEmail, password: '123456' });

        parqueaderoToken = parqueaderoLoginRes.body.token;

        // Insertar tarifas de prueba para el parqueadero usando promesas
        await new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO tarifas (parqueadero_id, tipo_vehiculo, tarifa_primera_hora, tarifa_hora_adicional) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
                [parqueaderoId, 'carro', 2000, 2000, parqueaderoId, 'moto', 1000, 1000],
                (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                }
            );
        });
    });

    test('crear reserva missing fields should return 400', async () => {
        const res = await request(app)
            .post('/api/reservas')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ parqueadero_id: parqueaderoId });

        expect(res.statusCode).toBe(400);
    });

    test('crear reserva should succeed', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const res = await request(app)
            .post('/api/reservas')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                usuario_id: userId,
                parqueadero_id: parqueaderoId,
                fecha_reserva: tomorrow.toISOString().split('T')[0],
                hora_inicio: '10:00:00',
                hora_fin: '11:00:00',
                tipo_vehiculo: 'carro',
                observaciones: 'Test reserva'
            });

        expect([200, 201]).toContain(res.statusCode);
        expect(res.body).toHaveProperty('id');
        reservaId = res.body.id;
    });

    test('get reservas usuario should return array', async () => {
        const res = await request(app)
            .get(`/api/reservas/usuario/${userId}`)
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('usuario no puede ver reservas administrativas del parqueadero', async () => {
        const res = await request(app)
            .get(`/api/reservas/parqueadero/${parqueaderoId}`)
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.statusCode).toBe(403);
    });

    test('reserva pendiente expirada se cancela automaticamente al intentar autorizar', async () => {
        const createRes = await request(app)
            .post('/api/reservas')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                parqueadero_id: parqueaderoId,
                tipo_vehiculo: 'carro',
                observaciones: 'Expiracion automatica',
            });

        expect([200, 201]).toContain(createRes.statusCode);
        expect(createRes.body.id).toBeTruthy();
        const expiringReservaId = createRes.body.id;

        await new Promise((resolve, reject) => {
            db.query(
                `
                    UPDATE reservas
                    SET fecha_reserva = CURDATE(),
                        hora_inicio = DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MINUTE), '%H:%i:%s'),
                        estado = 'pendiente'
                    WHERE id = ?
                `,
                [expiringReservaId],
                (err, result) => (err ? reject(err) : resolve(result)),
            );
        });

        const authorizeRes = await request(app)
            .put(`/api/reservas/${expiringReservaId}/autorizar-ingreso`)
            .set('Authorization', `Bearer ${userToken}`);

        expect(authorizeRes.statusCode).toBe(404);

        const estadoRows = await new Promise((resolve, reject) => {
            db.query(
                'SELECT estado FROM reservas WHERE id = ? LIMIT 1',
                [expiringReservaId],
                (err, results) => (err ? reject(err) : resolve(results || [])),
            );
        });

        expect(estadoRows[0]?.estado).toBe('cancelada');
    });

    test('cancelar reserva should succeed', async () => {
        if (!reservaId) {
            console.log('Skipping cancel test - no reservation created');
            return;
        }

        const res = await request(app)
            .put(`/api/reservas/${reservaId}/cancelar`)
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.statusCode).toBe(200);
    });

    test('completar reserva should succeed', async () => {
        // Crear otra reserva para completar
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const createRes = await request(app)
            .post('/api/reservas')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                usuario_id: userId,
                parqueadero_id: parqueaderoId,
                fecha_reserva: tomorrow.toISOString().split('T')[0],
                hora_inicio: '12:00:00',
                hora_fin: '13:00:00',
                tipo_vehiculo: 'moto',
                observaciones: 'Test completar'
            });

        if (createRes.statusCode === 200 || createRes.statusCode === 201) {
            const newReservaId = createRes.body.id;

            // Primero activar la reserva (simular que está activa)
            await new Promise((resolve, reject) => {
                db.query(
                    'UPDATE reservas SET estado = "activa" WHERE id = ?',
                    [newReservaId],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });

            const res = await request(app)
                .put(`/api/reservas/${newReservaId}/completar`)
                .set('Authorization', `Bearer ${parqueaderoToken}`);

            expect(res.statusCode).toBe(200);
        }
    });

    afterAll(async () => {
        if (db && typeof db.end === 'function') {
            await new Promise((resolve) => db.end(() => resolve()));
        }
    });
});
