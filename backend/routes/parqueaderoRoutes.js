const express = require('express');
const router = express.Router();
const parqueaderoController = require('../controllers/parqueaderoController');

// Obtener lista de parqueaderos
router.get('/', parqueaderoController.getParqueaderos);

// Obtener un parqueadero específico
router.get('/:id', parqueaderoController.getParqueadero);

// Obtener tarifas de un parqueadero
router.get('/:id/tarifas', parqueaderoController.getTarifas);

// Registrar parqueadero
router.post('/register', parqueaderoController.registerParqueadero);

// Login parqueadero
router.post('/login', parqueaderoController.loginParqueadero);

// Actualizar parqueadero
router.put('/:id', parqueaderoController.updateParqueadero);

// Actualizar disponibilidad manual
router.put('/:id/disponibilidad', parqueaderoController.updateDisponibilidad);

// Actualizar tarifas de un parqueadero
router.put('/:id/tarifas', parqueaderoController.updateTarifas);

module.exports = router;
