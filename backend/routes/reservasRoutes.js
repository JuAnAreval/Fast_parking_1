const express = require('express');
const router = express.Router();
const reservaController = require('../controllers/reservaController');
const {
    requireAnyAuth,
    requireInternalApiKey,
    requireParqueaderoAuth,
    requireSameParqueaderoParam,
    requireSameUserParam,
    requireUserAuth,
} = require('../middlewares/auth');

// Obtener reservas de un usuario
router.get('/usuario/:usuarioId', requireUserAuth, requireSameUserParam('usuarioId'), reservaController.getReservasUsuario);

// Obtener reservas de un parqueadero (para administradores)
router.get('/parqueadero/:parqueaderoId', requireParqueaderoAuth, requireSameParqueaderoParam('parqueaderoId'), reservaController.getReservasParqueadero);

// Stream SSE para reservas en tiempo real del parqueadero
router.get('/stream/parqueadero/:parqueaderoId', reservaController.streamReservasParqueadero);

// Crear nueva reserva
router.post('/', requireUserAuth, reservaController.crearReserva);

// Cancelar reserva
router.put('/:id/cancelar', requireAnyAuth, reservaController.cancelarReserva);

// Completar reserva
router.put('/:id/completar', requireParqueaderoAuth, reservaController.completarReserva);

// Autorizar ingreso
router.put('/:id/autorizar-ingreso', requireAnyAuth, reservaController.autorizarIngreso);
// Compatibilidad con cliente mobile legacy
router.put('/:id/autorizar', requireAnyAuth, reservaController.autorizarIngreso);

// Marcar llegada real (admin marca que el vehículo llegó)
router.put('/:id/llegada', requireParqueaderoAuth, reservaController.marcarLlegada);

// Marcar salida real (admin marca hora de salida y se calcula el total)
router.put('/:id/salida', requireParqueaderoAuth, reservaController.marcarSalida);

// Cancelar reservas pendientes que expiraron (pendiente > 15 minutos)
router.post('/cancelar-expiradas', requireInternalApiKey, reservaController.cancelarReservasExpiradas);

// Obtener tarifa para pago
router.get('/:id/tarifa', requireAnyAuth, reservaController.getTarifaReserva);

module.exports = router;
