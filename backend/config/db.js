const mysql = require("mysql2");

function getEnv(name, fallback) {
    return process.env[name] || fallback;
}

function isTruthy(value) {
    if (!value) return false;
    return ["1", "true", "yes", "on", "required", "require"].includes(
        String(value).toLowerCase()
    );
}

function toPositiveInt(value, fallback) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function toNonNegativeInt(value, fallback) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildPoolConfig() {
    const databaseUrl =
        getEnv("DATABASE_URL") ||
        getEnv("MYSQL_URL") ||
        getEnv("MYSQL_PUBLIC_URL");

    const sslEnabled =
        isTruthy(getEnv("DB_SSL")) ||
        isTruthy(getEnv("MYSQL_SSL")) ||
        isTruthy(getEnv("DB_SSL_ENABLED"));

    const rejectUnauthorized = isTruthy(getEnv("DB_SSL_REJECT_UNAUTHORIZED"));
    const ssl = sslEnabled ? { rejectUnauthorized } : undefined;
    const dbTimezone = getEnv("DB_TIMEZONE", "-05:00");
    const baseConfig = {
        ssl,
        timezone: dbTimezone,
        waitForConnections: true,
        connectionLimit: toPositiveInt(
            getEnv("DB_CONNECTION_LIMIT", getEnv("MYSQL_CONNECTION_LIMIT", "10")),
            10
        ),
        queueLimit: toNonNegativeInt(
            getEnv("DB_QUEUE_LIMIT", getEnv("MYSQL_QUEUE_LIMIT", "0")),
            0
        ),
        enableKeepAlive: !isTruthy(getEnv("DB_DISABLE_KEEP_ALIVE")),
        keepAliveInitialDelay: toNonNegativeInt(
            getEnv("DB_KEEP_ALIVE_INITIAL_DELAY_MS", "0"),
            0
        ),
        connectTimeout: toPositiveInt(getEnv("DB_CONNECT_TIMEOUT_MS", "10000"), 10000),
    };

    if (databaseUrl) {
        return {
            dbTimezone,
            config: {
                uri: databaseUrl,
                ...baseConfig,
            },
        };
    }

    return {
        dbTimezone,
        config: {
            host: getEnv("DB_HOST", getEnv("MYSQLHOST")),
            port: Number(getEnv("DB_PORT", getEnv("MYSQLPORT", "3306"))),
            user: getEnv("DB_USER", getEnv("MYSQLUSER")),
            password: getEnv("DB_PASSWORD", getEnv("MYSQLPASSWORD")),
            database: getEnv("DB_NAME", getEnv("MYSQLDATABASE")),
            ...baseConfig,
        },
    };
}

function attachPoolListeners(pool, dbTimezone) {
    pool.on("connection", (connection) => {
        connection.query("SET time_zone = ?", [dbTimezone], (tzErr) => {
            if (tzErr) {
                console.warn(
                    `Conectado a MySQL, pero no se pudo fijar DB_TIMEZONE=${dbTimezone}:`,
                    tzErr.message || tzErr
                );
            }
        });

        connection.on("error", (err) => {
            console.error("Error en conexion MySQL del pool:", err.message || err);
        });
    });
}

let pool;

try {
    const { config, dbTimezone } = buildPoolConfig();
    pool = mysql.createPool(config);
    attachPoolListeners(pool, dbTimezone);

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err.message || err);
            return;
        }

        console.log("Pool MySQL listo");
        connection.release();
    });
} catch (err) {
    console.error("Exception creating DB pool:", err.message || err);
    pool = null;
}

if (!pool) {
    console.warn(
        "Database pool not available. Exports a shimmed query() that returns an error."
    );

    const dbUnavailableError = () =>
        new Error(
            "Database not connected. Set DB_* vars or Railway MYSQL* vars (MYSQLHOST, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE, MYSQLPORT)."
        );

    const callbackOrReject = (cb) => {
        const err = dbUnavailableError();
        if (typeof cb === "function") {
            cb(err);
            return;
        }
        return Promise.reject(err);
    };

    module.exports = {
        query: function (sql, params, cb) {
            if (typeof params === "function") {
                return callbackOrReject(params);
            }
            return callbackOrReject(cb);
        },
        getConnection: function (cb) {
            return callbackOrReject(cb);
        },
        end: function (cb) {
            if (typeof cb === "function") cb();
        },
    };
} else {
    module.exports = pool;
}
