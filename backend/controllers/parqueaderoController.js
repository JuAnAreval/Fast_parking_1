const express = require('express');
const parqueaderoService = require('../services/parqueaderoService');
const {
    authenticateOptional,
    requireParqueaderoAuth,
    requireSameParqueaderoParam,
} = require('../middlewares/auth');

const router = express.Router();

const getParqueaderos = (req, res) => parqueaderoService.getParqueaderos(req, res);
const verificarEmail = (req, res) => parqueaderoService.verificarEmail(req, res);
const getParqueadero = (req, res) => parqueaderoService.getParqueadero(req, res);
const getTarifas = (req, res) => parqueaderoService.getTarifas(req, res);
const registerParqueadero = (req, res) => parqueaderoService.registerParqueadero(req, res);
const loginParqueadero = (req, res) => parqueaderoService.loginParqueadero(req, res);
const solicitarRecuperacionPassword = (req, res) => parqueaderoService.solicitarRecuperacionPassword(req, res);
const resetearPassword = (req, res) => parqueaderoService.resetearPassword(req, res);
const updateParqueadero = (req, res) => parqueaderoService.updateParqueadero(req, res);
const updateDisponibilidad = (req, res) => parqueaderoService.updateDisponibilidad(req, res);
const updateTarifas = (req, res) => parqueaderoService.updateTarifas(req, res);

router.get('/', getParqueaderos);
router.get('/verify-email', verificarEmail);
router.get('/:id', authenticateOptional, getParqueadero);
router.get('/:id/tarifas', getTarifas);

router.post('/register', registerParqueadero);
router.post('/login', loginParqueadero);
router.post('/forgot-password', solicitarRecuperacionPassword);
router.post('/reset-password', resetearPassword);

router.put('/:id', requireParqueaderoAuth, requireSameParqueaderoParam('id'), updateParqueadero);
router.put('/:id/disponibilidad', requireParqueaderoAuth, requireSameParqueaderoParam('id'), updateDisponibilidad);
router.put('/:id/tarifas', requireParqueaderoAuth, requireSameParqueaderoParam('id'), updateTarifas);

module.exports = router;
