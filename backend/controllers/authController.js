const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Usuario = require("../models/usuarioModel");

const SECRET_KEY = process.env.JWT_SECRET || "secreto123"; // prefer env var, fallback for compatibility
const PHONE_REGEX = /^\+?[0-9()\-\s]{7,20}$/;

const normalizePhone = (value) => String(value || "").trim();

const getUserIdFromAuthHeader = (req) => {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader || typeof authHeader !== 'string') return null;
    if (!authHeader.toLowerCase().startsWith('bearer ')) return null;

    const token = authHeader.slice(7).trim();
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const id = Number(decoded?.id);
        if (!Number.isInteger(id) || id <= 0) return null;
        return id;
    } catch (_) {
        return null;
    }
};

exports.registrar = (req, res) => {
    let { nombre, email, password, telefono } = req.body;

    if (typeof nombre === 'string') {
        nombre = nombre.trim();
    }
    if (typeof email === 'string') {
        email = email.trim().toLowerCase();
    }
    telefono = normalizePhone(telefono);

    if (!nombre || !email || !password || !telefono) {
        return res.status(400).json({ mensaje: "Faltan datos", message: "Missing data" });
    }
    if (!PHONE_REGEX.test(telefono)) {
        return res.status(400).json({
            mensaje: "Numero de telefono invalido",
            message: "Invalid phone number",
        });
    }

    Usuario.buscarPorEmail(email, (err, results) => {
        if (err) {
            console.error('Error al validar email de usuario:', err);
            return res.status(500).json({ mensaje: "Error interno", message: "Internal server error" });
        }
        if (results.length > 0) {
            return res.status(400).json({ mensaje: "El correo ya está registrado", message: "Email already registered" });
        }

        const hashedPassword = bcrypt.hashSync(password, 8);

        Usuario.crear(nombre, email, hashedPassword, telefono, (err) => {
            if (err) return res.status(500).json({ mensaje: "Error al registrar usuario" });
            res.json({ mensaje: "Usuario registrado con éxito", message: "Usuario registrado con éxito" });
        });
    });
};

exports.login = (req, res) => {
    let { email, password } = req.body;

    if (typeof email === 'string') {
        email = email.trim().toLowerCase();
    }

    if (!email || !password) {
        return res.status(400).json({ mensaje: "Faltan datos", message: "Missing data" });
    }

    Usuario.buscarPorEmail(email, (err, results) => {
        if (err) {
            console.error('Error buscando usuario por email:', err);
            return res.status(500).json({ mensaje: "Error interno", message: "Internal server error" });
        }
        if (results.length === 0) {
            return res.status(400).json({ mensaje: "Usuario no encontrado", message: "User not found" });
        }

        const usuario = results[0];
        const passwordValida = bcrypt.compareSync(password, usuario.password);

        if (!passwordValida) {
            return res.status(401).json({ mensaje: "Contraseña incorrecta", message: "Incorrect password" });
        }

        const token = jwt.sign({ id: usuario.id }, SECRET_KEY, { expiresIn: "1h" });

        // Enviamos también los datos del usuario (excepto la contraseña)
        const { password: _, ...usuarioSinPassword } = usuario;
        res.json({ 
            mensaje: "Login exitoso", 
            message: "Login successful", 
            token,
            usuario: usuarioSinPassword
        });
    });
};

exports.perfil = (req, res) => {
    const userId = getUserIdFromAuthHeader(req);
    if (!userId) {
        return res.status(401).json({ mensaje: "No autorizado", message: "Unauthorized" });
    }

    Usuario.buscarPorId(userId, (err, results) => {
        if (err) {
            console.error('Error al obtener perfil:', err);
            return res.status(500).json({ mensaje: "Error interno", message: "Internal server error" });
        }

        if (!results || results.length === 0) {
            return res.status(404).json({ mensaje: "Usuario no encontrado", message: "User not found" });
        }

        const usuario = results[0];
        return res.json({
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            telefono: usuario.telefono || null,
            creado_en: usuario.creado_en,
        });
    });
};

exports.actualizarPerfil = (req, res) => {
    const userId = getUserIdFromAuthHeader(req);
    if (!userId) {
        return res.status(401).json({ mensaje: "No autorizado", message: "Unauthorized" });
    }

    let { nombre, email, telefono } = req.body;
    if (typeof nombre === 'string') nombre = nombre.trim();
    if (typeof email === 'string') email = email.trim().toLowerCase();
    telefono = normalizePhone(telefono);

    if (!nombre || !email || !telefono) {
        return res.status(400).json({
            mensaje: "Nombre, correo y telefono son requeridos",
            message: "Name, email and phone are required",
        });
    }
    if (!PHONE_REGEX.test(telefono)) {
        return res.status(400).json({
            mensaje: "Numero de telefono invalido",
            message: "Invalid phone number",
        });
    }

    Usuario.buscarPorEmailExcluyendoId(email, userId, (checkErr, emailRows) => {
        if (checkErr) {
            console.error('Error validando correo:', checkErr);
            return res.status(500).json({ mensaje: "Error interno", message: "Internal server error" });
        }

        if (emailRows && emailRows.length > 0) {
            return res.status(400).json({ mensaje: "El correo ya esta registrado", message: "Email already registered" });
        }

        Usuario.actualizarPerfil(userId, nombre, email, telefono, (updateErr, result) => {
            if (updateErr) {
                console.error('Error actualizando perfil:', updateErr);
                return res.status(500).json({ mensaje: "Error interno", message: "Internal server error" });
            }

            if (!result || result.affectedRows === 0) {
                return res.status(404).json({ mensaje: "Usuario no encontrado", message: "User not found" });
            }

            return res.json({
                mensaje: "Perfil actualizado",
                message: "Profile updated",
                usuario: { id: userId, nombre, email, telefono },
            });
        });
    });
};

exports.cambiarPassword = (req, res) => {
    const userId = getUserIdFromAuthHeader(req);
    if (!userId) {
        return res.status(401).json({ mensaje: "No autorizado", message: "Unauthorized" });
    }

    const actual = String(req.body?.password_actual || '');
    const nueva = String(req.body?.password_nueva || '');

    if (!actual || !nueva) {
        return res.status(400).json({ mensaje: "Debes enviar password actual y nueva", message: "Current and new password are required" });
    }

    if (nueva.length < 6) {
        return res.status(400).json({ mensaje: "La nueva contrasena debe tener al menos 6 caracteres", message: "New password must be at least 6 characters" });
    }

    Usuario.buscarPorId(userId, (findErr, results) => {
        if (findErr) {
            console.error('Error al obtener usuario para cambio de password:', findErr);
            return res.status(500).json({ mensaje: "Error interno", message: "Internal server error" });
        }

        if (!results || results.length === 0) {
            return res.status(404).json({ mensaje: "Usuario no encontrado", message: "User not found" });
        }

        const usuario = results[0];
        const actualValida = bcrypt.compareSync(actual, usuario.password);
        if (!actualValida) {
            return res.status(401).json({ mensaje: "Contrasena actual incorrecta", message: "Current password is incorrect" });
        }

        const nuevaHash = bcrypt.hashSync(nueva, 8);
        Usuario.actualizarPassword(userId, nuevaHash, (updateErr, result) => {
            if (updateErr) {
                console.error('Error al actualizar password:', updateErr);
                return res.status(500).json({ mensaje: "Error interno", message: "Internal server error" });
            }

            if (!result || result.affectedRows === 0) {
                return res.status(404).json({ mensaje: "Usuario no encontrado", message: "User not found" });
            }

            return res.json({ mensaje: "Contrasena actualizada", message: "Password updated" });
        });
    });
};
