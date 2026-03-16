import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../constants/constants.dart';

class ActiveReservationView extends StatelessWidget {
  final Map<String, dynamic> reserva;
  final VoidCallback onCancelar;
  final VoidCallback onLogout;

  const ActiveReservationView({
    super.key,
    required this.reserva,
    required this.onCancelar,
    required this.onLogout,
  });

  String get _estado =>
      (reserva['estado']?.toString().toLowerCase() ?? 'pendiente');
  bool get _esPendiente => _estado == 'pendiente';

  double? get _latitud => _asDouble(reserva['latitud']);
  double? get _longitud => _asDouble(reserva['longitud']);
  bool get _hasCoordinates => _latitud != null && _longitud != null;

  double? _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  String? get _horaLimiteLlegada {
    final raw = reserva['hora_inicio']?.toString().trim() ?? '';
    if (raw.isEmpty) return null;

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

  Future<void> _openGoogleMaps(BuildContext context) async {
    if (!_hasCoordinates) {
      _showMessage(context, 'Esta reserva no tiene coordenadas para navegar.');
      return;
    }

    final uri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$_latitud,$_longitud&travelmode=driving',
    );
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && context.mounted) {
      _showMessage(context, 'No se pudo abrir Google Maps.');
    }
  }

  Future<void> _openWaze(BuildContext context) async {
    if (!_hasCoordinates) {
      _showMessage(context, 'Esta reserva no tiene coordenadas para navegar.');
      return;
    }

    final uri = Uri.https('waze.com', '/ul', {
      'll': '$_latitud,$_longitud',
      'navigate': 'yes',
    });
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && context.mounted) {
      _showMessage(context, 'No se pudo abrir Waze.');
    }
  }

  void _showMessage(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.orange),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        elevation: 0,
        centerTitle: true,
        title: const Text(
          'Reserva Activa',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
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
            colors: [Color(0xFFEAF2FF), AppColors.background],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppConstants.paddingLarge),
              child: Container(
                constraints: const BoxConstraints(maxWidth: 560),
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(
                    AppConstants.borderRadius,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildHeaderBadge(),
                    const SizedBox(height: 20),
                    _buildParqueaderoInfo(),
                    const SizedBox(height: 20),
                    if (_esPendiente)
                      _buildPendingPanel()
                    else
                      _buildActivePanel(),
                    const SizedBox(height: 16),
                    _buildNavigationButtons(context),
                    if (_esPendiente) ...[
                      const SizedBox(height: 18),
                      _buildCancelButton(),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderBadge() {
    final color = _esPendiente ? AppColors.warning : AppColors.success;
    final icon = _esPendiente ? Icons.pending_actions : Icons.check_circle;
    final title = _esPendiente ? 'Reserva pendiente' : 'Ingreso autorizado';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            color.withValues(alpha: 0.95),
            color.withValues(alpha: 0.75),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: Colors.white, size: 25),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 18,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildParqueaderoInfo() {
    return Column(
      children: [
        Text(
          '${reserva['parqueadero_nombre'] ?? 'Parqueadero'}',
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: AppColors.text,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 6),
        if ((reserva['direccion'] ?? '').toString().trim().isNotEmpty)
          Text(
            reserva['direccion'].toString(),
            style: TextStyle(fontSize: 15, color: AppColors.textSecondary),
            textAlign: TextAlign.center,
          ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 8,
          alignment: WrapAlignment.center,
          children: [
            _infoChip(
              'Vehiculo',
              (reserva['tipo_vehiculo'] ?? 'N/A').toString(),
            ),
            if ((reserva['vehiculo_placa'] ?? '').toString().trim().isNotEmpty)
              _infoChip('Placa', reserva['vehiculo_placa'].toString()),
          ],
        ),
      ],
    );
  }

  Widget _infoChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        '$label: ${value.toUpperCase()}',
        style: const TextStyle(
          color: AppColors.primary,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _buildPendingPanel() {
    final horaLimite = _horaLimiteLlegada;
    return _statusPanel(
      color: AppColors.warning,
      icon: Icons.access_time_rounded,
      title: 'Aun no has ingresado',
      message: horaLimite == null
          ? 'Tu reserva esta pendiente de ingreso.'
          : 'Tienes hasta las $horaLimite para llegar al parqueadero.',
    );
  }

  Widget _buildActivePanel() {
    return _statusPanel(
      color: AppColors.success,
      icon: Icons.directions_car_filled_rounded,
      title: 'Ya ingresaste al parqueadero',
      message:
          'Tu reserva esta en estado activo. Te avisaremos cuando sea completada.',
    );
  }

  Widget _statusPanel({
    required Color color,
    required IconData icon,
    required String title,
    required String message,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.55), width: 1.5),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: color.withValues(alpha: 0.95),
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  message,
                  style: TextStyle(
                    color: color.withValues(alpha: 0.9),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavigationButtons(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: _hasCoordinates ? () => _openGoogleMaps(context) : null,
            icon: const Icon(Icons.map_rounded),
            label: const Text('Google Maps'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              side: BorderSide(
                color: AppColors.primary.withValues(alpha: 0.65),
              ),
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: OutlinedButton.icon(
            onPressed: _hasCoordinates ? () => _openWaze(context) : null,
            icon: const Icon(Icons.navigation_rounded),
            label: const Text('Waze'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              side: BorderSide(
                color: AppColors.primary.withValues(alpha: 0.65),
              ),
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCancelButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: onCancelar,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.error,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
        icon: const Icon(Icons.cancel_rounded),
        label: const Text(
          'Cancelar reserva',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}
