const { normalizarParqueaderosMapa, validarRegistroParqueadero } = require('./sprintRules');

test('Sprint 2: ubicacion y mapa soportan filtrado, coordenadas y orden estable', () => {
    const parqueaderos = [
        {
            id: 2,
            nombre: 'Beta',
            direccion: 'Av. 2',
            email: 'beta@example.com',
            password: '123456',
            latitud: 6.2518,
            longitud: -75.5636,
            cupos: 15,
            disponible: true,
        },
        {
            id: 1,
            nombre: 'Alpha',
            direccion: 'Av. 1',
            email: 'alpha@example.com',
            password: '123456',
            latitud: 4.711,
            longitud: -74.0721,
            cupos: 30,
            disponible: false,
        },
        {
            id: 3,
            nombre: 'Invalido',
            direccion: 'Av. 3',
            email: 'bad@example.com',
            password: '123456',
            latitud: '6.2442',
            longitud: -75.5812,
            cupos: 12,
        },
    ];

    expect(validarRegistroParqueadero(parqueaderos[0])).toBe(true);
    expect(validarRegistroParqueadero({ ...parqueaderos[0], longitud: 200 })).toBe(false);

    const normalizados = normalizarParqueaderosMapa(parqueaderos);

    expect(normalizados).toHaveLength(2);
    expect(normalizados.map((item) => item.nombre)).toEqual(['Alpha', 'Beta']);
    expect(normalizados[0]).toMatchObject({
        id: 1,
        latitud: 4.711,
        longitud: -74.0721,
        disponible: false,
        cupos: 30,
    });
});
