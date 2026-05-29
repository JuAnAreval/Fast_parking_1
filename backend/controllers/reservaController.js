const express = require('express');
const reservaService = require('../services/reservaService');
const {
    requireAnyAuth,
    requireInternalApiKey,
    requireParqueaderoAuth,
    requireSameParqueaderoParam,
    requireSameUserParam,
    requireUserAuth,
} = require('../middlewares/auth');

const router = express.Router();

const getReservasUsuario = (req, res) => reservaService.getReservasUsuario(req, res);
const getReservasParqueadero = (req, res) => reservaService.getReservasParqueadero(req, res);
const streamReservasParqueadero = (req, res) => reservaService.streamReservasParqueadero(req, res);
const crearReserva = (req, res) => reservaService.crearReserva(req, res);
const cancelarReserva = (req, res) => reservaService.cancelarReserva(req, res);
const completarReserva = (req, res) => reservaService.completarReserva(req, res);
const autorizarIngreso = (req, res) => reservaService.autorizarIngreso(req, res);
const marcarLlegada = (req, res) => reservaService.marcarLlegada(req, res);
const marcarSalida = (req, res) => reservaService.marcarSalida(req, res);
const cancelarReservasExpiradas = (req, res) => reservaService.cancelarReservasExpiradas(req, res);
const getTarifaReserva = (req, res) => reservaService.getTarifaReserva(req, res);

router.get('/usuario/:usuarioId', requireUserAuth, requireSameUserParam('usuarioId'), getReservasUsuario);
router.get('/parqueadero/:parqueaderoId', requireParqueaderoAuth, requireSameParqueaderoParam('parqueaderoId'), getReservasParqueadero);
router.get('/stream/parqueadero/:parqueaderoId', streamReservasParqueadero);
router.post('/', requireUserAuth, crearReserva);
router.put('/:id/cancelar', requireAnyAuth, cancelarReserva);
router.put('/:id/completar', requireParqueaderoAuth, completarReserva);
router.put('/:id/autorizar-ingreso', requireAnyAuth, autorizarIngreso);
router.put('/:id/autorizar', requireAnyAuth, autorizarIngreso);
router.put('/:id/llegada', requireParqueaderoAuth, marcarLlegada);
router.put('/:id/salida', requireParqueaderoAuth, marcarSalida);
router.post('/cancelar-expiradas', requireInternalApiKey, cancelarReservasExpiradas);
router.get('/:id/tarifa', requireAnyAuth, getTarifaReserva);

module.exports = router;
