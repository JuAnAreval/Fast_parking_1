const { esSprint5SoloFrontend, validarDisponibilidadTiempoReal } = require('./sprintRules');

test('Sprint 5: la integracion frontend y la verificacion de disponibilidad responden a contexto real', () => {
    expect(
        validarDisponibilidadTiempoReal({
            disponible: true,
            cuposRestantes: 4,
            reservasActivas: [],
            canales: ['google-maps', 'waze'],
        }),
    ).toBe(true);

    expect(
        validarDisponibilidadTiempoReal({
            disponible: true,
            cuposRestantes: 0,
            reservasActivas: [],
            canales: ['google-maps', 'waze'],
        }),
    ).toBe(false);

    expect(
        validarDisponibilidadTiempoReal({
            disponible: true,
            cuposRestantes: 2,
            reservasActivas: [{ estado: 'activa' }],
            canales: ['google-maps', 'waze'],
        }),
    ).toBe(false);

    expect(esSprint5SoloFrontend()).toBe(true);
});
