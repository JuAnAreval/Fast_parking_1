const express = require('express');
const request = require('supertest');

jest.mock('../middlewares/auth', () => {
    const pass = (_req, _res, next) => next();
    return {
        authenticateOptional: pass,
        requireAdminAuth: pass,
        requireAnyAuth: pass,
        requireInternalApiKey: pass,
        requireParqueaderoAuth: pass,
        requireSameParqueaderoParam: () => pass,
        requireSameUserParam: () => pass,
        requireUserAuth: pass,
    };
});

jest.mock('../services/authService', () => ({
    registrar: jest.fn(),
    login: jest.fn(),
    solicitarRecuperacionPassword: jest.fn(),
    resetearPassword: jest.fn(),
    verificarEmail: jest.fn(),
    perfil: jest.fn(),
    actualizarPerfil: jest.fn(),
    cambiarPassword: jest.fn(),
}));

jest.mock('../services/adminService', () => ({
    loginAdmin: jest.fn(),
    probarCorreo: jest.fn(),
    listarUsuarios: jest.fn(),
    crearUsuario: jest.fn(),
    actualizarUsuario: jest.fn(),
    eliminarUsuario: jest.fn(),
    listarParqueaderos: jest.fn(),
    crearParqueadero: jest.fn(),
    actualizarParqueadero: jest.fn(),
    eliminarParqueadero: jest.fn(),
}));

jest.mock('../services/parqueaderoService', () => ({
    getParqueaderos: jest.fn(),
    verificarEmail: jest.fn(),
    getParqueadero: jest.fn(),
    getTarifas: jest.fn(),
    registerParqueadero: jest.fn(),
    loginParqueadero: jest.fn(),
    solicitarRecuperacionPassword: jest.fn(),
    resetearPassword: jest.fn(),
    updateParqueadero: jest.fn(),
    updateDisponibilidad: jest.fn(),
    updateTarifas: jest.fn(),
}));

jest.mock('../services/reservaService', () => ({
    getReservasUsuario: jest.fn(),
    getReservasParqueadero: jest.fn(),
    streamReservasParqueadero: jest.fn(),
    crearReserva: jest.fn(),
    cancelarReserva: jest.fn(),
    completarReserva: jest.fn(),
    autorizarIngreso: jest.fn(),
    marcarLlegada: jest.fn(),
    marcarSalida: jest.fn(),
    cancelarReservasExpiradas: jest.fn(),
    getTarifaReserva: jest.fn(),
}));

jest.mock('../services/vehiculoService', () => ({
    getVehiculosMios: jest.fn(),
    crearVehiculo: jest.fn(),
    actualizarVehiculo: jest.fn(),
    eliminarVehiculo: jest.fn(),
}));

const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const parqueaderoController = require('../controllers/parqueaderoController');
const reservaController = require('../controllers/reservaController');
const vehiculoController = require('../controllers/vehiculoController');

const authService = require('../services/authService');
const adminService = require('../services/adminService');
const parqueaderoService = require('../services/parqueaderoService');
const reservaService = require('../services/reservaService');
const vehiculoService = require('../services/vehiculoService');

const buildApp = (router) => {
    const app = express();
    app.use(express.json());
    app.use('/', router);
    return app;
};

const setOkResponder = (fn, tag) => {
    fn.mockImplementation((_req, res) => res.status(200).json({ ok: tag }));
};

const routes = [
    { method: 'post', path: '/register', router: authController, fn: authService.registrar, tag: 'auth.registrar' },
    { method: 'post', path: '/login', router: authController, fn: authService.login, tag: 'auth.login' },
    { method: 'post', path: '/forgot-password', router: authController, fn: authService.solicitarRecuperacionPassword, tag: 'auth.forgot' },
    { method: 'post', path: '/reset-password', router: authController, fn: authService.resetearPassword, tag: 'auth.reset' },
    { method: 'get', path: '/verify-email', router: authController, fn: authService.verificarEmail, tag: 'auth.verify' },
    { method: 'get', path: '/me', router: authController, fn: authService.perfil, tag: 'auth.perfil' },
    { method: 'put', path: '/me', router: authController, fn: authService.actualizarPerfil, tag: 'auth.update' },
    { method: 'put', path: '/me/password', router: authController, fn: authService.cambiarPassword, tag: 'auth.password' },

    { method: 'post', path: '/login', router: adminController, fn: adminService.loginAdmin, tag: 'admin.login' },
    { method: 'post', path: '/test-email', router: adminController, fn: adminService.probarCorreo, tag: 'admin.mail' },
    { method: 'get', path: '/usuarios', router: adminController, fn: adminService.listarUsuarios, tag: 'admin.users.list' },
    { method: 'post', path: '/usuarios', router: adminController, fn: adminService.crearUsuario, tag: 'admin.users.create' },
    { method: 'put', path: '/usuarios/1', router: adminController, fn: adminService.actualizarUsuario, tag: 'admin.users.update' },
    { method: 'delete', path: '/usuarios/1', router: adminController, fn: adminService.eliminarUsuario, tag: 'admin.users.delete' },
    { method: 'get', path: '/parqueaderos', router: adminController, fn: adminService.listarParqueaderos, tag: 'admin.parks.list' },
    { method: 'post', path: '/parqueaderos', router: adminController, fn: adminService.crearParqueadero, tag: 'admin.parks.create' },
    { method: 'put', path: '/parqueaderos/1', router: adminController, fn: adminService.actualizarParqueadero, tag: 'admin.parks.update' },
    { method: 'delete', path: '/parqueaderos/1', router: adminController, fn: adminService.eliminarParqueadero, tag: 'admin.parks.delete' },

    { method: 'get', path: '/', router: parqueaderoController, fn: parqueaderoService.getParqueaderos, tag: 'park.list' },
    { method: 'get', path: '/verify-email', router: parqueaderoController, fn: parqueaderoService.verificarEmail, tag: 'park.verify' },
    { method: 'get', path: '/1', router: parqueaderoController, fn: parqueaderoService.getParqueadero, tag: 'park.get' },
    { method: 'get', path: '/1/tarifas', router: parqueaderoController, fn: parqueaderoService.getTarifas, tag: 'park.tarifas' },
    { method: 'post', path: '/register', router: parqueaderoController, fn: parqueaderoService.registerParqueadero, tag: 'park.register' },
    { method: 'post', path: '/login', router: parqueaderoController, fn: parqueaderoService.loginParqueadero, tag: 'park.login' },
    { method: 'post', path: '/forgot-password', router: parqueaderoController, fn: parqueaderoService.solicitarRecuperacionPassword, tag: 'park.forgot' },
    { method: 'post', path: '/reset-password', router: parqueaderoController, fn: parqueaderoService.resetearPassword, tag: 'park.reset' },
    { method: 'put', path: '/1', router: parqueaderoController, fn: parqueaderoService.updateParqueadero, tag: 'park.update' },
    { method: 'put', path: '/1/disponibilidad', router: parqueaderoController, fn: parqueaderoService.updateDisponibilidad, tag: 'park.avail' },
    { method: 'put', path: '/1/tarifas', router: parqueaderoController, fn: parqueaderoService.updateTarifas, tag: 'park.tarifas.update' },

    { method: 'get', path: '/usuario/1', router: reservaController, fn: reservaService.getReservasUsuario, tag: 'reserva.user' },
    { method: 'get', path: '/parqueadero/1', router: reservaController, fn: reservaService.getReservasParqueadero, tag: 'reserva.park' },
    { method: 'get', path: '/stream/parqueadero/1', router: reservaController, fn: reservaService.streamReservasParqueadero, tag: 'reserva.stream' },
    { method: 'post', path: '/', router: reservaController, fn: reservaService.crearReserva, tag: 'reserva.create' },
    { method: 'put', path: '/1/cancelar', router: reservaController, fn: reservaService.cancelarReserva, tag: 'reserva.cancel' },
    { method: 'put', path: '/1/completar', router: reservaController, fn: reservaService.completarReserva, tag: 'reserva.complete' },
    { method: 'put', path: '/1/autorizar-ingreso', router: reservaController, fn: reservaService.autorizarIngreso, tag: 'reserva.authz.entry' },
    { method: 'put', path: '/1/autorizar', router: reservaController, fn: reservaService.autorizarIngreso, tag: 'reserva.authz.legacy' },
    { method: 'put', path: '/1/llegada', router: reservaController, fn: reservaService.marcarLlegada, tag: 'reserva.arrival' },
    { method: 'put', path: '/1/salida', router: reservaController, fn: reservaService.marcarSalida, tag: 'reserva.exit' },
    { method: 'post', path: '/cancelar-expiradas', router: reservaController, fn: reservaService.cancelarReservasExpiradas, tag: 'reserva.expired' },
    { method: 'get', path: '/1/tarifa', router: reservaController, fn: reservaService.getTarifaReserva, tag: 'reserva.tarifa' },

    { method: 'get', path: '/mios', router: vehiculoController, fn: vehiculoService.getVehiculosMios, tag: 'vehiculo.list' },
    { method: 'post', path: '/', router: vehiculoController, fn: vehiculoService.crearVehiculo, tag: 'vehiculo.create' },
    { method: 'put', path: '/1', router: vehiculoController, fn: vehiculoService.actualizarVehiculo, tag: 'vehiculo.update' },
    { method: 'delete', path: '/1', router: vehiculoController, fn: vehiculoService.eliminarVehiculo, tag: 'vehiculo.delete' },
];

describe('Controller route bindings', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each(routes)('$method $path delegates to service ($tag)', async ({ method, path, router, fn, tag }) => {
        setOkResponder(fn, tag);
        const app = buildApp(router);

        const req = request(app)[method](path);
        if (method === 'post' || method === 'put' || method === 'patch') {
            req.send({ sample: true });
        }

        const res = await req;
        expect(res.statusCode).toBe(200);
        expect(res.body.ok).toBe(tag);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
