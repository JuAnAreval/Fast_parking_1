const express = require('express');
const router = express.Router();
const parqueaderoController = require('../controllers/parqueaderoController');
const {
    authenticateOptional,
    requireParqueaderoAuth,
    requireSameParqueaderoParam,
} = require('../middlewares/auth');

router.get('/', parqueaderoController.getParqueaderos);
router.get('/verify-email', parqueaderoController.verificarEmail);
router.get('/:id', authenticateOptional, parqueaderoController.getParqueadero);
router.get('/:id/tarifas', parqueaderoController.getTarifas);

router.post('/register', parqueaderoController.registerParqueadero);
router.post('/login', parqueaderoController.loginParqueadero);

router.put('/:id', requireParqueaderoAuth, requireSameParqueaderoParam('id'), parqueaderoController.updateParqueadero);
router.put('/:id/disponibilidad', requireParqueaderoAuth, requireSameParqueaderoParam('id'), parqueaderoController.updateDisponibilidad);
router.put('/:id/tarifas', requireParqueaderoAuth, requireSameParqueaderoParam('id'), parqueaderoController.updateTarifas);

module.exports = router;
