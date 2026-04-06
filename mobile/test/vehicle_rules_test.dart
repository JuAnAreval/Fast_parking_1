import 'package:flutter_test/flutter_test.dart';
import 'package:usuarios/utils/vehicle_rules.dart';

void main() {
  group('vehicle rules', () {
    test('valida placas de moto con formato AAA12A', () {
      expect(vehiclePlateError('moto', 'ABC12D', touched: true), isNull);
      expect(vehiclePlateError('moto', 'ABC123', touched: true), isNotNull);
    });

    test('valida placas de carro con formato AAA123', () {
      expect(vehiclePlateError('carro', 'ABC123', touched: true), isNull);
      expect(vehiclePlateError('carro', 'ABC12D', touched: true), isNotNull);
    });

    test('bicicleta no exige placa', () {
      expect(vehicleTypeRequiresPlate('bicicleta'), isFalse);
      expect(vehiclePlateError('bicicleta', '', touched: true), isNull);
      expect(vehicleDisplayPlate('bicicleta', ''), 'Sin placa');
    });
  });
}
