const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdminAuth } = require('../middlewares/auth');

router.post('/login', adminController.loginAdmin);
router.post('/test-email', requireAdminAuth, adminController.probarCorreo);
router.get('/usuarios', requireAdminAuth, adminController.listarUsuarios);
router.post('/usuarios', requireAdminAuth, adminController.crearUsuario);
router.put('/usuarios/:id', requireAdminAuth, adminController.actualizarUsuario);
router.delete('/usuarios/:id', requireAdminAuth, adminController.eliminarUsuario);
router.get('/parqueaderos', requireAdminAuth, adminController.listarParqueaderos);
router.post('/parqueaderos', requireAdminAuth, adminController.crearParqueadero);
router.put('/parqueaderos/:id', requireAdminAuth, adminController.actualizarParqueadero);
router.delete('/parqueaderos/:id', requireAdminAuth, adminController.eliminarParqueadero);

module.exports = router;
