const express = require('express');
const authService = require('../services/authService');
const { requireUserAuth } = require('../middlewares/auth');

const router = express.Router();

const registrar = (req, res) => authService.registrar(req, res);
const login = (req, res) => authService.login(req, res);
const solicitarRecuperacionPassword = (req, res) => authService.solicitarRecuperacionPassword(req, res);
const resetearPassword = (req, res) => authService.resetearPassword(req, res);
const verificarEmail = (req, res) => authService.verificarEmail(req, res);
const perfil = (req, res) => authService.perfil(req, res);
const actualizarPerfil = (req, res) => authService.actualizarPerfil(req, res);
const cambiarPassword = (req, res) => authService.cambiarPassword(req, res);

router.post('/register', registrar);
router.post('/login', login);
router.post('/forgot-password', solicitarRecuperacionPassword);
router.post('/reset-password', resetearPassword);
router.get('/verify-email', verificarEmail);
router.get('/me', requireUserAuth, perfil);
router.put('/me', requireUserAuth, actualizarPerfil);
router.put('/me/password', requireUserAuth, cambiarPassword);

module.exports = router;
