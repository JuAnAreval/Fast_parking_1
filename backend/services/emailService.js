const nodemailer = require('nodemailer');

let transporterPromise = null;

const hasEmailConfig = () =>
    Boolean(
        process.env.SMTP_URL ||
        (process.env.SMTP_HOST &&
            process.env.SMTP_PORT &&
            process.env.SMTP_USER &&
            process.env.SMTP_PASS),
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
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
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

    await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
    });

    return { sent: true, preview: false };
};

module.exports = {
    sendMail,
};
