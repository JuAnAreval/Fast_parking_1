const express = require('express');
const adminService = require('../services/adminService');
const { requireAdminAuth } = require('../middlewares/auth');

const router = express.Router();

const loginAdmin = (req, res) => adminService.loginAdmin(req, res);
const probarCorreo = (req, res) => adminService.probarCorreo(req, res);
const listarUsuarios = (req, res) => adminService.listarUsuarios(req, res);
const crearUsuario = (req, res) => adminService.crearUsuario(req, res);
const actualizarUsuario = (req, res) => adminService.actualizarUsuario(req, res);
const eliminarUsuario = (req, res) => adminService.eliminarUsuario(req, res);
const listarParqueaderos = (req, res) => adminService.listarParqueaderos(req, res);
const crearParqueadero = (req, res) => adminService.crearParqueadero(req, res);
const actualizarParqueadero = (req, res) => adminService.actualizarParqueadero(req, res);
const eliminarParqueadero = (req, res) => adminService.eliminarParqueadero(req, res);

router.post('/login', loginAdmin);
router.post('/test-email', requireAdminAuth, probarCorreo);
router.get('/usuarios', requireAdminAuth, listarUsuarios);
router.post('/usuarios', requireAdminAuth, crearUsuario);
router.put('/usuarios/:id', requireAdminAuth, actualizarUsuario);
router.delete('/usuarios/:id', requireAdminAuth, eliminarUsuario);
router.get('/parqueaderos', requireAdminAuth, listarParqueaderos);
router.post('/parqueaderos', requireAdminAuth, crearParqueadero);
router.put('/parqueaderos/:id', requireAdminAuth, actualizarParqueadero);
router.delete('/parqueaderos/:id', requireAdminAuth, eliminarParqueadero);

module.exports = router;
