const express = require("express");
const dotenv = require("dotenv");
const os = require("os");

dotenv.config();

const cors = require("cors");
const { ensureApplicationSchema } = require("./config/schemaSetup");
const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");
const parqueaderoRoutes = require("./routes/parqueaderoRoutes");
const reservasRoutes = require("./routes/reservasRoutes");
const vehiculosRoutes = require("./routes/vehiculosRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

function getLocalIPv4Addresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name] || []) {
            if (net.family === "IPv4" && !net.internal) {
                addresses.push(net.address);
            }
        }
    }

    return [...new Set(addresses)];
}

app.use(express.json());
app.use(cors());

app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

const schemaReady = ensureApplicationSchema();

app.use(async (_req, _res, next) => {
    await schemaReady;
    next();
});

app.get("/", (_req, res) => res.json({ status: "ok", message: "Backend up" }));
app.get("/health", (_req, res) => res.json({ status: "ok", message: "Healthy" }));

app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/parqueaderos", parqueaderoRoutes);
app.use("/api/reservas", reservasRoutes);
app.use("/api/vehiculos", vehiculosRoutes);

if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Servidor corriendo en puerto ${PORT}`);
        console.log("URLs de acceso:");
        console.log(`   Local: http://localhost:${PORT}`);
        console.log(`   Emulador Android: http://10.0.2.2:${PORT}`);
        const localIps = getLocalIPv4Addresses();
        if (localIps.length > 0) {
            localIps.forEach((ip) => {
                console.log(`   Red local: http://${ip}:${PORT}`);
            });
        } else {
            console.log("   Red local: no se detecto una IPv4 disponible");
        }
        console.log(`   Android USB (adb reverse): http://127.0.0.1:${PORT}`);
    });
}

module.exports = app;
