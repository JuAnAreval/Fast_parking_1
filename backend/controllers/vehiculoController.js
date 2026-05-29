const express = require('express');
const vehiculoService = require('../services/vehiculoService');
const { requireUserAuth } = require('../middlewares/auth');

const router = express.Router();

const getVehiculosMios = (req, res) => vehiculoService.getVehiculosMios(req, res);
const crearVehiculo = (req, res) => vehiculoService.crearVehiculo(req, res);
const actualizarVehiculo = (req, res) => vehiculoService.actualizarVehiculo(req, res);
const eliminarVehiculo = (req, res) => vehiculoService.eliminarVehiculo(req, res);

router.get('/mios', requireUserAuth, getVehiculosMios);
router.post('/', requireUserAuth, crearVehiculo);
router.put('/:id', requireUserAuth, actualizarVehiculo);
router.delete('/:id', requireUserAuth, eliminarVehiculo);

module.exports = router;
