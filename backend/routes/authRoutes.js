const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/register", authController.registrar);
router.post("/login", authController.login);
router.get("/me", authController.perfil);
router.put("/me", authController.actualizarPerfil);
router.put("/me/password", authController.cambiarPassword);

module.exports = router;
