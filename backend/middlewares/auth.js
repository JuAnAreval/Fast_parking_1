const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'secreto123';
const USER_JWT_EXPIRES_IN = process.env.USER_JWT_EXPIRES_IN || '30d';
const PARQUEADERO_JWT_EXPIRES_IN = process.env.PARQUEADERO_JWT_EXPIRES_IN || '8h';
const INTERNAL_API_KEY = String(process.env.INTERNAL_API_KEY || process.env.CRON_SECRET || '').trim();

const ACTOR_TYPES = Object.freeze({
    USUARIO: 'usuario',
    PARQUEADERO: 'parqueadero',
});

const toPositiveInt = (value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
};

const normalizeActorType = (decoded) => {
    const value = String(decoded?.actorType || decoded?.type || '').trim().toLowerCase();
    if (value === ACTOR_TYPES.USUARIO || value === ACTOR_TYPES.PARQUEADERO) {
        return value;
    }
    return null;
};

const extractBearerToken = (req) => {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader || typeof authHeader !== 'string') return null;
    if (!authHeader.toLowerCase().startsWith('bearer ')) return null;

    const token = authHeader.slice(7).trim();
    return token || null;
};

const verifyAccessToken = (token) => {
    const decoded = jwt.verify(token, SECRET_KEY);
    const actorId = toPositiveInt(decoded?.id);
    const actorType = normalizeActorType(decoded);

    if (!actorId || !actorType) {
        return null;
    }

    return {
        actorId,
        actorType,
        token,
        decoded,
    };
};

const authenticateOptional = (req, _res, next) => {
    const token = extractBearerToken(req);
    if (!token) {
        req.auth = null;
        return next();
    }

    try {
        req.auth = verifyAccessToken(token);
    } catch (_) {
        req.auth = null;
    }

    return next();
};

const requireAuth = (allowedActorTypes = null) => (req, res, next) => {
    const token = extractBearerToken(req);
    if (!token) {
        return res.status(401).json({ mensaje: 'No autorizado', message: 'Unauthorized' });
    }

    let auth;
    try {
        auth = verifyAccessToken(token);
    } catch (_) {
        auth = null;
    }

    if (!auth) {
        return res.status(401).json({ mensaje: 'Token invalido', message: 'Invalid token' });
    }

    if (Array.isArray(allowedActorTypes) && !allowedActorTypes.includes(auth.actorType)) {
        return res.status(403).json({ mensaje: 'No autorizado para esta operacion', message: 'Not authorized for this operation' });
    }

    req.auth = auth;
    return next();
};

const requireUserAuth = requireAuth([ACTOR_TYPES.USUARIO]);
const requireParqueaderoAuth = requireAuth([ACTOR_TYPES.PARQUEADERO]);
const requireAnyAuth = requireAuth([ACTOR_TYPES.USUARIO, ACTOR_TYPES.PARQUEADERO]);

const requireRouteActorId = (paramName, actorType) => (req, res, next) => {
    const routeId = toPositiveInt(req.params?.[paramName]);
    if (!routeId) {
        return res.status(400).json({ mensaje: 'Identificador invalido', message: 'Invalid identifier' });
    }

    if (!req.auth || req.auth.actorType !== actorType || req.auth.actorId !== routeId) {
        return res.status(403).json({ mensaje: 'No autorizado para este recurso', message: 'Not authorized for this resource' });
    }

    return next();
};

const requireSameUserParam = (paramName = 'usuarioId') =>
    requireRouteActorId(paramName, ACTOR_TYPES.USUARIO);

const requireSameParqueaderoParam = (paramName = 'parqueaderoId') =>
    requireRouteActorId(paramName, ACTOR_TYPES.PARQUEADERO);

const requireInternalApiKey = (req, res, next) => {
    if (!INTERNAL_API_KEY) {
        return res.status(403).json({
            mensaje: 'Endpoint interno deshabilitado',
            message: 'Internal endpoint disabled',
        });
    }

    const providedKey = String(req.headers?.['x-internal-api-key'] || '').trim();
    if (!providedKey || providedKey !== INTERNAL_API_KEY) {
        return res.status(401).json({
            mensaje: 'No autorizado',
            message: 'Unauthorized',
        });
    }

    return next();
};

const signUserToken = (usuario) =>
    jwt.sign(
        {
            id: usuario.id,
            actorType: ACTOR_TYPES.USUARIO,
        },
        SECRET_KEY,
        { expiresIn: USER_JWT_EXPIRES_IN },
    );

const signParqueaderoToken = (parqueadero) =>
    jwt.sign(
        {
            id: parqueadero.id,
            email: parqueadero.email,
            actorType: ACTOR_TYPES.PARQUEADERO,
        },
        SECRET_KEY,
        { expiresIn: PARQUEADERO_JWT_EXPIRES_IN },
    );

module.exports = {
    ACTOR_TYPES,
    authenticateOptional,
    extractBearerToken,
    requireAnyAuth,
    requireInternalApiKey,
    requireParqueaderoAuth,
    requireSameParqueaderoParam,
    requireSameUserParam,
    requireUserAuth,
    signParqueaderoToken,
    signUserToken,
    verifyAccessToken,
};
