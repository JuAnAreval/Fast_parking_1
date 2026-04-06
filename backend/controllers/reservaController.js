const db = require('../config/db');
const { ACTOR_TYPES, verifyAccessToken } = require('../middlewares/auth');
const RESERVA_STREAM_KEEPALIVE_MS = 25000;
const reservaStreamClients = new Map();
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Bogota';

const round2 = (value) => Number(Number(value || 0).toFixed(2));
const minutesToHours = (minutes) => round2(Number(minutes || 0) / 60);

const milisegundosToBillableMinutes = (milisegundos) => {
    const ms = Number(milisegundos || 0);
    if (ms <= 0) return 0;
    return Math.max(1, Math.ceil(ms / 60000));
};

const segundosToBillableMinutes = (segundos) => {
    const sec = Number(segundos || 0);
    if (sec <= 0) return 1;
    return Math.max(1, Math.ceil(sec / 60));
};

const toPositiveInt = (value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
};

const toNonNegativeInt = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n));
};

const formatDateTimePartsInAppTimezone = (date) => {
    const baseOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        hourCycle: 'h23',
    };

    const partsToMap = (options) => {
        const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(date);
        const mapped = {};
        for (const part of parts) {
            if (part.type !== 'literal') mapped[part.type] = part.value;
        }
        return mapped;
    };

    try {
        return partsToMap({ ...baseOptions, timeZone: APP_TIMEZONE });
    } catch (_) {
        return partsToMap(baseOptions);
    }
};

const getNowInAppTimezone = (minutesToAdd = 0) => {
    const date = new Date(Date.now() + (Number(minutesToAdd || 0) * 60000));
    const parts = formatDateTimePartsInAppTimezone(date);
    const dateOnly = `${parts.year}-${parts.month}-${parts.day}`;
    const timeOnly = `${parts.hour}:${parts.minute}:${parts.second}`;
    return {
        date: dateOnly,
        time: timeOnly,
        iso: `${dateOnly}T${timeOnly}`,
    };
};

const calcularValorEstimadoPorMinutos = (minutos, tarifaPrimeraHora, tarifaHoraAdicional) => {
    const minutosNumericos = Number(minutos || 0);
    const primeraHora = toNonNegativeInt(tarifaPrimeraHora);
    const horaAdicional = toNonNegativeInt(tarifaHoraAdicional);

    if (minutosNumericos <= 0) return 0;
    // De 1 a 60 minutos siempre se cobra primera hora.
    if (minutosNumericos <= 60) return round2(primeraHora);

    // Despues de la primera hora, se cobra por cada bloque/fraccion de 60 minutos.
    const bloquesAdicionales = Math.ceil((minutosNumericos - 60) / 60);
    return round2(primeraHora + (bloquesAdicionales * horaAdicional));
};


const getTarifaParqueadero = (parqueaderoId, tipoVehiculo, callback) => {
    db.query(
        'SELECT tarifa_primera_hora, tarifa_hora_adicional FROM tarifas WHERE parqueadero_id = ? AND tipo_vehiculo = ? LIMIT 1',
        [parqueaderoId, tipoVehiculo],
        (err, results) => {
            if (err) return callback(err);
            if (!results || results.length === 0) {
                return callback(null, {
                    tarifa_primera_hora: 0,
                    tarifa_hora_adicional: 0,
                    missing: true,
                });
            }
            return callback(null, {
                tarifa_primera_hora: toNonNegativeInt(results[0].tarifa_primera_hora || 0),
                tarifa_hora_adicional: toNonNegativeInt(results[0].tarifa_hora_adicional || 0),
                missing: false,
            });
        },
    );
};

const TIPOS_VEHICULO = new Set(['carro', 'moto', 'bicicleta', 'camion', 'ambulancia']);
const isVehiculoSchemaError = (err) =>
    err &&
    (err.code === 'ER_BAD_FIELD_ERROR' || err.code === 'ER_NO_SUCH_TABLE');
const isTelefonoColumnError = (err) =>
    err &&
    err.code === 'ER_BAD_FIELD_ERROR' &&
    /telefono/i.test(String(err.sqlMessage || err.message || ''));

const sanitizeVehiculoPlaca = (tipo, placa) => {
    if (String(tipo || '').toLowerCase() === 'bicicleta') {
        return '';
    }
    return placa || null;
};

const sanitizeVehiculoRecord = (vehiculo) => {
    if (!vehiculo || typeof vehiculo !== 'object') return vehiculo;

    return {
        ...vehiculo,
        placa: sanitizeVehiculoPlaca(vehiculo.tipo, vehiculo.placa),
    };
};

const sanitizeReservaVehiculoData = (reserva) => {
    if (!reserva || typeof reserva !== 'object') return reserva;

    const data = { ...reserva };
    if ('vehiculo_placa' in data) {
        data.vehiculo_placa = sanitizeVehiculoPlaca(
            data.vehiculo_tipo || data.tipo_vehiculo,
            data.vehiculo_placa,
        );
    }
    return data;
};

const getVehiculoUsuario = (usuarioId, vehiculoId, callback) => {
    db.query(
        `
            SELECT id, usuario_id, tipo, placa, color
            FROM vehiculos
            WHERE id = ? AND usuario_id = ?
            LIMIT 1
        `,
        [vehiculoId, usuarioId],
        (err, results) => {
            if (err) return callback(err);
            if (!results || results.length === 0) {
                return callback(null, null);
            }
            return callback(null, sanitizeVehiculoRecord(results[0]));
        },
    );
};

const getReservaOwnerContext = (req) => {
    const actorId = toPositiveInt(req.auth?.actorId);
    if (!actorId) return null;

    if (req.auth?.actorType === ACTOR_TYPES.USUARIO) {
        return { actorId, ownerColumn: 'usuario_id' };
    }

    if (req.auth?.actorType === ACTOR_TYPES.PARQUEADERO) {
        return { actorId, ownerColumn: 'parqueadero_id' };
    }

    return null;
};

const reserveParkingSpot = (parqueaderoId, callback) => {
    db.query(
        'UPDATE parqueaderos SET cupos = cupos - 1 WHERE id = ? AND cupos > 0',
        [parqueaderoId],
        (err, result) => {
            if (err) return callback(err);
            if (!result || result.affectedRows === 0) {
                return callback({
                    status: 409,
                    body: {
                        mensaje: 'No hay cupos disponibles en este parqueadero',
                        message: 'No available spots in this parking',
                    },
                });
            }
            return callback(null);
        },
    );
};

const releaseParkingSpot = (parqueaderoId, callback) => {
    db.query(
        'UPDATE parqueaderos SET cupos = cupos + 1 WHERE id = ?',
        [parqueaderoId],
        (err) => callback(err || null),
    );
};

const sseWrite = (res, event, payload) => {
    try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (_) {}
};

const addReservaStreamClient = (parqueaderoId, client) => {
    const clients = reservaStreamClients.get(parqueaderoId) || new Set();
    clients.add(client);
    reservaStreamClients.set(parqueaderoId, clients);
};

const removeReservaStreamClient = (parqueaderoId, client) => {
    const clients = reservaStreamClients.get(parqueaderoId);
    if (!clients) return;
    clients.delete(client);
    if (clients.size === 0) {
        reservaStreamClients.delete(parqueaderoId);
    }
};

const emitReservaEvent = (parqueaderoId, event, payload) => {
    const id = toPositiveInt(parqueaderoId);
    if (!id) return;

    const clients = reservaStreamClients.get(id);
    if (!clients || clients.size === 0) return;

    for (const client of clients) {
        sseWrite(client, event, payload);
    }
};

// Stream SSE para notificar reservas en tiempo real al panel web del parqueadero.
exports.streamReservasParqueadero = (req, res) => {
    const parqueaderoId = toPositiveInt(req.params.parqueaderoId);
    if (!parqueaderoId) {
        return res.status(400).json({ mensaje: 'ID de parqueadero invÃ¡lido', message: 'Invalid parking id' });
    }

    const token = String(req.query?.token || '');
    if (!token) {
        return res.status(401).json({ mensaje: 'Token requerido', message: 'Token required' });
    }

    let auth;
    try {
        auth = verifyAccessToken(token);
    } catch (_) {
        return res.status(401).json({ mensaje: 'Token invÃ¡lido', message: 'Invalid token' });
    }

    const tokenParqueaderoId = toPositiveInt(auth?.actorId);
    if (!tokenParqueaderoId || auth?.actorType !== ACTOR_TYPES.PARQUEADERO || tokenParqueaderoId !== parqueaderoId) {
        return res.status(403).json({ mensaje: 'No autorizado para este parqueadero', message: 'Not authorized for this parking' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
    }

    // Indica al cliente SSE reconexion rapida si hay corte.
    res.write('retry: 1000\n\n');
    sseWrite(res, 'connected', { ok: true, parqueadero_id: parqueaderoId });
    addReservaStreamClient(parqueaderoId, res);

    const keepAlive = setInterval(() => {
        sseWrite(res, 'keepalive', { ts: Date.now() });
    }, RESERVA_STREAM_KEEPALIVE_MS);

    req.on('close', () => {
        clearInterval(keepAlive);
        removeReservaStreamClient(parqueaderoId, res);
    });
};

// Obtener reservas de un usuario
exports.getReservasUsuario = (req, res) => {
    const usuarioId = toPositiveInt(req.params.usuarioId);
    if (!usuarioId) {
        return res.status(400).json({ mensaje: 'ID de usuario invÃ¡lido', message: 'Invalid user id' });
    }

    const sql = `
        SELECT
            r.*,
            r.creado_en AS fecha_creacion,
            p.nombre AS parqueadero_nombre,
            p.direccion,
            p.latitud,
            p.longitud,
            v.id AS vehiculo_id,
            v.tipo AS vehiculo_tipo,
            v.placa AS vehiculo_placa,
            v.color AS vehiculo_color
        FROM reservas r
        JOIN parqueaderos p ON r.parqueadero_id = p.id
        LEFT JOIN vehiculos v ON r.vehiculo_id = v.id
        WHERE r.usuario_id = ?
        ORDER BY r.creado_en DESC
    `;

    db.query(sql, [usuarioId], (err, results) => {
        if (err && isVehiculoSchemaError(err)) {
            const fallbackSql = `
                SELECT
                    r.*,
                    r.creado_en AS fecha_creacion,
                    p.nombre AS parqueadero_nombre,
                    p.direccion,
                    p.latitud,
                    p.longitud
                FROM reservas r
                JOIN parqueaderos p ON r.parqueadero_id = p.id
                WHERE r.usuario_id = ?
                ORDER BY r.creado_en DESC
            `;
            return db.query(fallbackSql, [usuarioId], (fallbackErr, fallbackResults) => {
                if (fallbackErr) {
                    console.error('Error al obtener reservas (fallback):', fallbackErr);
                    return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                }
                return res.json(fallbackResults);
            });
        }
        if (err) {
            console.error('Error al obtener reservas:', err);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }
        return res.json((results || []).map(sanitizeReservaVehiculoData));
    });
};

// Crear nueva reserva
// Si no se envian hora_inicio/hora_fin se crea pendiente con hora_inicio = ahora + 15 minutos.
exports.crearReserva = (req, res) => {
    let {
        usuario_id,
        parqueadero_id,
        fecha_reserva,
        hora_inicio,
        hora_fin,
        tipo_vehiculo,
        vehiculo_id,
        observaciones,
    } = req.body;

    usuario_id = toPositiveInt(req.auth?.actorId);
    parqueadero_id = toPositiveInt(parqueadero_id);
    vehiculo_id = toPositiveInt(vehiculo_id);

    if (!usuario_id || !parqueadero_id) {
        return res.status(400).json({ mensaje: 'Faltan campos requeridos', message: 'Missing required fields' });
    }

    const resolveVehicleAndType = (callback) => {
        if (vehiculo_id) {
            return getVehiculoUsuario(usuario_id, vehiculo_id, (vehErr, vehiculo) => {
                if (vehErr) return callback(vehErr);
                if (!vehiculo) {
                    return callback({
                        status: 404,
                        body: { mensaje: 'Vehiculo no encontrado para este usuario', message: 'Vehicle not found for this user' },
                    });
                }
                tipo_vehiculo = String(vehiculo.tipo || '').toLowerCase();
                return callback(null, {
                    id: vehiculo.id,
                    tipo: tipo_vehiculo,
                    placa: vehiculo.placa,
                    color: vehiculo.color,
                });
            });
        }

        if (!tipo_vehiculo) {
            return callback({
                status: 400,
                body: { mensaje: 'Debes enviar tipo_vehiculo o vehiculo_id', message: 'tipo_vehiculo or vehiculo_id is required' },
            });
        }

        tipo_vehiculo = String(tipo_vehiculo).toLowerCase();
        return callback(null, null);
    };

    resolveVehicleAndType((vehicleResolveErr, vehiculoData) => {
        if (vehicleResolveErr) {
            if (vehicleResolveErr.status && vehicleResolveErr.body) {
                return res.status(vehicleResolveErr.status).json(vehicleResolveErr.body);
            }
            console.error('Error al obtener vehiculo para reserva:', vehicleResolveErr);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }

        if (!TIPOS_VEHICULO.has(String(tipo_vehiculo).toLowerCase())) {
            return res.status(400).json({ mensaje: 'Tipo de vehiculo invalido', message: 'Invalid vehicle type' });
        }
        tipo_vehiculo = String(tipo_vehiculo).toLowerCase();

        // Si la fecha no viene, usar fecha actual.
        if (!fecha_reserva) {
            fecha_reserva = getNowInAppTimezone().date;
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha_reserva))) {
            return res.status(400).json({ mensaje: 'Formato de fecha_reserva invalido', message: 'Invalid fecha_reserva format' });
        }

        const hasHoraInicio = Boolean(hora_inicio);
        const hasHoraFin = Boolean(hora_fin);
        if (hasHoraInicio !== hasHoraFin) {
            return res.status(400).json({
                mensaje: 'Debes enviar hora_inicio y hora_fin juntas',
                message: 'hora_inicio and hora_fin must be provided together',
            });
        }
        const hasTimes = hasHoraInicio && hasHoraFin;
        let cupoReserved = false;

        const ensureReservedCupo = (callback) => {
            if (cupoReserved) return callback(null);
            return reserveParkingSpot(parqueadero_id, (reserveErr) => {
                if (reserveErr) return callback(reserveErr);
                cupoReserved = true;
                return callback(null);
            });
        };

        const releaseReservedCupoIfNeeded = (callback) => {
            if (!cupoReserved) {
                if (typeof callback === 'function') callback();
                return;
            }
            releaseParkingSpot(parqueadero_id, (releaseErr) => {
                if (releaseErr) {
                    console.error('Error al liberar cupo reservado:', releaseErr);
                }
                cupoReserved = false;
                if (typeof callback === 'function') callback();
            });
        };

        const insertReservation = (tiempoTotal, valorEstimado, horaInicioToStore, horaFinToStore) => {
            const sql = `
                INSERT INTO reservas
                (usuario_id, parqueadero_id, fecha_reserva, hora_inicio, hora_fin, tipo_vehiculo, vehiculo_id, tiempo_total, valor_estimado, observaciones, estado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const estado = 'pendiente';
            const vehiculoIdToStore = vehiculoData?.id || null;
            const params = [
                usuario_id,
                parqueadero_id,
                fecha_reserva,
                horaInicioToStore,
                horaFinToStore,
                tipo_vehiculo,
                vehiculoIdToStore,
                tiempoTotal,
                valorEstimado,
                observaciones || null,
                estado,
            ];

            db.query(sql, params, (err, result) => {
                if (err && isVehiculoSchemaError(err)) {
                    const fallbackSql = `
                        INSERT INTO reservas
                        (usuario_id, parqueadero_id, fecha_reserva, hora_inicio, hora_fin, tipo_vehiculo, tiempo_total, valor_estimado, observaciones, estado)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    const fallbackParams = [
                        usuario_id,
                        parqueadero_id,
                        fecha_reserva,
                        horaInicioToStore,
                        horaFinToStore,
                        tipo_vehiculo,
                        tiempoTotal,
                        valorEstimado,
                        observaciones || null,
                        estado,
                    ];
                    return db.query(fallbackSql, fallbackParams, (fallbackErr, fallbackResult) => {
                        if (fallbackErr) {
                            console.error('Error al crear reserva (fallback):', fallbackErr);
                            return releaseReservedCupoIfNeeded(() =>
                                res.status(500).json({ mensaje: 'Error al crear reserva', message: 'Error creating reservation' }),
                            );
                        }

                        db.query(
                            'SELECT nombre, direccion, latitud, longitud FROM parqueaderos WHERE id = ?',
                            [parqueadero_id],
                            (parqErr, parqueaderoResults) => {
                            if (parqErr) {
                                console.error('Error al obtener parqueadero:', parqErr);
                            }

                            const parqueaderoData =
                                (!parqErr && parqueaderoResults.length > 0)
                                    ? parqueaderoResults[0]
                                    : null;
                            const parqueaderoNombre = parqueaderoData?.nombre || 'Parqueadero';
                            const parqueaderoDireccion = parqueaderoData?.direccion || null;
                            const parqueaderoLatitud = parqueaderoData?.latitud || null;
                            const parqueaderoLongitud = parqueaderoData?.longitud || null;
                            const createdAt = getNowInAppTimezone().iso;
                            emitReservaEvent(parqueadero_id, 'reserva_nueva', {
                                parqueadero_id: parqueadero_id,
                                reserva: {
                                    id: fallbackResult.insertId,
                                    usuario_id,
                                    parqueadero_id,
                                    estado,
                                    fecha_reserva,
                                    hora_inicio: horaInicioToStore || null,
                                    hora_fin: horaFinToStore || null,
                                    tipo_vehiculo,
                                    valor_estimado: valorEstimado,
                                    direccion: parqueaderoDireccion,
                                    latitud: parqueaderoLatitud,
                                    longitud: parqueaderoLongitud,
                                    creado_en: createdAt,
                                },
                            });

                            return res.status(201).json({
                                mensaje: 'Reserva creada con exito',
                                message: 'Reservation created successfully',
                                id: fallbackResult.insertId,
                                usuario_id,
                                parqueadero_id,
                                estado,
                                fecha_reserva,
                                hora_inicio: horaInicioToStore || null,
                                hora_fin: horaFinToStore || null,
                                tipo_vehiculo,
                                tiempo_total: tiempoTotal,
                                valor_estimado: valorEstimado,
                                parqueadero_nombre: parqueaderoNombre,
                                direccion: parqueaderoDireccion,
                                latitud: parqueaderoLatitud,
                                longitud: parqueaderoLongitud,
                                fecha_creacion: createdAt,
                                creado_en: createdAt,
                            });
                        },
                        );
                    });
                }
                if (err) {
                    console.error('Error al crear reserva:', err);
                    return releaseReservedCupoIfNeeded(() =>
                        res.status(500).json({ mensaje: 'Error al crear reserva', message: 'Error creating reservation' }),
                    );
                }

                db.query(
                    'SELECT nombre, direccion, latitud, longitud FROM parqueaderos WHERE id = ?',
                    [parqueadero_id],
                    (parqErr, parqueaderoResults) => {
                    if (parqErr) {
                        console.error('Error al obtener parqueadero:', parqErr);
                    }

                    const parqueaderoData =
                        (!parqErr && parqueaderoResults.length > 0)
                            ? parqueaderoResults[0]
                            : null;
                    const parqueaderoNombre = parqueaderoData?.nombre || 'Parqueadero';
                    const parqueaderoDireccion = parqueaderoData?.direccion || null;
                    const parqueaderoLatitud = parqueaderoData?.latitud || null;
                    const parqueaderoLongitud = parqueaderoData?.longitud || null;
                    const createdAt = getNowInAppTimezone().iso;

                    emitReservaEvent(parqueadero_id, 'reserva_nueva', {
                        parqueadero_id: parqueadero_id,
                        reserva: {
                            id: result.insertId,
                            usuario_id,
                            parqueadero_id,
                            estado,
                            fecha_reserva,
                            hora_inicio: horaInicioToStore || null,
                            hora_fin: horaFinToStore || null,
                            tipo_vehiculo,
                            vehiculo_id: vehiculoIdToStore,
                            vehiculo_placa: vehiculoData?.placa || null,
                            vehiculo_color: vehiculoData?.color || null,
                            valor_estimado: valorEstimado,
                            direccion: parqueaderoDireccion,
                            latitud: parqueaderoLatitud,
                            longitud: parqueaderoLongitud,
                            creado_en: createdAt,
                        },
                    });

                    return res.status(201).json({
                        mensaje: 'Reserva creada con exito',
                        message: 'Reservation created successfully',
                        id: result.insertId,
                        usuario_id,
                        parqueadero_id,
                        estado,
                        fecha_reserva,
                        hora_inicio: horaInicioToStore || null,
                        hora_fin: horaFinToStore || null,
                        tipo_vehiculo,
                        vehiculo_id: vehiculoIdToStore,
                        vehiculo_placa: vehiculoData?.placa || null,
                        vehiculo_color: vehiculoData?.color || null,
                        tiempo_total: tiempoTotal,
                        valor_estimado: valorEstimado,
                        parqueadero_nombre: parqueaderoNombre,
                        direccion: parqueaderoDireccion,
                        latitud: parqueaderoLatitud,
                        longitud: parqueaderoLongitud,
                        fecha_creacion: createdAt,
                        creado_en: createdAt,
                    });
                },
                );
            });
        };

        if (hasTimes) {
            const inicio = new Date(`${fecha_reserva} ${hora_inicio}`);
            const fin = new Date(`${fecha_reserva} ${hora_fin}`);
            const duracionMs = fin - inicio;

            if (Number.isNaN(duracionMs) || duracionMs <= 0) {
                return res.status(400).json({ mensaje: 'La hora de fin debe ser posterior a la hora de inicio', message: 'End time must be after start time' });
            }

            getTarifaParqueadero(parqueadero_id, tipo_vehiculo, (tarifaErr, tarifaData) => {
                if (tarifaErr) {
                    console.error('Error al obtener tarifa de parqueadero:', tarifaErr);
                    return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                }
                const minutosFacturables = milisegundosToBillableMinutes(duracionMs);
                const tiempoTotalHoras = minutesToHours(minutosFacturables);
                const valorEstimado = calcularValorEstimadoPorMinutos(
                    minutosFacturables,
                    tarifaData.tarifa_primera_hora,
                    tarifaData.tarifa_hora_adicional,
                );

                return ensureReservedCupo((reserveErr) => {
                    if (reserveErr) {
                        if (reserveErr.status && reserveErr.body) {
                            return res.status(reserveErr.status).json(reserveErr.body);
                        }
                        console.error('Error al reservar cupo:', reserveErr);
                        return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                    }
                    return insertReservation(tiempoTotalHoras, valorEstimado, hora_inicio, hora_fin);
                });
            });
            return;
        }

        let horaInicioToUse = hora_inicio;
        if (!horaInicioToUse) {
            horaInicioToUse = getNowInAppTimezone(15).time;
        }
        ensureReservedCupo((reserveErr) => {
            if (reserveErr) {
                if (reserveErr.status && reserveErr.body) {
                    return res.status(reserveErr.status).json(reserveErr.body);
                }
                console.error('Error al reservar cupo:', reserveErr);
                return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
            }
            return insertReservation(0, 0, horaInicioToUse, null);
        });
    });
};

// Cancelar reserva (pendiente o activa)
exports.cancelarReserva = (req, res) => {
    const id = toPositiveInt(req.params.id);
    const ownerContext = getReservaOwnerContext(req);
    if (!id) {
        return res.status(400).json({ mensaje: 'ID de reserva invÃ¡lido', message: 'Invalid reservation id' });
    }
    if (!ownerContext) {
        return res.status(401).json({ mensaje: 'No autorizado', message: 'Unauthorized' });
    }

    db.query(
        `SELECT parqueadero_id
         FROM reservas
         WHERE id = ? AND ${ownerContext.ownerColumn} = ? AND estado IN ("pendiente", "activa")
         LIMIT 1`,
        [id, ownerContext.actorId],
        (findErr, findResults) => {
            if (findErr) {
                console.error('Error al validar reserva para cancelar:', findErr);
                return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
            }

            if (!findResults || findResults.length === 0) {
                return res.status(404).json({ mensaje: 'Reserva no encontrada o no se puede cancelar', message: 'Reservation not found or cannot be cancelled' });
            }

            const parqueaderoId = toPositiveInt(findResults[0].parqueadero_id);

            db.query(
                `UPDATE reservas
                 SET estado = "cancelada"
                 WHERE id = ? AND ${ownerContext.ownerColumn} = ? AND estado IN ("pendiente", "activa")`,
                [id, ownerContext.actorId],
                (err, result) => {
                    if (err) {
                        console.error('Error al cancelar reserva:', err);
                        return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                    }

                    if (!result || result.affectedRows === 0) {
                        return res.status(404).json({ mensaje: 'Reserva no encontrada o no se puede cancelar', message: 'Reservation not found or cannot be cancelled' });
                    }

                    if (!parqueaderoId) {
                        return res.json({ mensaje: 'Reserva cancelada', message: 'Reservation cancelled' });
                    }

                    releaseParkingSpot(parqueaderoId, (releaseErr) => {
                        if (releaseErr) {
                            console.error('Error al liberar cupo por cancelacion:', releaseErr);
                        }

                        emitReservaEvent(parqueaderoId, 'reserva_actualizada', {
                            reserva_id: id,
                            estado: 'cancelada',
                        });

                        return res.json({ mensaje: 'Reserva cancelada', message: 'Reservation cancelled' });
                    });
                },
            );
        },
    );
};

// Completar reserva
exports.completarReserva = (req, res) => {
    const id = toPositiveInt(req.params.id);
    const ownerContext = getReservaOwnerContext(req);
    if (!id) {
        return res.status(400).json({ mensaje: 'ID de reserva invÃ¡lido', message: 'Invalid reservation id' });
    }
    if (!ownerContext) {
        return res.status(401).json({ mensaje: 'No autorizado', message: 'Unauthorized' });
    }

    db.query(
        `SELECT parqueadero_id, tipo_vehiculo, fecha_reserva, hora_inicio, estado
         FROM reservas
         WHERE id = ? AND ${ownerContext.ownerColumn} = ?`,
        [id, ownerContext.actorId],
        (err, results) => {
        if (err) {
            console.error('Error al obtener reserva:', err);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }
        if (!results || results.length === 0) {
            return res.status(404).json({ mensaje: 'Reserva no encontrada', message: 'Reservation not found' });
        }

        const reserva = results[0];
        if (reserva.estado !== 'activa' && reserva.estado !== 'pendiente') {
            return res.status(400).json({
                mensaje: 'La reserva debe estar en estado activa o pendiente para completarse',
                message: 'Reservation must be active or pending to be completed',
            });
        }

        getTarifaParqueadero(reserva.parqueadero_id, reserva.tipo_vehiculo, (tarifaErr, tarifaData) => {
            if (tarifaErr) {
                console.error('Error al obtener tarifa:', tarifaErr);
                return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
            }

            const processUpdate = (minutosFacturables) => {
                const horas = minutesToHours(minutosFacturables);
                const valorTotal = calcularValorEstimadoPorMinutos(
                    minutosFacturables,
                    tarifaData.tarifa_primera_hora,
                    tarifaData.tarifa_hora_adicional,
                );

                db.query(
                    `UPDATE reservas
                     SET hora_fin = CURTIME(), tiempo_total = ?, valor_estimado = ?, estado = "completada"
                     WHERE id = ? AND ${ownerContext.ownerColumn} = ?`,
                    [horas, valorTotal, id, ownerContext.actorId],
                    (updateErr) => {
                        if (updateErr) {
                            console.error('Error al completar reserva:', updateErr);
                            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                        }

                        releaseParkingSpot(reserva.parqueadero_id, (releaseErr) => {
                            if (releaseErr) {
                                console.error('Error al liberar cupo por completar reserva:', releaseErr);
                            }

                            emitReservaEvent(reserva.parqueadero_id, 'reserva_actualizada', {
                                reserva_id: id,
                                estado: 'completada',
                                tiempo_total: horas,
                                valor_total: valorTotal,
                            });

                            return res.json({
                                mensaje: 'Reserva completada',
                                message: 'Reservation completed',
                                estado: 'completada',
                                tiempo_total: horas,
                                valor_total: valorTotal,
                            });
                        });
                    },
                );
            };

            if (!reserva.hora_inicio) {
                // Si no existe hora_inicio, por regla comercial se cobra al menos primera hora.
                return processUpdate(1);
            }

            db.query(
                `SELECT GREATEST(TIMESTAMPDIFF(SECOND, TIMESTAMP(fecha_reserva, hora_inicio), NOW()), 0) AS segundos
                 FROM reservas
                 WHERE id = ? AND ${ownerContext.ownerColumn} = ?`,
                [id, ownerContext.actorId],
                (diffErr, diffResults) => {
                    if (diffErr) {
                        console.error('Error al calcular diferencia de tiempo:', diffErr);
                        return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                    }

                    const segundos = Number(diffResults[0]?.segundos || 0);
                    const minutosFacturables = segundosToBillableMinutes(segundos);
                    return processUpdate(minutosFacturables);
                },
            );
        });
    },
    );
};

// Autorizar ingreso (compatibilidad endpoint autorizar/autorizar-ingreso)
exports.autorizarIngreso = (req, res) => {
    const id = toPositiveInt(req.params.id);
    const ownerContext = getReservaOwnerContext(req);
    if (!id) {
        return res.status(400).json({ mensaje: 'ID de reserva invÃ¡lido', message: 'Invalid reservation id' });
    }
    if (!ownerContext) {
        return res.status(401).json({ mensaje: 'No autorizado', message: 'Unauthorized' });
    }

    db.query(
        `SELECT parqueadero_id
         FROM reservas
         WHERE id = ? AND ${ownerContext.ownerColumn} = ? AND estado = "pendiente"
         LIMIT 1`,
        [id, ownerContext.actorId],
        (findErr, findResults) => {
            if (findErr) {
                console.error('Error al validar reserva para autorizar ingreso:', findErr);
                return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
            }

            if (!findResults || findResults.length === 0) {
                return res.status(404).json({ mensaje: 'Reserva no encontrada o no se puede autorizar', message: 'Reservation not found or cannot be authorized' });
            }

            const parqueaderoId = toPositiveInt(findResults[0].parqueadero_id);

            db.query(
                `UPDATE reservas
                 SET estado = "activa", fecha_reserva = CURDATE(), hora_inicio = CURTIME()
                 WHERE id = ? AND ${ownerContext.ownerColumn} = ? AND estado = "pendiente"`,
                [id, ownerContext.actorId],
                (err, result) => {
                    if (err) {
                        console.error('Error al autorizar ingreso:', err);
                        return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                    }

                    if (!result || result.affectedRows === 0) {
                        return res.status(404).json({ mensaje: 'Reserva no encontrada o no se puede autorizar', message: 'Reservation not found or cannot be authorized' });
                    }

                    if (parqueaderoId) {
                        emitReservaEvent(parqueaderoId, 'reserva_actualizada', {
                            reserva_id: id,
                            estado: 'activa',
                        });
                    }

                    return res.json({ mensaje: 'Ingreso autorizado', message: 'Entry authorized' });
                },
            );
        },
    );
};

// Marcar llegada real
exports.marcarLlegada = (req, res) => {
    const id = toPositiveInt(req.params.id);
    const ownerContext = getReservaOwnerContext(req);
    if (!id) {
        return res.status(400).json({ mensaje: 'ID de reserva invÃ¡lido', message: 'Invalid reservation id' });
    }
    if (!ownerContext) {
        return res.status(401).json({ mensaje: 'No autorizado', message: 'Unauthorized' });
    }

    const sql = `
        UPDATE reservas
        SET fecha_reserva = CURDATE(), hora_inicio = CURTIME(), estado = "activa"
        WHERE id = ? AND ${ownerContext.ownerColumn} = ? AND estado = "pendiente"
    `;
    db.query(sql, [id, ownerContext.actorId], (err, result) => {
        if (err) {
            console.error('Error al marcar llegada:', err);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Reserva no encontrada o no esta en estado pendiente', message: 'Reservation not found or not pending' });
        }
        db.query('SELECT parqueadero_id FROM reservas WHERE id = ? LIMIT 1', [id], (parqErr, parqResults) => {
            if (!parqErr && parqResults && parqResults.length > 0) {
                emitReservaEvent(parqResults[0].parqueadero_id, 'reserva_actualizada', {
                    reserva_id: id,
                    estado: 'activa',
                });
            }
        });
        return res.json({ mensaje: 'Llegada registrada', message: 'Arrival recorded', estado: 'activa' });
    });
};

// Marcar salida real
exports.marcarSalida = (req, res) => {
    const id = toPositiveInt(req.params.id);
    const ownerContext = getReservaOwnerContext(req);
    if (!id) {
        return res.status(400).json({ mensaje: 'ID de reserva invÃ¡lido', message: 'Invalid reservation id' });
    }
    if (!ownerContext) {
        return res.status(401).json({ mensaje: 'No autorizado', message: 'Unauthorized' });
    }

    db.query(
        `SELECT parqueadero_id, tipo_vehiculo, fecha_reserva, hora_inicio, estado
         FROM reservas
         WHERE id = ? AND ${ownerContext.ownerColumn} = ?`,
        [id, ownerContext.actorId],
        (err, results) => {
        if (err) {
            console.error('Error al obtener reserva:', err);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }
        if (!results || results.length === 0) {
            return res.status(404).json({ mensaje: 'Reserva no encontrada', message: 'Reservation not found' });
        }

        const reserva = results[0];
        if (reserva.estado !== 'activa') {
            return res.status(400).json({ mensaje: 'La reserva debe estar en estado activa para marcar salida', message: 'Reservation must be active to mark exit' });
        }
        if (!reserva.hora_inicio) {
            return res.status(400).json({ mensaje: 'La llegada no ha sido registrada para esta reserva', message: 'Arrival not registered for this reservation' });
        }

        getTarifaParqueadero(reserva.parqueadero_id, reserva.tipo_vehiculo, (tarifaErr, tarifaData) => {
            if (tarifaErr) {
                console.error('Error al obtener tarifa:', tarifaErr);
                return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
            }

            db.query(
                `SELECT GREATEST(TIMESTAMPDIFF(SECOND, TIMESTAMP(fecha_reserva, hora_inicio), NOW()), 0) AS segundos
                 FROM reservas
                 WHERE id = ? AND ${ownerContext.ownerColumn} = ?`,
                [id, ownerContext.actorId],
                (diffErr, diffResults) => {
                    if (diffErr) {
                        console.error('Error al calcular diferencia de tiempo:', diffErr);
                        return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                    }

                    const segundos = Number(diffResults[0]?.segundos || 0);
                    const minutosFacturables = segundosToBillableMinutes(segundos);
                    const horas = minutesToHours(minutosFacturables);
                    const valorTotal = calcularValorEstimadoPorMinutos(
                        minutosFacturables,
                        tarifaData.tarifa_primera_hora,
                        tarifaData.tarifa_hora_adicional,
                    );

                    db.query(
                        `UPDATE reservas
                         SET hora_fin = CURTIME(), tiempo_total = ?, valor_estimado = ?, estado = "completada"
                         WHERE id = ? AND ${ownerContext.ownerColumn} = ?`,
                        [horas, valorTotal, id, ownerContext.actorId],
                        (updateErr) => {
                            if (updateErr) {
                                console.error('Error al actualizar reserva con salida:', updateErr);
                                return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                            }

                            releaseParkingSpot(reserva.parqueadero_id, (releaseErr) => {
                                if (releaseErr) {
                                    console.error('Error al liberar cupo por salida:', releaseErr);
                                }

                                emitReservaEvent(reserva.parqueadero_id, 'reserva_actualizada', {
                                    reserva_id: id,
                                    estado: 'completada',
                                    tiempo_total: horas,
                                    valor_total: valorTotal,
                                });

                                return res.json({
                                    mensaje: 'Salida registrada',
                                    message: 'Exit recorded',
                                    estado: 'completada',
                                    tiempo_total: horas,
                                    valor_total: valorTotal,
                                });
                            });
                        },
                    );
                },
            );
        });
    },
    );
};

// Obtener tarifa para pago
exports.getTarifaReserva = (req, res) => {
    const id = toPositiveInt(req.params.id);
    const ownerContext = getReservaOwnerContext(req);
    if (!id) {
        return res.status(400).json({ mensaje: 'ID de reserva invÃ¡lido', message: 'Invalid reservation id' });
    }
    if (!ownerContext) {
        return res.status(401).json({ mensaje: 'No autorizado', message: 'Unauthorized' });
    }

    const sql = `
        SELECT
            r.tiempo_total,
            r.valor_estimado,
            COALESCE(t.tarifa_primera_hora, 0) AS tarifa_primera_hora,
            COALESCE(t.tarifa_hora_adicional, 0) AS tarifa_hora_adicional,
            r.tipo_vehiculo
        FROM reservas r
        LEFT JOIN tarifas t ON r.parqueadero_id = t.parqueadero_id AND r.tipo_vehiculo = t.tipo_vehiculo
        WHERE r.id = ? AND r.${ownerContext.ownerColumn} = ?
    `;

    db.query(sql, [id, ownerContext.actorId], (err, results) => {
        if (err) {
            console.error('Error al obtener tarifa:', err);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ mensaje: 'Reserva no encontrada', message: 'Reservation not found' });
        }

        const { tiempo_total, valor_estimado, tarifa_primera_hora, tarifa_hora_adicional, tipo_vehiculo } = results[0];
        return res.json({
            tiempo_total,
            valor_estimado,
            tarifa_primera_hora,
            tarifa_hora_adicional,
            tipo_vehiculo,
        });
    });
};


// Obtener reservas de un parqueadero
exports.getReservasParqueadero = (req, res) => {
    const parqueaderoId = toPositiveInt(req.params.parqueaderoId);
    if (!parqueaderoId) {
        return res.status(400).json({ mensaje: 'ID de parqueadero invÃ¡lido', message: 'Invalid parking id' });
    }

    const sql = `
        SELECT
            r.*,
            u.nombre AS usuario_nombre,
            u.email AS usuario_email,
            u.telefono AS usuario_telefono,
            v.id AS vehiculo_id,
            v.tipo AS vehiculo_tipo,
            v.placa AS vehiculo_placa,
            v.color AS vehiculo_color
        FROM reservas r
        JOIN usuarios u ON r.usuario_id = u.id
        LEFT JOIN vehiculos v ON r.vehiculo_id = v.id
        WHERE r.parqueadero_id = ?
        ORDER BY r.creado_en DESC
    `;

    db.query(sql, [parqueaderoId], (err, results) => {
        if (err && (isVehiculoSchemaError(err) || isTelefonoColumnError(err))) {
            const fallbackSql = `
                SELECT r.*, u.nombre AS usuario_nombre, u.email AS usuario_email, NULL AS usuario_telefono
                FROM reservas r
                JOIN usuarios u ON r.usuario_id = u.id
                WHERE r.parqueadero_id = ?
                ORDER BY r.creado_en DESC
            `;
            return db.query(fallbackSql, [parqueaderoId], (fallbackErr, fallbackResults) => {
                if (fallbackErr) {
                    console.error('Error al obtener reservas del parqueadero (fallback):', fallbackErr);
                    return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                }
                return res.json(fallbackResults);
            });
        }
        if (err) {
            console.error('Error al obtener reservas del parqueadero:', err);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }
        return res.json((results || []).map(sanitizeReservaVehiculoData));
    });
};

// Cancelar reservas pendientes expiradas (>15 minutos)
exports.cancelarReservasExpiradas = (req, res) => {
    const sqlConteo = `
        SELECT parqueadero_id, COUNT(*) AS cantidad
        FROM reservas
        WHERE estado = 'pendiente'
          AND TIMESTAMPDIFF(MINUTE, creado_en, NOW()) > 15
        GROUP BY parqueadero_id
    `;

    const sql = `
        UPDATE reservas
        SET estado = 'cancelada'
        WHERE estado = 'pendiente'
          AND TIMESTAMPDIFF(MINUTE, creado_en, NOW()) > 15
    `;

    db.query(sqlConteo, (countErr, countResults) => {
        if (countErr) {
            console.error('Error al contar reservas expiradas:', countErr);
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }

        db.query(sql, (err, result) => {
            if (err) {
                console.error('Error al cancelar reservas expiradas:', err);
                return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
            }

            const increments = Array.isArray(countResults) ? countResults : [];
            if (increments.length === 0) {
                return res.json({
                    mensaje: 'Reservas expiradas canceladas',
                    message: 'Expired reservations cancelled',
                    affected: result.affectedRows,
                });
            }

            let pending = increments.length;
            let incrementError = null;

            increments.forEach((row) => {
                const parqueaderoId = toPositiveInt(row.parqueadero_id);
                const cantidad = toPositiveInt(row.cantidad);
                if (!parqueaderoId || !cantidad) {
                    pending -= 1;
                    if (pending === 0) {
                        if (incrementError) {
                            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                        }
                        return res.json({
                            mensaje: 'Reservas expiradas canceladas',
                            message: 'Expired reservations cancelled',
                            affected: result.affectedRows,
                        });
                    }
                    return;
                }

                db.query(
                    'UPDATE parqueaderos SET cupos = cupos + ? WHERE id = ?',
                    [cantidad, parqueaderoId],
                    (incErr) => {
                        if (incErr) {
                            console.error('Error al liberar cupos por expiracion:', incErr);
                            incrementError = incErr;
                        }
                        pending -= 1;
                        if (pending === 0) {
                            if (incrementError) {
                                return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
                            }
                            return res.json({
                                mensaje: 'Reservas expiradas canceladas',
                                message: 'Expired reservations cancelled',
                                affected: result.affectedRows,
                            });
                        }
                    },
                );
            });
        });
    });
};


