const crypto = require('crypto');
const db = require('../config/db');
const { sendMail } = require('./emailService');

const VERIFICATION_EXPIRATION_HOURS = Number(process.env.VERIFICATION_TOKEN_EXP_HOURS || 24);

const actorConfig = {
    usuario: {
        table: 'usuarios',
        emailField: 'email',
        nameField: 'nombre',
        displayName: 'usuario',
        verifyPath: '/api/auth/verify-email',
    },
    parqueadero: {
        table: 'parqueaderos',
        emailField: 'email',
        nameField: 'nombre',
        displayName: 'parqueadero',
        verifyPath: '/api/parqueaderos/verify-email',
    },
};

const queryAsync = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) return reject(err);
            return resolve(results);
        });
    });

const createVerificationToken = () => crypto.randomBytes(24).toString('hex');
const hashVerificationToken = (token) =>
    crypto.createHash('sha256').update(String(token || '')).digest('hex');

const getWebBaseUrl = () =>
    String(
        process.env.WEB_APP_URL ||
        process.env.PUBLIC_WEB_URL ||
        process.env.APP_WEB_URL ||
        'http://localhost:5173',
    ).replace(/\/+$/, '');

const buildVerificationUrl = (actorType, token) => {
    const base = getWebBaseUrl();
    const url = new URL('/verify-email', `${base}/`);
    url.searchParams.set('actor', actorType);
    url.searchParams.set('token', token);
    return url.toString();
};

const sendVerificationEmail = async ({
    actorType,
    email,
    name,
    token,
}) => {
    const verificationUrl = buildVerificationUrl(actorType, token);
    const actorLabel = actorType === 'parqueadero' ? 'tu parqueadero' : 'tu cuenta';

    await sendMail({
        to: email,
        subject: 'Verifica tu cuenta de Fast Parking',
        text:
            `Hola ${name || ''},\n\n` +
            `Verifica ${actorLabel} en Fast Parking entrando a este enlace:\n` +
            `${verificationUrl}\n\n` +
            `Este enlace vence en ${VERIFICATION_EXPIRATION_HOURS} horas.`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
                <h2>Verifica tu cuenta en Fast Parking</h2>
                <p>Hola ${name || ''},</p>
                <p>Haz clic en el siguiente boton para verificar ${actorLabel}:</p>
                <p>
                    <a
                        href="${verificationUrl}"
                        style="display:inline-block;padding:12px 18px;border-radius:10px;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:700;"
                    >
                        Verificar cuenta
                    </a>
                </p>
                <p>Si el boton no funciona, copia este enlace:</p>
                <p>${verificationUrl}</p>
                <p>Este enlace vence en ${VERIFICATION_EXPIRATION_HOURS} horas.</p>
            </div>
        `,
    });

    return verificationUrl;
};

const issueVerificationForRecord = async (actorType, record) => {
    const config = actorConfig[actorType];
    if (!config || !record?.id || !record?.[config.emailField]) {
        throw new Error('Actor de verificacion invalido');
    }

    const rawToken = createVerificationToken();
    const tokenHash = hashVerificationToken(rawToken);

    await queryAsync(
        `
            UPDATE ${config.table}
            SET verification_token_hash = ?,
                verification_token_expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR),
                email_verificado = 0,
                email_verificado_en = NULL
            WHERE id = ?
        `,
        [tokenHash, VERIFICATION_EXPIRATION_HOURS, record.id],
    );

    const verificationUrl = buildVerificationUrl(actorType, rawToken);
    const emailPromise = sendVerificationEmail({
        actorType,
        email: record[config.emailField],
        name: record[config.nameField],
        token: rawToken,
    });

    if (String(process.env.EMAIL_SEND_SYNC || '').toLowerCase() === 'true') {
        await emailPromise;
    } else {
        emailPromise.catch((err) => {
            console.error('[verification-email-error]', {
                actorType,
                recordId: record.id,
                email: record[config.emailField],
                message: err.message,
                code: err.code,
            });
        });
    }

    return {
        token: rawToken,
        verificationUrl,
    };
};

const verifyEmailToken = async (actorType, token) => {
    const config = actorConfig[actorType];
    if (!config) {
        return { ok: false, status: 400, message: 'Actor de verificacion invalido' };
    }

    const tokenHash = hashVerificationToken(token);
    const rows = await queryAsync(
        `
            SELECT id, ${config.nameField} AS nombre, ${config.emailField} AS email
            FROM ${config.table}
            WHERE verification_token_hash = ?
              AND verification_token_expires_at IS NOT NULL
              AND verification_token_expires_at >= NOW()
            LIMIT 1
        `,
        [tokenHash],
    );

    if (!Array.isArray(rows) || rows.length === 0) {
        return { ok: false, status: 400, message: 'Token de verificacion invalido o expirado' };
    }

    const record = rows[0];
    await queryAsync(
        `
            UPDATE ${config.table}
            SET email_verificado = 1,
                email_verificado_en = NOW(),
                verification_token_hash = NULL,
                verification_token_expires_at = NULL
            WHERE id = ?
        `,
        [record.id],
    );

    return {
        ok: true,
        status: 200,
        data: {
            id: record.id,
            nombre: record.nombre,
            email: record.email,
            actorType,
        },
    };
};

module.exports = {
    actorConfig,
    buildVerificationUrl,
    issueVerificationForRecord,
    verifyEmailToken,
};
