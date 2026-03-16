const request = require('supertest');
const app = require('../server');
const db = require('../config/db');

const dbQuery = (sql, params = []) => new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
        if (err) return reject(err);
        return resolve(results);
    });
});

describe('Reserva endpoints', () => {
    let userToken, parqueaderoId, reservaId;

    beforeAll(async () => {
        // Crear usuario de prueba
        const timestamp = Date.now();
        const userEmail = `usuario+${timestamp}@gmail.com`;
        const userRes = await request(app)
            .post('/api/auth/register')
            .send({
                nombre: 'Usuario Test',
                email: userEmail,
                password: '123456',
                telefono: '3001112233',
            });

        // Login usuario
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: userEmail, password: '123456' });

        userToken = loginRes.body.token;

        // Crear parqueadero de prueba
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

        // Tarifas de prueba para validar calculo de valor al completar.
        await dbQuery(
            `
                INSERT INTO tarifas (parqueadero_id, tipo_vehiculo, tarifa_primera_hora, tarifa_hora_adicional)
                VALUES (?, 'carro', 5000, 3000), (?, 'moto', 2000, 1000)
            `,
            [parqueaderoId, parqueaderoId],
        );
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
                usuario_id: 1, // TODO: obtener del token
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
            .get('/api/reservas/usuario/1') // TODO: obtener del token
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    test('cancelar reserva should succeed', async () => {
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
                usuario_id: 1,
                parqueadero_id: parqueaderoId,
                fecha_reserva: tomorrow.toISOString().split('T')[0],
                hora_inicio: '12:00:00',
                hora_fin: '13:00:00',
                tipo_vehiculo: 'moto',
                observaciones: 'Test completar'
            });

        const newReservaId = createRes.body.id;

        const res = await request(app)
            .put(`/api/reservas/${newReservaId}/completar`)
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.statusCode).toBe(200);
    });

    test('completar reserva aplica primera hora + hora adicional por fraccion', async () => {
        const createRes = await request(app)
            .post('/api/reservas')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                usuario_id: 1,
                parqueadero_id: parqueaderoId,
                tipo_vehiculo: 'moto',
                observaciones: 'Test calculo tarifa',
            });

        expect([200, 201]).toContain(createRes.statusCode);
        const newReservaId = createRes.body.id;

        const authorizeRes = await request(app)
            .put(`/api/reservas/${newReservaId}/autorizar-ingreso`)
            .set('Authorization', `Bearer ${userToken}`);

        expect(authorizeRes.statusCode).toBe(200);

        await dbQuery(
            `
                UPDATE reservas
                SET fecha_reserva = CURDATE(), hora_inicio = DATE_SUB(CURTIME(), INTERVAL 61 MINUTE)
                WHERE id = ?
            `,
            [newReservaId],
        );

        const completeRes = await request(app)
            .put(`/api/reservas/${newReservaId}/completar`)
            .set('Authorization', `Bearer ${userToken}`);

        expect(completeRes.statusCode).toBe(200);
        expect(Number(completeRes.body.valor_total)).toBe(3000);
    });

    afterAll(async () => {
        if (db && typeof db.end === 'function') {
            await new Promise((resolve) => db.end(() => resolve()));
        }
    });
});
