import 'package:flutter/material.dart';

import '../../constants/constants.dart';

class ReservationReceiptView extends StatelessWidget {
  final Map<String, dynamic> reserva;
  final VoidCallback onBackHome;
  final VoidCallback onLogout;

  const ReservationReceiptView({
    super.key,
    required this.reserva,
    required this.onBackHome,
    required this.onLogout,
  });

  String _formatTime(dynamic value) {
    final raw = value?.toString().trim() ?? '';
    if (raw.isEmpty) return '--';

    final timeMatch = RegExp(
      r'^(\d{1,2}):(\d{2})(?::(\d{2}))?$',
    ).firstMatch(raw);
    if (timeMatch != null) {
      final hh = timeMatch.group(1)!.padLeft(2, '0');
      final mm = timeMatch.group(2)!;
      final ss = (timeMatch.group(3) ?? '00').padLeft(2, '0');
      return '$hh:$mm:$ss';
    }

    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw;

    final hh = parsed.hour.toString().padLeft(2, '0');
    final mm = parsed.minute.toString().padLeft(2, '0');
    final ss = parsed.second.toString().padLeft(2, '0');
    return '$hh:$mm:$ss';
  }

  String _formatCurrency(dynamic value) {
    final n = double.tryParse(value?.toString() ?? '') ?? 0;
    final fixed = n.toStringAsFixed(0);
    final withCommas = fixed.replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'),
      (_) => ',',
    );
    return '\$$withCommas COP';
  }

  @override
  Widget build(BuildContext context) {
    final parqueadero = (reserva['parqueadero_nombre'] ?? 'Parqueadero')
        .toString();
    final direccion = (reserva['direccion'] ?? '').toString();

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        centerTitle: true,
        title: const Text(
          'Recibo de Reserva',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            onPressed: onLogout,
            icon: const Icon(Icons.logout_rounded, color: Colors.white),
            tooltip: 'Cerrar sesion',
          ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFE8FDF2), Color(0xFFF8FBFF)],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 560),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 78,
                    height: 78,
                    decoration: BoxDecoration(
                      color: AppColors.success.withValues(alpha: 0.14),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.receipt_long_rounded,
                      color: AppColors.success,
                      size: 42,
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Solicitud completada',
                    style: TextStyle(
                      fontSize: 23,
                      fontWeight: FontWeight.w800,
                      color: AppColors.text,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    parqueadero,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  if (direccion.trim().isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      direccion,
                      style: TextStyle(color: AppColors.textSecondary),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: 18),
                  _receiptLine(
                    'Hora de entrada',
                    _formatTime(reserva['hora_inicio']),
                  ),
                  _receiptLine(
                    'Hora de salida',
                    _formatTime(reserva['hora_fin']),
                  ),
                  _receiptLine(
                    'Vehiculo',
                    '${(reserva['tipo_vehiculo'] ?? 'N/A').toString().toUpperCase()}${(reserva['vehiculo_placa'] ?? '').toString().trim().isNotEmpty ? ' | ${reserva['vehiculo_placa']}' : ''}',
                  ),
                  _receiptLine(
                    'Tarifa total',
                    _formatCurrency(reserva['valor_estimado']),
                  ),
                  const SizedBox(height: 22),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: onBackHome,
                      icon: const Icon(Icons.home_rounded),
                      label: const Text(
                        'Volver a inicio',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _receiptLine(String label, String value) {
    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.12)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.text,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
