const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdminAuth } = require('../middlewares/auth');

router.post('/login', adminController.loginAdmin);
router.post('/test-email', requireAdminAuth, adminController.probarCorreo);
router.get('/usuarios', requireAdminAuth, adminController.listarUsuarios);
router.put('/usuarios/:id', requireAdminAuth, adminController.actualizarUsuario);
router.get('/parqueaderos', requireAdminAuth, adminController.listarParqueaderos);
router.put('/parqueaderos/:id', requireAdminAuth, adminController.actualizarParqueadero);

module.exports = router;
