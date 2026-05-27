const db = require('./db');

const queryAsync = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) return reject(err);
            return resolve(results);
        });
    });

const columnExists = async (tableName, columnName) => {
    const rows = await queryAsync(
        `
            SELECT 1
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
              AND COLUMN_NAME = ?
            LIMIT 1
        `,
        [tableName, columnName],
    );
    return Array.isArray(rows) && rows.length > 0;
};

const ensureColumn = async (tableName, columnName, definition) => {
    const exists = await columnExists(tableName, columnName);
    if (exists) return;
    await queryAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
};

let schemaPromise = null;

const ensureApplicationSchema = async () => {
    if (schemaPromise) return schemaPromise;

    schemaPromise = (async () => {
        try {
            await ensureColumn('usuarios', 'rol', "VARCHAR(20) NOT NULL DEFAULT 'user'");
            await ensureColumn('usuarios', 'email_verificado', 'TINYINT(1) NOT NULL DEFAULT 0');
            await ensureColumn('usuarios', 'verification_token_hash', 'VARCHAR(255) NULL');
            await ensureColumn('usuarios', 'verification_token_expires_at', 'DATETIME NULL');
            await ensureColumn('usuarios', 'email_verificado_en', 'DATETIME NULL');
            await ensureColumn('usuarios', 'password_reset_token_hash', 'VARCHAR(255) NULL');
            await ensureColumn('usuarios', 'password_reset_expires_at', 'DATETIME NULL');

            await ensureColumn('parqueaderos', 'email_verificado', 'TINYINT(1) NOT NULL DEFAULT 0');
            await ensureColumn('parqueaderos', 'verification_token_hash', 'VARCHAR(255) NULL');
            await ensureColumn('parqueaderos', 'verification_token_expires_at', 'DATETIME NULL');
            await ensureColumn('parqueaderos', 'email_verificado_en', 'DATETIME NULL');
            await ensureColumn('parqueaderos', 'password_reset_token_hash', 'VARCHAR(255) NULL');
            await ensureColumn('parqueaderos', 'password_reset_expires_at', 'DATETIME NULL');

            const adminBootstrapEmail = String(process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
            if (adminBootstrapEmail) {
                await queryAsync(
                    `
                        UPDATE usuarios
                        SET rol = 'admin',
                            email_verificado = 1,
                            email_verificado_en = COALESCE(email_verificado_en, NOW())
                        WHERE LOWER(email) = ?
                    `,
                    [adminBootstrapEmail],
                );
            }
        } catch (err) {
            console.error('No se pudo asegurar el esquema de administracion/verificacion:', err);
        }
    })();

    return schemaPromise;
};

module.exports = {
    ensureApplicationSchema,
};
