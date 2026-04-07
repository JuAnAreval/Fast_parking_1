const nodemailer = require('nodemailer');

let transporterPromise = null;

const getSmtpHost = () => String(process.env.SMTP_HOST || '').trim();
const getSmtpUser = () => String(process.env.SMTP_USER || '').trim();
const getResendApiKey = () => String(process.env.RESEND_API_KEY || '').trim();
const getSmtpPass = () => {
    const password = String(process.env.SMTP_PASS || '').trim();
    const host = getSmtpHost().toLowerCase();

    // Google muestra las App Password con espacios, pero SMTP espera los 16 caracteres juntos.
    if (host.includes('gmail.com')) {
        return password.replace(/\s+/g, '');
    }

    return password;
};

const hasEmailConfig = () =>
    Boolean(
        getResendApiKey() ||
        process.env.SMTP_URL ||
        (getSmtpHost() &&
            process.env.SMTP_PORT &&
            getSmtpUser() &&
            getSmtpPass()),
    );

const getTransporter = async () => {
    if (transporterPromise) return transporterPromise;

    transporterPromise = (async () => {
        if (!hasEmailConfig()) {
            return null;
        }

        if (process.env.SMTP_URL) {
            return nodemailer.createTransport(process.env.SMTP_URL);
        }

        return nodemailer.createTransport({
            host: getSmtpHost(),
            port: Number(process.env.SMTP_PORT || 587),
            secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
            requireTLS: Number(process.env.SMTP_PORT || 587) === 587,
            connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000),
            greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000),
            socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 15000),
            auth: {
                user: getSmtpUser(),
                pass: getSmtpPass(),
            },
        });
    })();

    return transporterPromise;
};

const sendWithResend = async ({ from, to, subject, html, text }) => {
    if (typeof fetch !== 'function') {
        throw new Error('Fetch API no disponible para enviar con Resend');
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${getResendApiKey()}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from,
            to,
            subject,
            html,
            text,
        }),
    });

    const responseText = await response.text();
    let data = null;
    try {
        data = responseText ? JSON.parse(responseText) : null;
    } catch (_) {
        data = { raw: responseText };
    }

    if (!response.ok) {
        const err = new Error(data?.message || data?.error || `Resend API error ${response.status}`);
        err.code = 'RESEND_API_ERROR';
        err.status = response.status;
        err.response = data;
        throw err;
    }

    console.log('[email-sent]', {
        provider: 'resend',
        to,
        subject,
        messageId: data?.id || null,
    });

    return { sent: true, preview: false, provider: 'resend', id: data?.id || null };
};

const sendMail = async ({ to, subject, html, text }) => {
    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

    if (!hasEmailConfig() || !from) {
        console.log('[email-preview]', { to, subject, text });
        return { sent: false, preview: true };
    }

    if (getResendApiKey()) {
        try {
            return await sendWithResend({ from, to, subject, html, text });
        } catch (err) {
            console.error('[email-error]', {
                provider: 'resend',
                message: err.message,
                code: err.code,
                status: err.status,
                response: err.response,
                hasApiKey: Boolean(getResendApiKey()),
                hasFrom: Boolean(from),
            });
            throw err;
        }
    }

    const transporter = await getTransporter();
    if (!transporter) {
        console.log('[email-preview]', { to, subject, text });
        return { sent: false, preview: true };
    }

    try {
        const info = await transporter.sendMail({
            from,
            to,
            subject,
            html,
            text,
        });
        console.log('[email-sent]', {
            to,
            subject,
            messageId: info.messageId,
            smtpHost: getSmtpHost() || 'SMTP_URL',
            smtpUser: getSmtpUser() || null,
        });
    } catch (err) {
        console.error('[email-error]', {
            message: err.message,
            code: err.code,
            command: err.command,
            smtpHost: getSmtpHost() || 'SMTP_URL',
            smtpPort: process.env.SMTP_PORT || null,
            smtpSecure: process.env.SMTP_SECURE || null,
            smtpUser: getSmtpUser() || null,
            hasPassword: Boolean(getSmtpPass()),
            hasFrom: Boolean(from),
        });
        throw err;
    }

    return { sent: true, preview: false };
};

module.exports = {
    sendMail,
};
