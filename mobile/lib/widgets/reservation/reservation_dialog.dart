import 'package:flutter/material.dart';

import '../../constants/constants.dart';
import '../../services/api_service.dart';
import '../../utils/vehicle_rules.dart';

class ReservationDialogResult {
  final String? unsupportedVehicleType;

  const ReservationDialogResult._({this.unsupportedVehicleType});

  const ReservationDialogResult.unsupportedVehicleType(String type)
    : this._(unsupportedVehicleType: type);
}

/// Dialogo para crear una reserva.
class ReservationDialog extends StatefulWidget {
  final Map<String, dynamic> parqueadero;
  final List<Map<String, dynamic>> tarifas;
  final Future<bool> Function(Map<String, dynamic>) onReservar;

  const ReservationDialog({
    super.key,
    required this.parqueadero,
    required this.tarifas,
    required this.onReservar,
  });

  @override
  State<ReservationDialog> createState() => _ReservationDialogState();
}

class _ReservationDialogState extends State<ReservationDialog> {
  String? selectedVehicleType;
  int? selectedVehiculoId;
  String observations = '';
  bool isReserved = false;
  bool isSubmitting = false;
  bool isLoadingVehiculos = true;
  bool isCreatingVehiculo = false;
  bool showCreateVehiculo = false;
  bool _placaTouched = false;

  String nuevoVehiculoTipo = kVehicleTypes.first;
  final TextEditingController placaController = TextEditingController();
  final TextEditingController colorController = TextEditingController();

  List<Map<String, dynamic>> vehiculos = <Map<String, dynamic>>[];

  List<Map<String, dynamic>> get _tarifasDisponibles =>
      widget.tarifas.where(_isTarifaConfigurada).toList();

  Set<String> get _tiposPermitidos => _tarifasDisponibles
      .map(
        (tarifa) => normalizeVehicleType(tarifa['tipo_vehiculo']?.toString()),
      )
      .where((tipo) => tipo.isNotEmpty)
      .toSet();

  bool get _requiresPlate => vehicleTypeRequiresPlate(nuevoVehiculoTipo);

  String get _normalizedPlate => normalizeVehiclePlate(placaController.text);

  String? get _plateError => vehiclePlateError(
    nuevoVehiculoTipo,
    placaController.text,
    touched: _placaTouched,
  );

  bool get _canSaveVehicle {
    final color = colorController.text.trim();
    if (color.isEmpty || isCreatingVehiculo) {
      return false;
    }

    if (!_requiresPlate) {
      return true;
    }

    return _normalizedPlate.isNotEmpty && _plateError == null;
  }

  @override
  void initState() {
    super.initState();
    if (_tarifasDisponibles.isNotEmpty) {
      selectedVehicleType = _tarifasDisponibles.first['tipo_vehiculo']
          ?.toString();
      nuevoVehiculoTipo = normalizeVehicleType(selectedVehicleType);
    }
    _loadVehiculos();
  }

  @override
  void dispose() {
    placaController.dispose();
    colorController.dispose();
    super.dispose();
  }

  Future<void> _loadVehiculos({int? preferredVehicleId}) async {
    setState(() => isLoadingVehiculos = true);

    final result = await ApiService.getVehiculosUsuario();
    if (!mounted) return;

    if (result['success'] == true && result['data'] is List) {
      final loaded = (result['data'] as List)
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();

      vehiculos = loaded;

      if (vehiculos.isNotEmpty) {
        Map<String, dynamic>? selectedVehiculo;
        if (preferredVehicleId != null) {
          for (final vehiculo in vehiculos) {
            if (_asInt(vehiculo['id']) == preferredVehicleId) {
              selectedVehiculo = vehiculo;
              break;
            }
          }
        }
        selectedVehiculo ??= vehiculos.first;

        selectedVehiculoId = _asInt(selectedVehiculo['id']);
        selectedVehicleType = normalizeVehicleType(
          selectedVehiculo['tipo']?.toString(),
        );
        showCreateVehiculo = false;
      } else {
        selectedVehiculoId = null;
        selectedVehicleType = null;
        showCreateVehiculo = true;
      }
    } else {
      vehiculos = <Map<String, dynamic>>[];
      selectedVehiculoId = null;
      selectedVehicleType = null;
      showCreateVehiculo = true;
    }

    setState(() => isLoadingVehiculos = false);
  }

  int? _asInt(dynamic value) {
    if (value is int) return value;
    if (value is String) return int.tryParse(value);
    return null;
  }

  String _vehiculoLabel(Map<String, dynamic> vehiculo) {
    final plate = vehicleDisplayPlate(
      vehiculo['tipo']?.toString(),
      vehiculo['placa']?.toString(),
    );
    final color = vehiculo['color']?.toString() ?? 'Sin color';
    final tipo = vehicleTypeLabel(vehiculo['tipo']?.toString()).toUpperCase();
    return '$plate - $color ($tipo)';
  }

  Future<void> _crearVehiculo() async {
    if (!_canSaveVehicle) {
      setState(() => _placaTouched = true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _requiresPlate
                ? (_plateError ?? 'Debes completar placa y color del vehiculo.')
                : 'Debes completar el color de la bicicleta.',
          ),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    final placa = _normalizedPlate;
    final color = colorController.text.trim();

    setState(() => isCreatingVehiculo = true);
    final result = await ApiService.crearVehiculo({
      'tipo': nuevoVehiculoTipo,
      'placa': vehiclePlatePayload(nuevoVehiculoTipo, placa),
      'color': color,
    });
    if (!mounted) return;

    setState(() => isCreatingVehiculo = false);

    if (result['success'] == true) {
      final createdVehiculo = (result['data'] is Map)
          ? Map<String, dynamic>.from(result['data']['vehiculo'] ?? {})
          : <String, dynamic>{};
      final createdId = _asInt(createdVehiculo['id']);

      placaController.clear();
      colorController.clear();
      _placaTouched = false;
      showCreateVehiculo = false;
      await _loadVehiculos(preferredVehicleId: createdId);
      if (!mounted) return;
      setState(() {});

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vehiculo guardado correctamente. Ya puedes reservar.'),
          backgroundColor: Colors.green,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            (result['message'] ?? 'No se pudo guardar el vehiculo').toString(),
          ),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _submitReservation() async {
    if (isReserved ||
        isSubmitting ||
        selectedVehicleType == null ||
        selectedVehicleType!.isEmpty) {
      return;
    }
    if (vehiculos.isEmpty || selectedVehiculoId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Primero guarda un vehiculo para poder continuar con la reserva.',
          ),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (_tiposPermitidos.isNotEmpty &&
        !_tiposPermitidos.contains(selectedVehicleType)) {
      Navigator.pop(
        context,
        ReservationDialogResult.unsupportedVehicleType(selectedVehicleType!),
      );
      return;
    }

    final reservaData = {
      'parqueadero_id': widget.parqueadero['id'],
      'tipo_vehiculo': selectedVehicleType,
      'vehiculo_id': selectedVehiculoId,
      'observaciones': observations,
    };

    setState(() => isSubmitting = true);
    final success = await widget.onReservar(reservaData);
    if (!mounted) return;

    setState(() {
      isSubmitting = false;
      isReserved = success;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: AppColors.border),
      ),
      backgroundColor: AppColors.surface,
      title: Text(
        isReserved
            ? 'Reserva Confirmada'
            : 'Reservar en ${widget.parqueadero['nombre']}',
        style: const TextStyle(
          color: AppColors.text,
          fontSize: 18,
          fontWeight: FontWeight.w800,
        ),
      ),
      content: isReserved ? _buildSuccessContent() : _buildFormContent(),
      actions: isReserved ? _buildSuccessActions() : _buildFormActions(),
    );
  }

  Widget _buildFormContent() {
    final tarifasDisponibles = _tarifasDisponibles;

    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (tarifasDisponibles.isEmpty)
            const Text('No hay tarifas configuradas para este parqueadero')
          else ...[
            if (isLoadingVehiculos)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Center(child: CircularProgressIndicator()),
              ),
            if (!isLoadingVehiculos && vehiculos.isEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  'Primero guarda un vehiculo para continuar.',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            if (!isLoadingVehiculos && vehiculos.isNotEmpty)
              DropdownButtonFormField<int>(
                key: ValueKey<int?>(selectedVehiculoId),
                initialValue: selectedVehiculoId,
                decoration: const InputDecoration(
                  labelText: 'Vehiculo registrado',
                  border: OutlineInputBorder(),
                ),
                items: vehiculos
                    .map((vehiculo) {
                      final id = _asInt(vehiculo['id']);
                      if (id == null) return null;
                      return DropdownMenuItem<int>(
                        value: id,
                        child: Text(
                          _vehiculoLabel(vehiculo),
                          overflow: TextOverflow.ellipsis,
                        ),
                      );
                    })
                    .whereType<DropdownMenuItem<int>>()
                    .toList(),
                onChanged: (value) {
                  if (value == null) return;
                  final selected = vehiculos.firstWhere(
                    (vehiculo) => _asInt(vehiculo['id']) == value,
                    orElse: () => <String, dynamic>{},
                  );
                  setState(() {
                    selectedVehiculoId = value;
                    selectedVehicleType = normalizeVehicleType(
                      selected['tipo']?.toString(),
                    );
                  });
                },
              ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () =>
                    setState(() => showCreateVehiculo = !showCreateVehiculo),
                icon: const Icon(Icons.add_circle_outline),
                label: Text(
                  showCreateVehiculo
                      ? 'Ocultar registro de vehiculo'
                      : vehiculos.isEmpty
                      ? 'Registrar mi primer vehiculo'
                      : 'Registrar otro vehiculo',
                ),
              ),
            ),
            if (showCreateVehiculo) _buildVehiculoForm(),
          ],
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              labelText: 'Observaciones',
              border: OutlineInputBorder(),
              hintText: 'Opcional',
            ),
            maxLines: 2,
            onChanged: (value) => observations = value,
          ),
        ],
      ),
    );
  }

  Widget _buildVehiculoForm() {
    final tipos = kVehicleTypes.toList();
    if (!tipos.contains(nuevoVehiculoTipo)) {
      nuevoVehiculoTipo = tipos.first;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceSoft,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DropdownButtonFormField<String>(
            key: ValueKey<String>('nuevo-$nuevoVehiculoTipo'),
            initialValue: nuevoVehiculoTipo,
            decoration: const InputDecoration(
              labelText: 'Tipo',
              border: OutlineInputBorder(),
            ),
            items: tipos
                .map(
                  (tipo) => DropdownMenuItem<String>(
                    value: tipo,
                    child: Text(vehicleTypeLabel(tipo).toUpperCase()),
                  ),
                )
                .toList(),
            onChanged: (value) {
              if (value == null) return;
              setState(() {
                nuevoVehiculoTipo = value;
                if (!vehicleTypeRequiresPlate(value)) {
                  placaController.clear();
                  _placaTouched = false;
                }
              });
            },
          ),
          const SizedBox(height: 10),
          if (_requiresPlate)
            TextField(
              controller: placaController,
              textCapitalization: TextCapitalization.characters,
              inputFormatters: vehiclePlateInputFormatters(),
              decoration: InputDecoration(
                labelText: 'Placa',
                border: const OutlineInputBorder(),
                hintText: vehiclePlateHint(nuevoVehiculoTipo),
                helperText:
                    'Formato esperado: ${vehiclePlateHint(nuevoVehiculoTipo)}',
                errorText: _plateError,
              ),
              onChanged: (_) {
                if (!_placaTouched) {
                  setState(() => _placaTouched = true);
                  return;
                }
                setState(() {});
              },
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.accent.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.accent.withValues(alpha: 0.2),
                ),
              ),
              child: const Row(
                children: [
                  Icon(Icons.pedal_bike_rounded, color: AppColors.primary),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Las bicicletas se guardan sin placa.',
                      style: TextStyle(color: AppColors.text),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 10),
          TextField(
            controller: colorController,
            decoration: const InputDecoration(
              labelText: 'Color',
              border: OutlineInputBorder(),
              hintText: 'Ej: Rojo',
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: isCreatingVehiculo ? null : _crearVehiculo,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
              ),
              icon: isCreatingVehiculo
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.save_rounded),
              label: Text(
                isCreatingVehiculo ? 'Guardando...' : 'Guardar vehiculo',
              ),
            ),
          ),
        ],
      ),
    );
  }

  bool _isTarifaConfigurada(Map<String, dynamic> tarifa) {
    final hasNewStructure =
        tarifa.containsKey('tarifa_primera_hora') ||
        tarifa.containsKey('tarifa_hora_adicional');

    if (hasNewStructure) {
      final primeraHora = _asDouble(tarifa['tarifa_primera_hora']);
      final adicional = _asDouble(tarifa['tarifa_hora_adicional']);
      return primeraHora > 0 && adicional > 0;
    }

    final legacy = _asDouble(tarifa['tarifa_hora']);
    return legacy > 0;
  }

  double _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0;
    return 0;
  }

  Widget _buildSuccessContent() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.check_circle, color: AppColors.success, size: 48),
        const SizedBox(height: 16),
        Text(
          'Tu reserva en ${widget.parqueadero['nombre']} esta confirmada',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 16),
        ),
        const SizedBox(height: 8),
        const Text(
          'Tienes 15 minutos para llegar',
          style: TextStyle(
            color: AppColors.success,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  List<Widget> _buildFormActions() {
    return [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: Text(
          'Cancelar',
          style: TextStyle(color: AppColors.textSecondary),
        ),
      ),
      ElevatedButton(
        onPressed:
            (_tarifasDisponibles.isNotEmpty &&
                selectedVehicleType != null &&
                selectedVehicleType!.isNotEmpty &&
                selectedVehiculoId != null &&
                vehiculos.isNotEmpty &&
                !isSubmitting &&
                !isLoadingVehiculos)
            ? _submitReservation
            : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.secondary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppConstants.borderRadiusSmall),
          ),
        ),
        child: isSubmitting
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : const Text('Reservar'),
      ),
    ];
  }

  List<Widget> _buildSuccessActions() {
    return [
      ElevatedButton(
        onPressed: () => Navigator.pop(context),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.success,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppConstants.borderRadiusSmall),
          ),
        ),
        child: const Text('Entendido'),
      ),
    ];
  }
}
