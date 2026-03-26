const express = require('express');
const router = express.Router();
const parqueaderoController = require('../controllers/parqueaderoController');
const {
    authenticateOptional,
    requireParqueaderoAuth,
    requireSameParqueaderoParam,
} = require('../middlewares/auth');

// Obtener lista de parqueaderos
router.get('/', parqueaderoController.getParqueaderos);

// Obtener un parqueadero específico
router.get('/:id', authenticateOptional, parqueaderoController.getParqueadero);

// Obtener tarifas de un parqueadero
router.get('/:id/tarifas', parqueaderoController.getTarifas);

// Registrar parqueadero
router.post('/register', parqueaderoController.registerParqueadero);

// Login parqueadero
router.post('/login', parqueaderoController.loginParqueadero);

// Actualizar parqueadero
router.put('/:id', requireParqueaderoAuth, requireSameParqueaderoParam('id'), parqueaderoController.updateParqueadero);

// Actualizar disponibilidad manual
router.put('/:id/disponibilidad', requireParqueaderoAuth, requireSameParqueaderoParam('id'), parqueaderoController.updateDisponibilidad);

// Actualizar tarifas de un parqueadero
router.put('/:id/tarifas', requireParqueaderoAuth, requireSameParqueaderoParam('id'), parqueaderoController.updateTarifas);

module.exports = router;
