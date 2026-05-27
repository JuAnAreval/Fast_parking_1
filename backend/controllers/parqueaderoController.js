const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { ACTOR_TYPES, signParqueaderoToken } = require('../middlewares/auth');
const { issueVerificationForRecord, verifyEmailToken } = require('../services/verificationService');
const { requestPasswordReset, resetPassword } = require('../services/passwordResetService');

const toPositiveInt = (value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
};

const toNullableNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    if (Number.isNaN(n)) return null;
    return n;
};

const toNonNegativeInt = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n));
};

const normalizeTiposVehiculoHabilitados = (value) => {
    if (Array.isArray(value)) {
        return [...new Set(value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))];
    }

    return [...new Set(
        String(value || '')
            .split(',')
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean),
    )];
};

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

// Obtener lista de parqueaderos
exports.getParqueaderos = (req, res) => {
    const sql = `
        SELECT
            p.id,
            p.nombre,
            p.direccion,
            p.cupos,
            p.disponible,
            p.latitud,
            p.longitud,
            GROUP_CONCAT(
                DISTINCT CASE
                    WHEN COALESCE(t.tarifa_primera_hora, 0) > 0
                     AND COALESCE(t.tarifa_hora_adicional, 0) > 0
                    THEN LOWER(t.tipo_vehiculo)
                    ELSE NULL
                END
                ORDER BY t.tipo_vehiculo
                SEPARATOR ','
            ) AS tipos_vehiculo_habilitados
        FROM parqueaderos p
        LEFT JOIN tarifas t ON t.parqueadero_id = p.id
        GROUP BY
            p.id,
            p.nombre,
            p.direccion,
            p.cupos,
            p.disponible,
            p.latitud,
            p.longitud
    `;
    db.query(sql, (err, results) => {
        if (err) {
            const fallbackSql = 'SELECT id, nombre, direccion, cupos, disponible, latitud, longitud FROM parqueaderos';
            return db.query(fallbackSql, (fallbackErr, fallbackResults) => {
                if (fallbackErr) {
                    console.error('Error al obtener parqueaderos:', fallbackErr);
                    return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                }

                const data = (fallbackResults || []).map((row) => ({
                    ...row,
                    tipos_vehiculo_habilitados: [],
                }));
                return res.json(data);
            });
        }
        const data = (results || []).map((row) => ({
            ...row,
            tipos_vehiculo_habilitados: normalizeTiposVehiculoHabilitados(row.tipos_vehiculo_habilitados),
        }));
        return res.json(data);
    });
};

// Obtener un parqueadero especÃ­fico
exports.getParqueadero = (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (!id) {
        return res.status(400).json({ mensaje: 'ID de parqueadero invÃ¡lido', message: 'Invalid parking id' });
    }
    const isOwner =
        req.auth?.actorType === ACTOR_TYPES.PARQUEADERO &&
        req.auth?.actorId === id;
    const sql = isOwner
        ? 'SELECT id, nombre, direccion, cupos, disponible, email, latitud, longitud FROM parqueaderos WHERE id = ?'
        : 'SELECT id, nombre, direccion, cupos, latitud, longitud FROM parqueaderos WHERE id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error('Error al obtener parqueadero:', err);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ mensaje: 'Parqueadero no encontrado', message: 'Parking not found' });
        }
        // Normalizar campos de cupos para soportar variantes en el esquema (legacy vs nuevo)
        const p = results[0];
        // Si existen columnas nuevas cupos_totales/cupos_disponibles, preferirlas; si no, mapear cupos -> cupos_totales
        if (p.cupos_totales == null && p.cupos != null) {
            p.cupos_totales = p.cupos;
            // Si no existe cupos_disponibles, inicializarlo igual a cupos (asunciÃ³n segura)
            if (p.cupos_disponibles == null) p.cupos_disponibles = p.cupos;
        }

        res.json(p);
    });
};

// Actualizar parqueadero
exports.updateParqueadero = (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (!id) {
        return res.status(400).json({ mensaje: 'ID de parqueadero invÃ¡lido', message: 'Invalid parking id' });
    }

    // Soporte para dos formatos diferentes en el frontend:
    // - { nombre, direccion, cupos } (used by some pages)
    // - { nombre, direccion, cupos_totales, cupos_disponibles } (used by ConfiguracionParqueadero)
    const {
        nombre,
        direccion,
        cupos,
        cupos_totales,
        cupos_disponibles,
        latitud,
        longitud,
    } = req.body;

    if (!nombre || !direccion) {
        return res.status(400).json({ mensaje: 'Nombre y direcciÃ³n son requeridos', message: 'Name and address are required' });
    }

    // Compatibilidad de payload: tomamos cupos_totales como cupos cuando aplica
    const cuposRaw = cupos_totales != null ? cupos_totales : cupos;
    const cuposValue = cuposRaw != null ? toPositiveInt(cuposRaw) : null;
    const hasLatitud = latitud !== undefined;
    const hasLongitud = longitud !== undefined;
    const latitudValue = hasLatitud ? toNullableNumber(latitud) : null;
    const longitudValue = hasLongitud ? toNullableNumber(longitud) : null;

    if (cupos_totales != null && cupos_disponibles != null && Number(cupos_disponibles) > Number(cupos_totales)) {
        return res.status(400).json({
            mensaje: 'Los cupos disponibles no pueden ser mayores que los cupos totales',
            message: 'Available spots cannot be greater than total spots',
        });
    }

    if (cuposRaw != null && !cuposValue) {
        return res.status(400).json({ mensaje: 'Cupos invÃ¡lidos', message: 'Invalid capacity' });
    }

    if (hasLatitud && latitudValue === null) {
        return res.status(400).json({ mensaje: 'Latitud invÃ¡lida', message: 'Invalid latitude' });
    }

    if (hasLongitud && longitudValue === null) {
        return res.status(400).json({ mensaje: 'Longitud invÃ¡lida', message: 'Invalid longitude' });
    }

    if (hasLatitud && (latitudValue < -90 || latitudValue > 90)) {
        return res.status(400).json({ mensaje: 'Latitud fuera de rango', message: 'Latitude out of range' });
    }

    if (hasLongitud && (longitudValue < -180 || longitudValue > 180)) {
        return res.status(400).json({ mensaje: 'Longitud fuera de rango', message: 'Longitude out of range' });
    }

    const setFields = ['nombre = ?', 'direccion = ?'];
    const params = [nombre, direccion];

    if (cuposValue != null) {
        setFields.push('cupos = ?');
        params.push(cuposValue);
    }

    if (hasLatitud) {
        setFields.push('latitud = ?');
        params.push(latitudValue);
    }

    if (hasLongitud) {
        setFields.push('longitud = ?');
        params.push(longitudValue);
    }

    const sql = `UPDATE parqueaderos SET ${setFields.join(', ')} WHERE id = ?`;
    params.push(id);

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error('Error al actualizar parqueadero:', err);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Parqueadero no encontrado', message: 'Parking not found' });
        }
        res.json({ mensaje: 'Parqueadero actualizado con Ã©xito', message: 'Parking updated successfully' });
    });
};

// Actualizar tarifas de un parqueadero
exports.updateTarifas = (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (!id) {
        return res.status(400).json({ mensaje: 'ID de parqueadero invÃ¡lido', message: 'Invalid parking id' });
    }
    const { tarifas } = req.body;

    if (!tarifas || !Array.isArray(tarifas)) {
        return res.status(400).json({ mensaje: 'Formato de tarifas invÃ¡lido', message: 'Invalid tariffs format' });
    }

    // Normalize tarifa values: accept new structure with primera_hora and hora_adicional
    const normalized = tarifas.map(t => {
        return {
            tipo_vehiculo: t.tipo_vehiculo,
            tarifa_primera_hora: toNonNegativeInt(t.tarifa_primera_hora ?? t.tarifa_hora ?? t.valor ?? 0),
            tarifa_hora_adicional: toNonNegativeInt(t.tarifa_hora_adicional ?? t.tarifa_hora ?? t.valor ?? 0),
        };
    });

    // Validar que las tarifas tengan los campos requeridos y valores vÃ¡lidos
    for (const tarifa of normalized) {
        if (!tarifa.tipo_vehiculo || !Number.isInteger(tarifa.tarifa_primera_hora) || !Number.isInteger(tarifa.tarifa_hora_adicional) || tarifa.tarifa_primera_hora < 0 || tarifa.tarifa_hora_adicional < 0) {
            return res.status(400).json({
                mensaje: 'Cada tarifa debe tener tipo_vehiculo y valores vÃ¡lidos',
                message: 'Each tariff must have a vehicle type and valid values'
            });
        }
    }

    // Primero verificamos que el parqueadero existe
    db.query('SELECT id FROM parqueaderos WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error('Error al verificar parqueadero:', err);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ mensaje: 'Parqueadero no encontrado', message: 'Parking not found' });
        }

        // Usamos una conexiÃ³n dedicada del pool para no mezclar esta transacciÃ³n con otras peticiones.
        db.getConnection((connErr, connection) => {
            if (connErr) {
                console.error('Error al obtener conexiÃ³n para transacciÃ³n:', connErr);
                return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
            }

            let released = false;
            const releaseConnection = () => {
                if (!released) {
                    released = true;
                    connection.release();
                }
            };

            connection.beginTransaction(err => {
                if (err) {
                    releaseConnection();
                    console.error('Error al iniciar transacciÃ³n:', err);
                    return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                }

                // Primero eliminamos las tarifas existentes
                connection.query('DELETE FROM tarifas WHERE parqueadero_id = ?', [id], (err) => {
                    if (err) {
                        return connection.rollback(() => {
                            releaseConnection();
                            console.error('Error al eliminar tarifas:', err);
                            res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                        });
                    }

                    // Preparamos la consulta para insertar mÃºltiples tarifas
                    const values = normalized.map(t => [id, t.tipo_vehiculo, t.tarifa_primera_hora, t.tarifa_hora_adicional]);
                    const sql = 'INSERT INTO tarifas (parqueadero_id, tipo_vehiculo, tarifa_primera_hora, tarifa_hora_adicional) VALUES ?';

                    connection.query(sql, [values], (err) => {
                        if (err) {
                            return connection.rollback(() => {
                                releaseConnection();
                                console.error('Error al insertar tarifas:', err);
                                res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                            });
                        }

                        // Confirmamos la transacciÃ³n
                        connection.commit(err => {
                            if (err) {
                                return connection.rollback(() => {
                                    releaseConnection();
                                    console.error('Error al confirmar transacciÃ³n:', err);
                                    res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                                });
                            }

                            releaseConnection();
                            res.json({ mensaje: 'Tarifas actualizadas con Ã©xito', message: 'Tariffs updated successfully' });
                        });
                    });
                });
            });
        });
    });
};

// Registrar parqueadero (ahora con email y password hasheada)
exports.registerParqueadero = (req, res) => {
    let { nombre, direccion, cupos, email, password, latitud, longitud } = req.body;

    // Normalizar email
    if (email && typeof email === 'string') {
        email = email.trim().toLowerCase();
    }

    if (!nombre || !direccion || cupos == null || !email || !password) {
        return res.status(400).json({ mensaje: 'Todos los campos son requeridos', message: 'All fields are required' });
    }

    const cuposValue = toPositiveInt(cupos);
    if (!cuposValue) {
        return res.status(400).json({ mensaje: 'Cupos invÃ¡lidos', message: 'Invalid capacity' });
    }

    // Compatibilidad: clientes legacy pueden no enviar coordenadas.
    const latitudValue = toNullableNumber(latitud) ?? 0;
    const longitudValue = toNullableNumber(longitud) ?? 0;

    // Hashear la contraseÃ±a antes de insertar
    const saltRounds = 10;
    bcrypt.hash(password, saltRounds, (hashErr, hashedPassword) => {
        if (hashErr) {
            console.error('Error hashing password:', hashErr);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }

        const sql = `
            INSERT INTO parqueaderos (
                nombre,
                direccion,
                cupos,
                email,
                password,
                latitud,
                longitud,
                email_verificado,
                verification_token_hash,
                verification_token_expires_at,
                email_verificado_en
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL)
        `;
        const params = [nombre, direccion, cuposValue, email, hashedPassword, latitudValue, longitudValue];

        db.query(sql, params, async (err, result) => {
            if (err) {
                console.error('Error al insertar parqueadero:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ mensaje: 'El correo ya esta registrado', message: 'Email already registered' });
                }
                return res.status(500).json({ mensaje: 'Error al registrar parqueadero', message: 'Error registering parking' });
            }

            try {
                const verification = await issueVerificationForRecord('parqueadero', {
                    id: result?.insertId,
                    nombre,
                    email,
                });

                return res.status(201).json(
                    includeVerificationPreview(
                        {
                            mensaje: 'Parqueadero registrado con exito. Revisa tu correo para verificar la cuenta.',
                            message: 'Parking registered successfully. Check your email to verify the account.',
                            id: result.insertId,
                        },
                        verification,
                    ),
                );
            } catch (verificationErr) {
                console.error('Error preparando verificacion de parqueadero:', verificationErr);
                return res.status(201).json({
                    mensaje: 'Parqueadero registrado con exito, pero no se pudo enviar el correo de verificacion.',
                    message: 'Parking registered successfully, but verification email could not be sent.',
                    id: result.insertId,
                });
            }
        });
    });
};

// Actualizar disponibilidad manual
exports.updateDisponibilidad = (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (!id) {
        return res.status(400).json({ mensaje: 'ID de parqueadero invÃ¡lido', message: 'Invalid parking id' });
    }
    const { disponible } = req.body;

    db.query(
        'UPDATE parqueaderos SET disponible = ? WHERE id = ?',
        [disponible, id],
        (err, result) => {
            if (err) {
                console.error('Error:', err);
                return res.status(500).json({ mensaje: 'Error al actualizar disponibilidad', message: 'Error updating availability' });
            }
            res.json({ mensaje: 'Disponibilidad actualizada', message: 'Availability updated' });
        }
    );
};

// Obtener tarifas de un parqueadero
exports.getTarifas = (req, res) => {
    const id = toPositiveInt(req.params.id);
    if (!id) {
        return res.status(400).json({ mensaje: 'ID de parqueadero invÃ¡lido', message: 'Invalid parking id' });
    }

    // Incluye alias tarifa_hora para compatibilidad con clientes legacy.
    const sql = `
        SELECT
            tipo_vehiculo,
            tarifa_primera_hora,
            tarifa_hora_adicional,
            tarifa_primera_hora AS tarifa_hora
        FROM tarifas
        WHERE parqueadero_id = ?
    `;
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error('Error al obtener tarifas:', err);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }
        res.json(results);
    });
};

// Login de parqueadero (por email + password)
exports.loginParqueadero = (req, res) => {
    let { email, password } = req.body;

    if (email && typeof email === 'string') {
        email = email.trim().toLowerCase();
    }

    if (!email || !password) {
        return res.status(400).json({ mensaje: 'Email y password son requeridos', message: 'Email and password are required' });
    }

    db.query('SELECT * FROM parqueaderos WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error('Error buscando parqueadero:', err);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }

        if (!results || results.length === 0) {
            // Mensaje solicitado por el usuario: sugerir registrarse
            return res.status(404).json({ mensaje: 'No estÃ¡ tu parqueadero registrado, hazlo aquÃ­', message: 'Your parking is not registered, register it here' });
        }

        const parqueadero = results[0];

        bcrypt.compare(password, parqueadero.password, (compareErr, isMatch) => {
            if (compareErr) {
                console.error('Error comparando password:', compareErr);
                return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
            }

            if (!isMatch) {
                return res.status(401).json({ mensaje: 'ContraseÃ±a incorrecta', message: 'Incorrect password' });
            }

            if (!parqueadero.email_verificado) {
                return res.status(403).json({
                    mensaje: 'Debes verificar tu correo antes de iniciar sesion',
                    message: 'You must verify your email before logging in',
                    code: 'EMAIL_NOT_VERIFIED',
                });
            }

            // Generar token JWT con id del parqueadero (u otros claims necesarios)
            const token = signParqueaderoToken(parqueadero);

            res.json({ mensaje: 'Login exitoso', message: 'Login successful', token, parqueadero: { id: parqueadero.id, nombre: parqueadero.nombre, email: parqueadero.email } });
        });
    });
};

exports.verificarEmail = async (req, res) => {
    try {
        const token = String(req.query?.token || '').trim();
        if (!token) {
            return res.status(400).json({
                mensaje: 'Token de verificacion requerido',
                message: 'Verification token is required',
            });
        }

        const result = await verifyEmailToken('parqueadero', token);
        if (!result.ok) {
            return res.status(result.status).json({
                mensaje: result.message,
                message: result.message,
            });
        }

        return res.json({
            mensaje: 'Correo verificado correctamente',
            message: 'Email verified successfully',
            data: result.data,
        });
    } catch (err) {
        console.error('Error verificando email de parqueadero:', err);
        return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
    }
};

exports.solicitarRecuperacionPassword = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const result = await requestPasswordReset('parqueadero', email);
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
        console.error('Error solicitando recuperacion de password parqueadero:', err);
        return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
    }
};

exports.resetearPassword = async (req, res) => {
    try {
        const token = String(req.body?.token || '').trim();
        const password = String(req.body?.password || req.body?.newPassword || '');
        const result = await resetPassword('parqueadero', token, password);
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
        console.error('Error reseteando password parqueadero:', err);
        return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
    }
};

