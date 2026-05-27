const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireUserAuth } = require("../middlewares/auth");

router.post("/register", authController.registrar);
router.post("/login", authController.login);
router.post("/forgot-password", authController.solicitarRecuperacionPassword);
router.post("/reset-password", authController.resetearPassword);
router.get("/verify-email", authController.verificarEmail);
router.get("/me", requireUserAuth, authController.perfil);
router.put("/me", requireUserAuth, authController.actualizarPerfil);
router.put("/me/password", requireUserAuth, authController.cambiarPassword);

module.exports = router;
