const db = require("../config/db");

const Usuario = {
    crear: (nombre, email, password, telefono, callback) => {
        const query = `
            INSERT INTO usuarios (
                nombre,
                email,
                password,
                telefono,
                rol,
                email_verificado,
                verification_token_hash,
                verification_token_expires_at,
                email_verificado_en
            )
            VALUES (?, ?, ?, ?, 'user', 0, NULL, NULL, NULL)
        `;
        db.query(query, [nombre, email, password, telefono], callback);
    },

    buscarPorEmail: (email, callback) => {
        const query = "SELECT * FROM usuarios WHERE email = ?";
        db.query(query, [email], callback);
    },

    buscarPorId: (id, callback) => {
        const query = "SELECT * FROM usuarios WHERE id = ?";
        db.query(query, [id], callback);
    },

    buscarPorEmailExcluyendoId: (email, id, callback) => {
        const query = "SELECT id FROM usuarios WHERE email = ? AND id <> ?";
        db.query(query, [email, id], callback);
    },

    actualizarPerfil: (id, nombre, email, telefono, callback) => {
        const query = "UPDATE usuarios SET nombre = ?, email = ?, telefono = ? WHERE id = ?";
        db.query(query, [nombre, email, telefono, id], callback);
    },

    actualizarPassword: (id, passwordHash, callback) => {
        const query = "UPDATE usuarios SET password = ? WHERE id = ?";
        db.query(query, [passwordHash, id], callback);
    },

    actualizarEstadoVerificacion: (id, verificado, callback) => {
        const query = `
            UPDATE usuarios
            SET email_verificado = ?,
                email_verificado_en = CASE WHEN ? = 1 THEN NOW() ELSE NULL END,
                verification_token_hash = NULL,
                verification_token_expires_at = NULL
            WHERE id = ?
        `;
        db.query(query, [verificado ? 1 : 0, verificado ? 1 : 0, id], callback);
    },
};

module.exports = Usuario;
