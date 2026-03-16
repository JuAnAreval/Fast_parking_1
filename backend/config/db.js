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

function buildConnectionConfig() {
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

    if (databaseUrl) {
        return {
            uri: databaseUrl,
            dbTimezone,
            config: {
                uri: databaseUrl,
                ssl,
            },
        };
    }

    return {
        uri: null,
        dbTimezone,
        config: {
            host: getEnv("DB_HOST", getEnv("MYSQLHOST")),
            port: Number(getEnv("DB_PORT", getEnv("MYSQLPORT", "3306"))),
            user: getEnv("DB_USER", getEnv("MYSQLUSER")),
            password: getEnv("DB_PASSWORD", getEnv("MYSQLPASSWORD")),
            database: getEnv("DB_NAME", getEnv("MYSQLDATABASE")),
            ssl,
            timezone: dbTimezone,
        },
    };
}

let connection;

try {
    const { uri, config, dbTimezone } = buildConnectionConfig();
    connection = uri ? mysql.createConnection(uri) : mysql.createConnection(config);

    connection.connect((err) => {
        if (err) {
            console.error("Error al conectar a la base de datos:", err.message || err);
            return;
        }
        console.log("Conectado a MySQL");
    });

    // Queue timezone setup immediately so it runs before normal app queries.
    connection.query("SET time_zone = ?", [dbTimezone], (tzErr) => {
        if (tzErr) {
            console.warn(
                `Conectado a MySQL, pero no se pudo fijar DB_TIMEZONE=${dbTimezone}:`,
                tzErr.message || tzErr
            );
        } else {
            console.log(`Sesion MySQL configurada con DB_TIMEZONE=${dbTimezone}`);
        }
    });
} catch (err) {
    console.error("Exception creating DB connection:", err.message || err);
    connection = null;
}

if (!connection) {
    console.warn(
        "Database connection not available. Exports a shimbed query() that returns an error."
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
        beginTransaction: function (cb) {
            return callbackOrReject(cb);
        },
        commit: function (cb) {
            return callbackOrReject(cb);
        },
        rollback: function (cb) {
            if (typeof cb === "function") cb();
        },
        end: function (cb) {
            if (typeof cb === "function") cb();
        },
    };
} else {
    module.exports = connection;
}
