const express = require('express');
const router = express.Router();
const vehiculoController = require('../controllers/vehiculoController');

// Vehiculos del usuario autenticado
router.get('/mios', vehiculoController.getVehiculosMios);
router.post('/', vehiculoController.crearVehiculo);
router.put('/:id', vehiculoController.actualizarVehiculo);
router.delete('/:id', vehiculoController.eliminarVehiculo);

module.exports = router;
