const { validarRegistroCliente, validarRegistroParqueadero } = require('./sprintRules');

test('Sprint 1: registro de cliente y parqueadero resiste validaciones y rechazos basicos', () => {
    const clienteValido = {
        nombre: '  Cliente Demo  ',
        email: 'CLIENTE.DEMO@example.com',
        telefono: '3001234567',
        password: '123456',
    };

    const parqueaderoValido = {
        nombre: 'Parqueadero Demo',
        direccion: 'Calle 123',
        email: 'parqueadero.demo@example.com',
        password: '123456',
        latitud: 4.711,
        longitud: -74.0721,
        cupos: 10,
    };

    expect(validarRegistroCliente(clienteValido)).toBe(true);
    expect(validarRegistroCliente({ ...clienteValido, emailUnico: false })).toBe(false);
    expect(validarRegistroCliente({ ...clienteValido, telefono: '   ' })).toBe(false);

    expect(validarRegistroParqueadero(parqueaderoValido)).toBe(true);
    expect(validarRegistroParqueadero({ ...parqueaderoValido, cupos: 0 })).toBe(false);
    expect(validarRegistroParqueadero({ ...parqueaderoValido, latitud: '4.711' })).toBe(false);
});
