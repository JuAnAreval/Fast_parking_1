import 'package:flutter/material.dart';
import '../../constants/constants.dart';
import '../../utils/vehicle_rules.dart';

/// Widget que muestra la tarjeta de detalles del parqueadero
class ParkingDetailCard extends StatelessWidget {
  final Map<String, dynamic> parqueadero;
  final List<Map<String, dynamic>> tarifas;
  final bool loadingTarifas;
  final VoidCallback onClose;
  final VoidCallback onReservar;

  const ParkingDetailCard({
    super.key,
    required this.parqueadero,
    required this.tarifas,
    required this.loadingTarifas,
    required this.onClose,
    required this.onReservar,
  });

  @override
  Widget build(BuildContext context) {
    final disponible =
        parqueadero['disponible'] == 1 ||
        parqueadero['disponible'] == true ||
        parqueadero['disponible']?.toString().toLowerCase() == 'true';
    final statusColor = disponible
        ? AppColors.accent
        : Colors.redAccent.shade400;
    final statusText = disponible ? "Disponible" : "No disponible";

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppConstants.borderRadius),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.07),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(AppConstants.paddingLarge),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(statusColor, statusText),
          const Divider(height: 25, thickness: 1),
          _buildInfoRow(
            icon: Icons.map_outlined,
            label: "Dirección",
            value: parqueadero['direccion'] ?? 'N/A',
            color: AppColors.primary,
          ),
          const SizedBox(height: 8),
          _buildInfoRow(
            icon: Icons.directions_car_filled_rounded,
            label: "Cupos disponibles",
            value: parqueadero['cupos']?.toString() ?? 'N/A',
            color: AppColors.primary,
          ),
          const SizedBox(height: 12),
          _buildSupportedTypesSection(),
          const SizedBox(height: 12),
          _buildTarifasSection(),
          const SizedBox(height: 20),
          _buildReservarButton(disponible),
        ],
      ),
    );
  }

  Widget _buildSupportedTypesSection() {
    final tipos =
        (parqueadero['tipos_vehiculo_habilitados'] as List<dynamic>? ??
                const <dynamic>[])
            .map((item) => normalizeVehicleType(item?.toString()))
            .where((item) => item.isNotEmpty)
            .toList();

    if (tipos.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Recibe:',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: AppColors.text,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: tipos
              .map(
                (tipo) => Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        vehicleTypeIcon(tipo),
                        size: 16,
                        color: AppColors.primary,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        vehicleTypeLabel(tipo),
                        style: const TextStyle(
                          color: AppColors.text,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              )
              .toList(),
        ),
      ],
    );
  }

  Widget _buildHeader(Color statusColor, String statusText) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: statusColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            Icons.local_parking_rounded,
            color: statusColor,
            size: 30,
          ),
        ),
        const SizedBox(width: 15),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                parqueadero['nombre'] ?? 'Parqueadero Desconocido',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: AppColors.text,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: statusColor,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  statusText,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
        InkWell(
          onTap: onClose,
          customBorder: const CircleBorder(),
          child: Padding(
            padding: const EdgeInsets.all(4.0),
            child: Icon(Icons.close_rounded, color: AppColors.textSecondary),
          ),
        ),
      ],
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Row(
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 10),
        Text(
          "$label: ",
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.textSecondary,
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: color,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _buildTarifasSection() {
    final tarifasVisibles = tarifas.where(_isTarifaConfigurada).toList();

    if (loadingTarifas) {
      return const Center(child: CircularProgressIndicator());
    }

    if (tarifasVisibles.isEmpty) {
      return Text(
        "Tarifas no configuradas",
        style: TextStyle(
          fontSize: 14,
          color: AppColors.textSecondary,
          fontStyle: FontStyle.italic,
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          "Tarifas por hora:",
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: AppColors.text,
          ),
        ),
        const SizedBox(height: 8),
        ...tarifasVisibles.map(
          (tarifa) => _buildInfoRow(
            icon: _getVehicleIcon(tarifa['tipo_vehiculo']),
            label: tarifa['tipo_vehiculo'].toString().toUpperCase(),
            value: _buildTarifaValue(tarifa),
            color: AppColors.accent,
          ),
        ),
      ],
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

  String _buildTarifaValue(Map<String, dynamic> tarifa) {
    final primeraHora = tarifa['tarifa_primera_hora'];
    final adicional = tarifa['tarifa_hora_adicional'];
    final legacy = tarifa['tarifa_hora'];

    if (primeraHora != null && adicional != null) {
      return '1ra: \$$primeraHora | Adic: \$$adicional';
    }
    if (legacy != null) {
      return '\$$legacy COP';
    }
    return 'N/A';
  }

  Widget _buildReservarButton(bool disponible) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: disponible ? onReservar : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: disponible
              ? AppColors.primary
              : AppColors.textSecondary.withValues(alpha: 0.55),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(15),
          ),
          padding: const EdgeInsets.symmetric(vertical: 14),
          elevation: 2,
        ),
        icon: Icon(
          disponible ? Icons.bookmark_add_rounded : Icons.block_rounded,
        ),
        label: Text(
          disponible ? "Reservar Cupo" : "No disponible",
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  IconData _getVehicleIcon(String? tipoVehiculo) {
    return vehicleTypeIcon(tipoVehiculo);
  }
}
