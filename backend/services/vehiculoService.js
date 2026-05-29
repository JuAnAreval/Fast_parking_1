const db = require('../config/db');
const TIPOS_VEHICULO = new Set(['carro', 'moto', 'bicicleta', 'camion', 'ambulancia']);

const toPositiveInt = (value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
};

const normalizeTipoVehiculo = (value) => String(value || '').trim().toLowerCase();

const normalizePlaca = (value) =>
    String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');

const normalizeColor = (value) => String(value || '').trim();

const isBicicleta = (tipo) => normalizeTipoVehiculo(tipo) === 'bicicleta';

const generateInternalBicyclePlate = (usuarioId) => {
    const userPart = Number(usuarioId || 0).toString(36).toUpperCase();
    const timePart = Date.now().toString(36).toUpperCase();
    const randomPart = Math.floor(Math.random() * 1296)
        .toString(36)
        .toUpperCase()
        .padStart(2, '0');
    return `B${userPart}${timePart}${randomPart}`.slice(0, 15);
};

const sanitizeVehiculo = (vehiculo) => {
    if (!vehiculo || typeof vehiculo !== 'object') return vehiculo;

    const data = { ...vehiculo };
    if (isBicicleta(data.tipo)) {
        data.placa = '';
    }
    return data;
};

exports.getVehiculosMios = (req, res) => {
    const usuarioId = toPositiveInt(req.auth?.actorId);
    if (!usuarioId) {
        return res.status(401).json({ mensaje: 'No autorizado', message: 'Unauthorized' });
    }

    db.query(
        `SELECT id, usuario_id, tipo, placa, color, creado_en
         FROM vehiculos
         WHERE usuario_id = ?
         ORDER BY creado_en DESC`,
        [usuarioId],
        (err, results) => {
            if (err) {
                console.error('Error al obtener vehiculos:', err);
                if (err.code === 'ER_NO_SUCH_TABLE') {
                    return res.status(500).json({
                        mensaje: 'La tabla vehiculos no existe. Aplica la migracion de base de datos.',
                        message: 'Vehicles table not found. Apply database migration.',
                    });
                }
                return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
            }
            return res.json((results || []).map(sanitizeVehiculo));
        },
    );
};

exports.crearVehiculo = (req, res) => {
    const usuarioId = toPositiveInt(req.auth?.actorId);
    if (!usuarioId) {
        return res.status(401).json({ mensaje: 'No autorizado', message: 'Unauthorized' });
    }

    const tipo = normalizeTipoVehiculo(req.body?.tipo);
    const placa = normalizePlaca(req.body?.placa);
    const color = normalizeColor(req.body?.color);

    if (!TIPOS_VEHICULO.has(tipo)) {
        return res.status(400).json({ mensaje: 'Tipo de vehiculo invalido', message: 'Invalid vehicle type' });
    }
    if (!isBicicleta(tipo) && !placa) {
        return res.status(400).json({ mensaje: 'La placa es requerida', message: 'Plate is required' });
    }
    if (!color) {
        return res.status(400).json({ mensaje: 'El color es requerido', message: 'Color is required' });
    }

    const storedPlaca = isBicicleta(tipo)
        ? generateInternalBicyclePlate(usuarioId)
        : placa;
    const sql = 'INSERT INTO vehiculos (usuario_id, tipo, placa, color) VALUES (?, ?, ?, ?)';
    db.query(sql, [usuarioId, tipo, storedPlaca, color], (err, result) => {
        if (err) {
            console.error('Error al crear vehiculo:', err);
            if (err.code === 'ER_NO_SUCH_TABLE') {
                return res.status(500).json({
                    mensaje: 'La tabla vehiculos no existe. Aplica la migracion de base de datos.',
                    message: 'Vehicles table not found. Apply database migration.',
                });
            }
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ mensaje: 'La placa ya existe', message: 'Plate already exists' });
            }
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }

        return res.status(201).json({
            mensaje: 'Vehiculo creado',
            message: 'Vehicle created',
            vehiculo: sanitizeVehiculo({
                id: result.insertId,
                usuario_id: usuarioId,
                tipo,
                placa: storedPlaca,
                color,
            }),
        });
    });
};

exports.actualizarVehiculo = (req, res) => {
    const usuarioId = toPositiveInt(req.auth?.actorId);
    const vehiculoId = toPositiveInt(req.params.id);
    if (!usuarioId) {
        return res.status(401).json({ mensaje: 'No autorizado', message: 'Unauthorized' });
    }
    if (!vehiculoId) {
        return res.status(400).json({ mensaje: 'ID de vehiculo invalido', message: 'Invalid vehicle id' });
    }

    const tipo = normalizeTipoVehiculo(req.body?.tipo);
    const placa = normalizePlaca(req.body?.placa);
    const color = normalizeColor(req.body?.color);

    if (!TIPOS_VEHICULO.has(tipo)) {
        return res.status(400).json({ mensaje: 'Tipo de vehiculo invalido', message: 'Invalid vehicle type' });
    }
    if (!isBicicleta(tipo) && !placa) {
        return res.status(400).json({ mensaje: 'La placa es requerida', message: 'Plate is required' });
    }
    if (!color) {
        return res.status(400).json({ mensaje: 'El color es requerido', message: 'Color is required' });
    }

    const storedPlaca = isBicicleta(tipo)
        ? generateInternalBicyclePlate(usuarioId)
        : placa;
    const sql = `
        UPDATE vehiculos
        SET tipo = ?, placa = ?, color = ?
        WHERE id = ? AND usuario_id = ?
    `;
    db.query(sql, [tipo, storedPlaca, color, vehiculoId, usuarioId], (err, result) => {
        if (err) {
            console.error('Error al actualizar vehiculo:', err);
            if (err.code === 'ER_NO_SUCH_TABLE') {
                return res.status(500).json({
                    mensaje: 'La tabla vehiculos no existe. Aplica la migracion de base de datos.',
                    message: 'Vehicles table not found. Apply database migration.',
                });
            }
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ mensaje: 'La placa ya existe', message: 'Plate already exists' });
            }
            return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
        }
        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Vehiculo no encontrado', message: 'Vehicle not found' });
        }

        return res.json({
            mensaje: 'Vehiculo actualizado',
            message: 'Vehicle updated',
            vehiculo: sanitizeVehiculo({
                id: vehiculoId,
                usuario_id: usuarioId,
                tipo,
                placa: storedPlaca,
                color,
            }),
        });
    });
};

exports.eliminarVehiculo = (req, res) => {
    const usuarioId = toPositiveInt(req.auth?.actorId);
    const vehiculoId = toPositiveInt(req.params.id);
    if (!usuarioId) {
        return res.status(401).json({ mensaje: 'No autorizado', message: 'Unauthorized' });
    }
    if (!vehiculoId) {
        return res.status(400).json({ mensaje: 'ID de vehiculo invalido', message: 'Invalid vehicle id' });
    }

    db.query(
        'DELETE FROM vehiculos WHERE id = ? AND usuario_id = ?',
        [vehiculoId, usuarioId],
        (err, result) => {
            if (err) {
                console.error('Error al eliminar vehiculo:', err);
                if (err.code === 'ER_NO_SUCH_TABLE') {
                    return res.status(500).json({
                        mensaje: 'La tabla vehiculos no existe. Aplica la migracion de base de datos.',
                        message: 'Vehicles table not found. Apply database migration.',
                    });
                }
                return res.status(500).json({ mensaje: 'Error interno', message: 'Internal server error' });
            }
            if (!result || result.affectedRows === 0) {
                return res.status(404).json({ mensaje: 'Vehiculo no encontrado', message: 'Vehicle not found' });
            }
            return res.json({ mensaje: 'Vehiculo eliminado', message: 'Vehicle deleted' });
        },
    );
};
