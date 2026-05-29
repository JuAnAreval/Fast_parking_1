const bcrypt = require("bcryptjs");
const Usuario = require("../models/usuarioModel");
const { signUserToken } = require("../middlewares/auth");
const {
    issueVerificationForRecord,
    verifyEmailToken,
} = require("../services/verificationService");
const {
    requestPasswordReset,
    resetPassword,
} = require("../services/passwordResetService");

const PHONE_REGEX = /^\+?[0-9()\-\s]{7,20}$/;

const normalizePhone = (value) => String(value || "").trim();

const includeVerificationPreview = (payload, verification) => {
    if (process.env.NODE_ENV !== 'test' || !verification?.token) {
        return payload;
    }

    return {
        ...payload,
        verification_preview_token: verification.token,
        verification_preview_url: verification.verificationUrl,
    };
};

exports.registrar = (req, res) => {
    let { nombre, email, password, telefono } = req.body;

    if (typeof nombre === 'string') nombre = nombre.trim();
    if (typeof email === 'string') email = email.trim().toLowerCase();
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
            return res.status(400).json({
                mensaje: "El correo ya esta registrado",
                message: "Email already registered",
            });
        }

        const hashedPassword = bcrypt.hashSync(password, 8);
        Usuario.crear(nombre, email, hashedPassword, telefono, async (createErr, result) => {
            if (createErr) {
                console.error('Error al registrar usuario:', createErr);
                return res.status(500).json({ mensaje: "Error al registrar usuario", message: "Error registering user" });
            }

            try {
                const verification = await issueVerificationForRecord('usuario', {
                    id: result?.insertId,
                    nombre,
                    email,
                });

                return res.status(201).json(
                    includeVerificationPreview(
                        {
                            mensaje: "Usuario registrado con exito. Revisa tu correo para verificar la cuenta.",
                            message: "User registered successfully. Check your email to verify the account.",
                            id: result?.insertId,
                        },
                        verification,
                    ),
                );
            } catch (verificationErr) {
                console.error('Error preparando verificacion de usuario:', verificationErr);
                return res.status(201).json({
                    mensaje: "Usuario registrado con exito, pero no se pudo enviar el correo de verificacion.",
                    message: "User registered successfully, but verification email could not be sent.",
                    id: result?.insertId,
                });
            }
        });
    });
};

exports.login = (req, res) => {
    let { email, password } = req.body;

    if (typeof email === 'string') email = email.trim().toLowerCase();

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
            return res.status(401).json({ mensaje: "Contrasena incorrecta", message: "Incorrect password" });
        }

        if (!usuario.email_verificado) {
            return res.status(403).json({
                mensaje: "Debes verificar tu correo antes de iniciar sesion",
                message: "You must verify your email before logging in",
                code: 'EMAIL_NOT_VERIFIED',
            });
        }

        const token = signUserToken(usuario);
        const { password: _, verification_token_hash: __, ...usuarioSinPassword } = usuario;

        return res.json({
            mensaje: "Login exitoso",
            message: "Login successful",
            token,
            usuario: usuarioSinPassword,
        });
    });
};

exports.verificarEmail = async (req, res) => {
    try {
        const token = String(req.query?.token || '').trim();
        if (!token) {
            return res.status(400).json({
                mensaje: "Token de verificacion requerido",
                message: "Verification token is required",
            });
        }

        const result = await verifyEmailToken('usuario', token);
        if (!result.ok) {
            return res.status(result.status).json({
                mensaje: result.message,
                message: result.message,
            });
        }

        return res.json({
            mensaje: "Correo verificado correctamente",
            message: "Email verified successfully",
            data: result.data,
        });
    } catch (err) {
        console.error('Error verificando email de usuario:', err);
        return res.status(500).json({ mensaje: "Error interno", message: "Internal server error" });
    }
};

exports.solicitarRecuperacionPassword = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const result = await requestPasswordReset('usuario', email);
        if (!result.ok) {
            return res.status(result.status).json({
                mensaje: result.message,
                message: result.message,
            });
        }

        return res.json({
            mensaje: 'Si el correo existe, enviaremos un enlace para restablecer la contrasena.',
            message: 'If the email exists, a password reset link will be sent.',
            ...(process.env.NODE_ENV === 'test'
                ? {
                    reset_preview_token: result.token,
                    reset_preview_url: result.resetUrl,
                }
                : {}),
        });
    } catch (err) {
        console.error('Error solicitando recuperacion de password usuario:', err);
        return res.status(500).json({ mensaje: "Error interno", message: "Internal server error" });
    }
};

exports.resetearPassword = async (req, res) => {
    try {
        const token = String(req.body?.token || '').trim();
        const password = String(req.body?.password || req.body?.newPassword || '');
        const result = await resetPassword('usuario', token, password);
        if (!result.ok) {
            return res.status(result.status).json({
                mensaje: result.message,
                message: result.message,
            });
        }

        return res.json({
            mensaje: 'Contrasena actualizada correctamente',
            message: 'Password updated successfully',
        });
    } catch (err) {
        console.error('Error reseteando password usuario:', err);
        return res.status(500).json({ mensaje: "Error interno", message: "Internal server error" });
    }
};

exports.perfil = (req, res) => {
    const userId = Number(req.auth?.actorId || 0);
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
            rol: usuario.rol || 'user',
            email_verificado: Boolean(usuario.email_verificado),
            creado_en: usuario.creado_en,
        });
    });
};

exports.actualizarPerfil = (req, res) => {
    const userId = Number(req.auth?.actorId || 0);
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
            return res.status(400).json({
                mensaje: "El correo ya esta registrado",
                message: "Email already registered",
            });
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
    const userId = Number(req.auth?.actorId || 0);
    if (!userId) {
        return res.status(401).json({ mensaje: "No autorizado", message: "Unauthorized" });
    }

    const actual = String(req.body?.password_actual || '');
    const nueva = String(req.body?.password_nueva || '');

    if (!actual || !nueva) {
        return res.status(400).json({
            mensaje: "Debes enviar password actual y nueva",
            message: "Current and new password are required",
        });
    }

    if (nueva.length < 6) {
        return res.status(400).json({
            mensaje: "La nueva contrasena debe tener al menos 6 caracteres",
            message: "New password must be at least 6 characters",
        });
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
            return res.status(401).json({
                mensaje: "Contrasena actual incorrecta",
                message: "Current password is incorrect",
            });
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
