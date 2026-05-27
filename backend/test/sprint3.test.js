const { validarReservaPendiente } = require('./sprintRules');

test('Sprint 3: la reserva valida tipo de vehiculo, disponibilidad y estado pendiente', () => {
    const casosValidos = [
        { tipo_vehiculo: 'carro', disponible: true, estado: 'pendiente' },
        { tipo_vehiculo: 'moto', disponible: true },
        { tipo_vehiculo: 'bicicleta', disponible: true, estado: 'pendiente' },
    ];

    const casosInvalidos = [
        { tipo_vehiculo: 'scooter', disponible: true, estado: 'pendiente' },
        { tipo_vehiculo: 'carro', disponible: false, estado: 'pendiente' },
        { tipo_vehiculo: 'moto', disponible: true, estado: 'activa' },
    ];

    expect(casosValidos.every((caso) => validarReservaPendiente(caso))).toBe(true);
    expect(casosInvalidos.some((caso) => validarReservaPendiente(caso))).toBe(false);
});
