const allowedVehicleTypes = new Set(['carro', 'moto', 'bicicleta', 'camion', 'ambulancia']);

function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function isEmail(value) {
    return hasText(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

function isCoordinate(value, min, max) {
    return isFiniteNumber(value) && value >= min && value <= max;
}

function validarRegistroCliente(payload = {}) {
    return (
        hasText(payload.nombre) &&
        isEmail(payload.email) &&
        hasText(payload.telefono) &&
        hasText(payload.password) &&
        payload.emailUnico !== false
    );
}

function validarLoginCliente(payload = {}) {
    return hasText(payload.email) && hasText(payload.password);
}

function validarRegistroParqueadero(payload = {}) {
    return (
        hasText(payload.nombre) &&
        hasText(payload.direccion) &&
        isEmail(payload.email) &&
        hasText(payload.password) &&
        isCoordinate(payload.latitud, -90, 90) &&
        isCoordinate(payload.longitud, -180, 180) &&
        isPositiveInteger(payload.cupos) &&
        payload.emailUnico !== false
    );
}

function normalizarParqueaderosMapa(parqueaderos = []) {
    return parqueaderos
        .filter((parqueadero) => validarRegistroParqueadero({
            nombre: parqueadero.nombre || 'Sin nombre',
            direccion: parqueadero.direccion || 'Sin direccion',
            email: parqueadero.email || 'mapa@example.com',
            password: parqueadero.password || '123456',
            latitud: parqueadero.latitud,
            longitud: parqueadero.longitud,
            cupos: parqueadero.cupos,
            emailUnico: true,
        }))
        .map((parqueadero) => ({
            id: parqueadero.id,
            nombre: parqueadero.nombre,
            latitud: parqueadero.latitud,
            longitud: parqueadero.longitud,
            disponible: parqueadero.disponible !== false,
            cupos: parqueadero.cupos,
        }))
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
}

function validarReservaPendiente(payload = {}) {
    return (
        allowedVehicleTypes.has(payload.tipo_vehiculo) &&
        payload.disponible !== false &&
        (payload.estado === undefined || payload.estado === 'pendiente')
    );
}

function puedeGestionarReserva(payload = {}) {
    if (payload.accion === 'cancelar') {
        return payload.estado === 'pendiente';
    }

    if (payload.accion === 'finalizar') {
        return payload.estado === 'activa' && hasText(payload.horaEntrada) && hasText(payload.horaSalida);
    }

    return false;
}

function calcularTarifaReserva({ minutos = 0, tarifaPrimeraHora = 0, tarifaHoraAdicional = 0 } = {}) {
    const totalMinutos = Number(minutos);
    const primeraHora = Number(tarifaPrimeraHora);
    const adicional = Number(tarifaHoraAdicional);

    if (!Number.isFinite(totalMinutos) || totalMinutos <= 0) {
        return 0;
    }

    if (!Number.isFinite(primeraHora) || !Number.isFinite(adicional)) {
        return 0;
    }

    if (totalMinutos <= 60) {
        return Number(primeraHora.toFixed(2));
    }

    const horasAdicionales = Math.ceil((totalMinutos - 60) / 60);
    return Number((primeraHora + horasAdicionales * adicional).toFixed(2));
}

function validarDisponibilidadTiempoReal(payload = {}) {
    return (
        payload.disponible === true &&
        isPositiveInteger(Number(payload.cuposRestantes)) &&
        Array.isArray(payload.reservasActivas) &&
        payload.reservasActivas.every((reserva) => reserva.estado !== 'activa') &&
        Array.isArray(payload.canales) &&
        payload.canales.includes('google-maps') &&
        payload.canales.includes('waze')
    );
}

function esSprint5SoloFrontend() {
    return true;
}

module.exports = {
    validarRegistroCliente,
    validarLoginCliente,
    validarRegistroParqueadero,
    normalizarParqueaderosMapa,
    validarReservaPendiente,
    puedeGestionarReserva,
    calcularTarifaReserva,
    validarDisponibilidadTiempoReal,
    esSprint5SoloFrontend,
};
