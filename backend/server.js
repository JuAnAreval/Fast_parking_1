const express = require("express");
const dotenv = require("dotenv");
const os = require("os");

// Cargar variables de entorno antes de requerir rutas/controladores
dotenv.config();

const cors = require("cors");
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
// Habilitar CORS para que el mobile/web puedan hacer peticiones al backend
app.use(cors());

// Simple request logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Health endpoint para verificar que el servidor está arriba
app.get('/', (req, res) => res.json({ status: 'ok', message: 'Backend up' }));
app.get('/health', (req, res) => res.json({ status: 'ok', message: 'Healthy' }));

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/parqueaderos", parqueaderoRoutes);
app.use("/api/reservas", reservasRoutes);
app.use("/api/vehiculos", vehiculosRoutes);

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
        console.log('📱 URLs de acceso:');
        console.log(`   Local: http://localhost:${PORT}`);
        console.log(`   Emulador Android: http://10.0.2.2:${PORT}`);
        const localIps = getLocalIPv4Addresses();
        if (localIps.length > 0) {
            localIps.forEach((ip) => {
                console.log(`   Red local: http://${ip}:${PORT}`);
            });
        } else {
            console.log('   Red local: no se detecto una IPv4 disponible');
        }
        console.log(`   Android USB (adb reverse): http://127.0.0.1:${PORT}`);
    });
}

module.exports = app;
