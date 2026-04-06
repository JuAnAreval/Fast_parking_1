import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

const List<String> kVehicleTypes = <String>[
  'carro',
  'moto',
  'bicicleta',
  'camion',
  'ambulancia',
];

String normalizeVehicleType(String? tipo) => (tipo ?? '').trim().toLowerCase();

bool vehicleTypeRequiresPlate(String? tipo) =>
    normalizeVehicleType(tipo) != 'bicicleta';

String normalizeVehiclePlate(String value) =>
    value.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');

String vehicleTypeLabel(String? tipo) {
  switch (normalizeVehicleType(tipo)) {
    case 'moto':
      return 'Moto';
    case 'bicicleta':
      return 'Bicicleta';
    case 'camion':
      return 'Camion';
    case 'ambulancia':
      return 'Ambulancia';
    case 'carro':
    default:
      return 'Carro';
  }
}

IconData vehicleTypeIcon(String? tipo) {
  switch (normalizeVehicleType(tipo)) {
    case 'moto':
      return Icons.motorcycle;
    case 'bicicleta':
      return Icons.pedal_bike_rounded;
    case 'camion':
      return Icons.local_shipping_rounded;
    case 'ambulancia':
      return Icons.emergency_rounded;
    case 'carro':
    default:
      return Icons.directions_car_filled_rounded;
  }
}

String vehiclePlateHint(String? tipo) {
  switch (normalizeVehicleType(tipo)) {
    case 'moto':
      return 'Ej: ABC12D';
    case 'bicicleta':
      return 'Las bicicletas no requieren placa';
    case 'camion':
    case 'ambulancia':
    case 'carro':
    default:
      return 'Ej: ABC123';
  }
}

String? vehiclePlateError(String? tipo, String placa, {bool touched = true}) {
  final normalizedType = normalizeVehicleType(tipo);
  final normalizedPlate = normalizeVehiclePlate(placa);

  if (!vehicleTypeRequiresPlate(normalizedType)) {
    return null;
  }

  if (normalizedPlate.isEmpty) {
    return touched ? 'La placa es obligatoria para este vehiculo.' : null;
  }

  final motoRegex = RegExp(r'^[A-Z]{3}[0-9]{2}[A-Z]$');
  final otherRegex = RegExp(r'^[A-Z]{3}[0-9]{3}$');
  final matches = normalizedType == 'moto'
      ? motoRegex.hasMatch(normalizedPlate)
      : otherRegex.hasMatch(normalizedPlate);

  if (matches) {
    return null;
  }

  if (!touched && normalizedPlate.length < 6) {
    return null;
  }

  return normalizedType == 'moto'
      ? 'La placa de moto debe tener formato AAA12A.'
      : 'La placa debe tener formato AAA123.';
}

String vehicleDisplayPlate(String? tipo, String? placa) {
  if (!vehicleTypeRequiresPlate(tipo)) {
    return 'Sin placa';
  }

  final normalized = normalizeVehiclePlate(placa ?? '');
  return normalized.isEmpty ? 'Sin placa' : normalized;
}

String vehiclePlatePayload(String? tipo, String placa) {
  if (vehicleTypeRequiresPlate(tipo)) {
    return normalizeVehiclePlate(placa);
  }

  final timePart = DateTime.now().millisecondsSinceEpoch
      .toRadixString(36)
      .toUpperCase();
  final fallback = 'BICI$timePart';
  return fallback.length <= 15 ? fallback : fallback.substring(0, 15);
}

List<TextInputFormatter> vehiclePlateInputFormatters() => <TextInputFormatter>[
  FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9]')),
  LengthLimitingTextInputFormatter(6),
  _UppercasePlateFormatter(),
];

class _UppercasePlateFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final normalized = normalizeVehiclePlate(newValue.text);
    return newValue.copyWith(
      text: normalized,
      selection: TextSelection.collapsed(offset: normalized.length),
    );
  }
}
