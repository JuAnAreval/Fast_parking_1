const { calcularTarifaReserva, puedeGestionarReserva } = require('./sprintRules');

test('Sprint 4: la reserva se gestiona por estado y calcula tarifa por franjas', () => {
    expect(
        puedeGestionarReserva({
            accion: 'cancelar',
            estado: 'pendiente',
        }),
    ).toBe(true);

    expect(
        puedeGestionarReserva({
            accion: 'cancelar',
            estado: 'activa',
        }),
    ).toBe(false);

    expect(
        puedeGestionarReserva({
            accion: 'finalizar',
            estado: 'activa',
            horaEntrada: '08:00:00',
            horaSalida: '10:00:00',
        }),
    ).toBe(true);

    expect(calcularTarifaReserva({
        minutos: 45,
        tarifaPrimeraHora: 5000,
        tarifaHoraAdicional: 3000,
    })).toBe(5000);

    expect(calcularTarifaReserva({
        minutos: 61,
        tarifaPrimeraHora: 5000,
        tarifaHoraAdicional: 3000,
    })).toBe(8000);

    expect(calcularTarifaReserva({
        minutos: 125,
        tarifaPrimeraHora: 5000,
        tarifaHoraAdicional: 3000,
    })).toBe(11000);
});
