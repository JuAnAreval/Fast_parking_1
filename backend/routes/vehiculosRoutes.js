const express = require('express');
const router = express.Router();
const vehiculoController = require('../controllers/vehiculoController');
const { requireUserAuth } = require('../middlewares/auth');

// Vehiculos del usuario autenticado
router.get('/mios', requireUserAuth, vehiculoController.getVehiculosMios);
router.post('/', requireUserAuth, vehiculoController.crearVehiculo);
router.put('/:id', requireUserAuth, vehiculoController.actualizarVehiculo);
router.delete('/:id', requireUserAuth, vehiculoController.eliminarVehiculo);

module.exports = router;
