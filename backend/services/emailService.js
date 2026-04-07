const nodemailer = require('nodemailer');

let transporterPromise = null;

const getSmtpHost = () => String(process.env.SMTP_HOST || '').trim();
const getSmtpUser = () => String(process.env.SMTP_USER || '').trim();
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
            auth: {
                user: getSmtpUser(),
                pass: getSmtpPass(),
            },
        });
    })();

    return transporterPromise;
};

const sendMail = async ({ to, subject, html, text }) => {
    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
    const transporter = await getTransporter();

    if (!transporter || !from) {
        console.log('[email-preview]', { to, subject, text });
        return { sent: false, preview: true };
    }

    try {
        await transporter.sendMail({
            from,
            to,
            subject,
            html,
            text,
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
