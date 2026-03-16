import 'package:flutter/material.dart';

import '../../constants/constants.dart';
import '../../services/api_service.dart';

/// Dialogo para crear una reserva
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
  static const List<String> _allVehicleTypes = <String>[
    'carro',
    'moto',
    'bicicleta',
    'camion',
    'ambulancia',
  ];

  String? selectedVehicleType;
  int? selectedVehiculoId;
  String observations = '';
  bool isReserved = false;
  bool isSubmitting = false;
  bool isLoadingVehiculos = true;
  bool isCreatingVehiculo = false;
  bool showCreateVehiculo = false;

  String nuevoVehiculoTipo = 'carro';
  final TextEditingController placaController = TextEditingController();
  final TextEditingController colorController = TextEditingController();

  List<Map<String, dynamic>> vehiculos = <Map<String, dynamic>>[];

  List<Map<String, dynamic>> get _tarifasDisponibles =>
      widget.tarifas.where(_isTarifaConfigurada).toList();

  @override
  void initState() {
    super.initState();
    if (_tarifasDisponibles.isNotEmpty) {
      selectedVehicleType = _tarifasDisponibles.first['tipo_vehiculo']
          ?.toString();
      nuevoVehiculoTipo = selectedVehicleType ?? 'carro';
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
        selectedVehicleType = selectedVehiculo['tipo']
            ?.toString()
            .toLowerCase();
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
    final placa = vehiculo['placa']?.toString().toUpperCase() ?? 'SIN-PLACA';
    final color = vehiculo['color']?.toString() ?? 'Sin color';
    final tipo = vehiculo['tipo']?.toString().toUpperCase() ?? 'N/A';
    return '$placa - $color ($tipo)';
  }

  Future<void> _crearVehiculo() async {
    if (isCreatingVehiculo) return;

    final placa = placaController.text.trim().toUpperCase().replaceAll(' ', '');
    final color = colorController.text.trim();

    if (placa.isEmpty || color.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Debes completar placa y color del vehiculo.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => isCreatingVehiculo = true);
    final result = await ApiService.crearVehiculo({
      'tipo': nuevoVehiculoTipo,
      'placa': placa,
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
      showCreateVehiculo = false;
      await _loadVehiculos(preferredVehicleId: createdId);
      if (!mounted) return;
      setState(() {});

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vehiculo guardado correctamente.'),
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
    if (isReserved || isSubmitting || selectedVehicleType == null) return;
    if (vehiculos.isEmpty || selectedVehiculoId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Debes registrar y seleccionar un vehiculo antes de reservar.',
          ),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    final tiposPermitidos = _tarifasDisponibles
        .map(
          (tarifa) => tarifa['tipo_vehiculo']?.toString().toLowerCase() ?? '',
        )
        .where((tipo) => tipo.isNotEmpty)
        .toSet();

    if (tiposPermitidos.isNotEmpty &&
        !tiposPermitidos.contains(selectedVehicleType)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Este parqueadero no tiene tarifa para ${selectedVehicleType?.toUpperCase()}.',
          ),
          backgroundColor: Colors.red,
        ),
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
        children: [
          if (tarifasDisponibles.isEmpty)
            const Text('No hay tarifas configuradas para este parqueadero')
          else ...[
            if (isLoadingVehiculos)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: CircularProgressIndicator(),
              ),
            if (!isLoadingVehiculos && vehiculos.isNotEmpty)
              DropdownButtonFormField<int>(
                value: selectedVehiculoId,
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
                    selectedVehicleType = selected['tipo']
                        ?.toString()
                        .toLowerCase();
                  });
                },
              ),
            if (!isLoadingVehiculos && vehiculos.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.warning.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: AppColors.warning.withValues(alpha: 0.3),
                  ),
                ),
                child: Text(
                  'No tienes vehiculos registrados. Registra uno para continuar.',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
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
                      : 'Registrar vehiculo',
                ),
              ),
            ),
            if (showCreateVehiculo) _buildVehiculoForm(),
          ],
          const SizedBox(height: 8),
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
    final tipos = _allVehicleTypes.toList();
    if (!tipos.contains(nuevoVehiculoTipo)) {
      nuevoVehiculoTipo = tipos.first;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surfaceSoft,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          DropdownButtonFormField<String>(
            value: nuevoVehiculoTipo,
            decoration: const InputDecoration(
              labelText: 'Tipo',
              border: OutlineInputBorder(),
            ),
            items: tipos
                .map(
                  (tipo) => DropdownMenuItem<String>(
                    value: tipo,
                    child: Text(tipo.toUpperCase()),
                  ),
                )
                .toList(),
            onChanged: (value) {
              if (value == null) return;
              setState(() => nuevoVehiculoTipo = value);
            },
          ),
          const SizedBox(height: 10),
          TextField(
            controller: placaController,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(
              labelText: 'Placa',
              border: OutlineInputBorder(),
              hintText: 'Ej: ABC123',
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
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: isCreatingVehiculo ? null : _crearVehiculo,
              icon: isCreatingVehiculo
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save),
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
            (selectedVehicleType != null &&
                selectedVehiculoId != null &&
                vehiculos.isNotEmpty &&
                !isSubmitting &&
                !isLoadingVehiculos)
            ? _submitReservation
            : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.secondary,
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
