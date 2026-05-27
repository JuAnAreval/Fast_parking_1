const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');
const { sendMail } = require('./emailService');

const RESET_EXPIRATION_HOURS = Number(process.env.PASSWORD_RESET_TOKEN_EXP_HOURS || 1);

const actorConfig = {
    usuario: {
        table: 'usuarios',
        nameField: 'nombre',
        emailField: 'email',
        displayName: 'cuenta',
    },
    parqueadero: {
        table: 'parqueaderos',
        nameField: 'nombre',
        emailField: 'email',
        displayName: 'parqueadero',
    },
};

const queryAsync = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) return reject(err);
            return resolve(results);
        });
    });

const createToken = () => crypto.randomBytes(24).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');

const getWebBaseUrl = () =>
    String(
        process.env.WEB_APP_URL ||
        process.env.PUBLIC_WEB_URL ||
        process.env.APP_WEB_URL ||
        'http://localhost:5173',
    ).replace(/\/+$/, '');

const buildResetUrl = (actorType, token) => {
    const url = new URL('/reset-password', `${getWebBaseUrl()}/`);
    url.searchParams.set('actor', actorType);
    url.searchParams.set('token', token);
    return url.toString();
};

const sendResetEmail = async ({ actorType, email, name, token }) => {
    const resetUrl = buildResetUrl(actorType, token);
    const label = actorType === 'parqueadero' ? 'tu parqueadero' : 'tu cuenta';

    await sendMail({
        to: email,
        subject: 'Restablece tu contrasena de Fast Parking',
        text:
            `Hola ${name || ''},\n\n` +
            `Puedes cambiar la contrasena de ${label} desde este enlace:\n` +
            `${resetUrl}\n\n` +
            `Este enlace vence en ${RESET_EXPIRATION_HOURS} hora(s).`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
                <h2>Restablece tu contrasena</h2>
                <p>Hola ${name || ''},</p>
                <p>Haz clic en el boton para crear una nueva contrasena de ${label}:</p>
                <p>
                    <a
                        href="${resetUrl}"
                        style="display:inline-block;padding:12px 18px;border-radius:10px;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:700;"
                    >
                        Cambiar contrasena
                    </a>
                </p>
                <p>Este enlace vence en ${RESET_EXPIRATION_HOURS} hora(s).</p>
            </div>
        `,
    });

    return resetUrl;
};

const requestPasswordReset = async (actorType, email) => {
    const config = actorConfig[actorType];
    if (!config) {
        return { ok: false, status: 400, message: 'Actor invalido' };
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
        return { ok: false, status: 400, message: 'Correo requerido' };
    }

    const rows = await queryAsync(
        `SELECT id, ${config.nameField} AS nombre, ${config.emailField} AS email
         FROM ${config.table}
         WHERE LOWER(${config.emailField}) = ?
         LIMIT 1`,
        [normalizedEmail],
    );

    // No revelamos si el correo existe.
    if (!Array.isArray(rows) || rows.length === 0) {
        return { ok: true, sent: false };
    }

    const record = rows[0];
    const token = createToken();
    const tokenHash = hashToken(token);

    await queryAsync(
        `UPDATE ${config.table}
         SET password_reset_token_hash = ?,
             password_reset_expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR)
         WHERE id = ?`,
        [tokenHash, RESET_EXPIRATION_HOURS, record.id],
    );

    const emailPromise = sendResetEmail({
        actorType,
        email: record.email,
        name: record.nombre,
        token,
    });

    if (String(process.env.EMAIL_SEND_SYNC || '').toLowerCase() === 'true') {
        await emailPromise;
    } else {
        emailPromise.catch((err) => {
            console.error('[password-reset-email-error]', {
                actorType,
                recordId: record.id,
                email: record.email,
                message: err.message,
                code: err.code,
            });
        });
    }

    return {
        ok: true,
        sent: true,
        token: process.env.NODE_ENV === 'test' ? token : undefined,
        resetUrl: process.env.NODE_ENV === 'test' ? buildResetUrl(actorType, token) : undefined,
    };
};

const resetPassword = async (actorType, token, newPassword) => {
    const config = actorConfig[actorType];
    if (!config) {
        return { ok: false, status: 400, message: 'Actor invalido' };
    }

    const rawToken = String(token || '').trim();
    const password = String(newPassword || '');
    if (!rawToken || !password) {
        return { ok: false, status: 400, message: 'Token y nueva contrasena son requeridos' };
    }

    if (password.length < 6) {
        return { ok: false, status: 400, message: 'La contrasena debe tener al menos 6 caracteres' };
    }

    const rows = await queryAsync(
        `SELECT id
         FROM ${config.table}
         WHERE password_reset_token_hash = ?
           AND password_reset_expires_at IS NOT NULL
           AND password_reset_expires_at >= NOW()
         LIMIT 1`,
        [hashToken(rawToken)],
    );

    if (!Array.isArray(rows) || rows.length === 0) {
        return { ok: false, status: 400, message: 'Token invalido o expirado' };
    }

    const passwordHash = bcrypt.hashSync(password, 8);
    await queryAsync(
        `UPDATE ${config.table}
         SET password = ?,
             password_reset_token_hash = NULL,
             password_reset_expires_at = NULL
         WHERE id = ?`,
        [passwordHash, rows[0].id],
    );

    return { ok: true };
};

module.exports = {
    buildResetUrl,
    requestPasswordReset,
    resetPassword,
};
