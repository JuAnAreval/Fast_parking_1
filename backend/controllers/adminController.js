const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { signAdminToken } = require('../middlewares/auth');
const { sendMail } = require('../services/emailService');

const toPositiveInt = (value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
};

const listUsuariosSql = `
    SELECT
        id,
        nombre,
        email,
        telefono,
        rol,
        email_verificado,
        email_verificado_en,
        creado_en
    FROM usuarios
    ORDER BY creado_en DESC
`;

const listParqueaderosSql = `
    SELECT
        id,
        nombre,
        direccion,
        cupos,
        disponible,
        email,
        latitud,
        longitud,
        email_verificado,
        email_verificado_en,
        creado_en
    FROM parqueaderos
    ORDER BY creado_en DESC
`;

exports.loginAdmin = (req, res) => {
    let { email, password } = req.body;
    if (typeof email === 'string') {
        email = email.trim().toLowerCase();
    }

    if (!email || !password) {
        return res.status(400).json({
            mensaje: 'Email y password son requeridos',
            message: 'Email and password are required',
        });
    }

    db.query(
        'SELECT * FROM usuarios WHERE email = ? AND rol = ? LIMIT 1',
        [email, 'admin'],
        (err, results) => {
            if (err) {
                console.error('Error buscando admin:', err);
                return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
            }

            if (!results || results.length === 0) {
                return res.status(404).json({
                    mensaje: 'Administrador no encontrado',
                    message: 'Admin user not found',
                });
            }

            const admin = results[0];
            const passwordValida = bcrypt.compareSync(password, admin.password);
            if (!passwordValida) {
                return res.status(401).json({
                    mensaje: 'Contrasena incorrecta',
                    message: 'Incorrect password',
                });
            }

            if (!admin.email_verificado) {
                return res.status(403).json({
                    mensaje: 'Debes verificar el correo del administrador antes de iniciar sesion',
                    message: 'Admin email must be verified before logging in',
                    code: 'EMAIL_NOT_VERIFIED',
                });
            }

            const token = signAdminToken(admin);
            return res.json({
                mensaje: 'Login admin exitoso',
                message: 'Admin login successful',
                token,
                admin: {
                    id: admin.id,
                    nombre: admin.nombre,
                    email: admin.email,
                    rol: admin.rol,
                },
            });
        },
    );
};

exports.listarUsuarios = (_req, res) => {
    db.query(listUsuariosSql, (err, results) => {
        if (err) {
            console.error('Error listando usuarios admin:', err);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }
        return res.json(results || []);
    });
};

exports.actualizarUsuario = (req, res) => {
    const id = toPositiveInt(req.params.id);
    const rol = String(req.body?.rol || '').trim().toLowerCase();
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : null;
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;
    const telefono = typeof req.body?.telefono === 'string' ? req.body.telefono.trim() : null;
    const emailVerificado = req.body?.email_verificado === true || req.body?.email_verificado === 1;

    if (!id) {
        return res.status(400).json({ mensaje: 'ID de usuario invalido', message: 'Invalid user id' });
    }

    if (rol && !['user', 'admin'].includes(rol)) {
        return res.status(400).json({ mensaje: 'Rol invalido', message: 'Invalid role' });
    }

    const updates = ['email_verificado = ?', 'email_verificado_en = ?'];
    const params = [emailVerificado ? 1 : 0, emailVerificado ? new Date() : null];

    if (nombre !== null) {
        if (!nombre) {
            return res.status(400).json({ mensaje: 'Nombre requerido', message: 'Name is required' });
        }
        updates.push('nombre = ?');
        params.push(nombre);
    }

    if (email !== null) {
        if (!email) {
            return res.status(400).json({ mensaje: 'Correo requerido', message: 'Email is required' });
        }
        updates.push('email = ?');
        params.push(email);
    }

    if (telefono !== null) {
        updates.push('telefono = ?');
        params.push(telefono || null);
    }

    if (rol) {
        updates.push('rol = ?');
        params.push(rol);
    }

    updates.push('verification_token_hash = NULL', 'verification_token_expires_at = NULL');
    params.push(id);

    db.query(
        `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`,
        params,
        (err, result) => {
            if (err) {
                console.error('Error actualizando usuario admin:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ mensaje: 'El correo ya esta registrado', message: 'Email already registered' });
                }
                return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
            }
            if (!result || result.affectedRows === 0) {
                return res.status(404).json({ mensaje: 'Usuario no encontrado', message: 'User not found' });
            }
            return res.json({ mensaje: 'Usuario actualizado', message: 'User updated' });
        },
    );
};

exports.eliminarUsuario = (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (!id) {
        return res.status(400).json({ mensaje: 'ID de usuario invalido', message: 'Invalid user id' });
    }

    if (req.auth?.actorId === id) {
        return res.status(400).json({
            mensaje: 'No puedes eliminar tu propia cuenta administradora',
            message: 'You cannot delete your own admin account',
        });
    }

    db.query('DELETE FROM usuarios WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.error('Error eliminando usuario admin:', err);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }

        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado', message: 'User not found' });
        }

        return res.json({ mensaje: 'Usuario eliminado', message: 'User deleted' });
    });
};

exports.listarParqueaderos = (_req, res) => {
    db.query(listParqueaderosSql, (err, results) => {
        if (err) {
            console.error('Error listando parqueaderos admin:', err);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }
        return res.json(results || []);
    });
};

exports.actualizarParqueadero = (req, res) => {
    const id = toPositiveInt(req.params.id);
    const emailVerificado = req.body?.email_verificado === true || req.body?.email_verificado === 1;
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : null;
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;
    const direccion = typeof req.body?.direccion === 'string' ? req.body.direccion.trim() : null;
    const cupos = req.body?.cupos !== undefined ? toPositiveInt(req.body.cupos) : null;
    const disponible =
        req.body?.disponible === true || req.body?.disponible === 1
            ? 1
            : req.body?.disponible === false || req.body?.disponible === 0
                ? 0
                : null;

    if (!id) {
        return res.status(400).json({ mensaje: 'ID de parqueadero invalido', message: 'Invalid parking id' });
    }

    if (req.body?.cupos !== undefined && !cupos) {
        return res.status(400).json({ mensaje: 'Cupos invalidos', message: 'Invalid capacity' });
    }

    const updates = [
        'email_verificado = ?',
        'email_verificado_en = ?',
        'verification_token_hash = NULL',
        'verification_token_expires_at = NULL',
    ];
    const params = [emailVerificado ? 1 : 0, emailVerificado ? new Date() : null];

    if (nombre !== null) {
        if (!nombre) {
            return res.status(400).json({ mensaje: 'Nombre requerido', message: 'Name is required' });
        }
        updates.push('nombre = ?');
        params.push(nombre);
    }

    if (email !== null) {
        if (!email) {
            return res.status(400).json({ mensaje: 'Correo requerido', message: 'Email is required' });
        }
        updates.push('email = ?');
        params.push(email);
    }

    if (direccion !== null) {
        if (!direccion) {
            return res.status(400).json({ mensaje: 'Direccion requerida', message: 'Address is required' });
        }
        updates.push('direccion = ?');
        params.push(direccion);
    }

    if (cupos !== null) {
        updates.push('cupos = ?');
        params.push(cupos);
    }

    if (disponible !== null) {
        updates.push('disponible = ?');
        params.push(disponible);
    }

    params.push(id);

    db.query(
        `UPDATE parqueaderos SET ${updates.join(', ')} WHERE id = ?`,
        params,
        (err, result) => {
            if (err) {
                console.error('Error actualizando parqueadero admin:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ mensaje: 'El correo ya esta registrado', message: 'Email already registered' });
                }
                return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
            }
            if (!result || result.affectedRows === 0) {
                return res.status(404).json({ mensaje: 'Parqueadero no encontrado', message: 'Parking not found' });
            }
            return res.json({ mensaje: 'Parqueadero actualizado', message: 'Parking updated' });
        },
    );
};

exports.eliminarParqueadero = (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (!id) {
        return res.status(400).json({ mensaje: 'ID de parqueadero invalido', message: 'Invalid parking id' });
    }

    db.query('DELETE FROM parqueaderos WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.error('Error eliminando parqueadero admin:', err);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }

        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Parqueadero no encontrado', message: 'Parking not found' });
        }

        return res.json({ mensaje: 'Parqueadero eliminado', message: 'Parking deleted' });
    });
};

exports.probarCorreo = async (req, res) => {
    const to = String(req.body?.to || '').trim();
    if (!to) {
        return res.status(400).json({
            mensaje: 'Debes enviar el correo destino',
            message: 'Destination email is required',
        });
    }

    try {
        const result = await sendMail({
            to,
            subject: 'Prueba de correo Fast Parking',
            text: 'Este es un correo de prueba de Fast Parking.',
            html: `
                <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
                    <h2>Prueba de correo Fast Parking</h2>
                    <p>Si recibiste este correo, la configuracion de Brevo esta funcionando.</p>
                </div>
            `,
        });

        return res.json({
            mensaje: 'Prueba de correo procesada',
            message: 'Test email processed',
            result,
        });
    } catch (err) {
        console.error('Error enviando correo de prueba admin:', err);
        return res.status(502).json({
            mensaje: 'No se pudo enviar el correo de prueba',
            message: 'Test email could not be sent',
            error: {
                message: err.message,
                code: err.code,
                status: err.status,
                response: err.response,
            },
        });
    }
};
