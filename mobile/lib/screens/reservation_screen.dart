import 'dart:async';

import 'package:flutter/material.dart';

import '../constants/constants.dart';
import '../services/api_service.dart';

/// Pantalla que muestra el historial de reservas del usuario.
class ReservationScreen extends StatefulWidget {
  const ReservationScreen({super.key});

  @override
  State<ReservationScreen> createState() => _ReservationScreenState();
}

class _ReservationScreenState extends State<ReservationScreen> {
  List<dynamic> _reservas = <dynamic>[];
  bool _loading = true;
  Timer? _notificationTimer;

  @override
  void initState() {
    super.initState();
    _loadReservas();
    _startNotificationTimer();
  }

  @override
  void dispose() {
    _notificationTimer?.cancel();
    super.dispose();
  }

  void _startNotificationTimer() {
    _notificationTimer = Timer.periodic(
      const Duration(minutes: 1),
      (_) => _checkNearingEnd(),
    );
  }

  void _checkNearingEnd() {
    final now = DateTime.now();
    for (final r in _reservas) {
      if (r is! Map) continue;
      final reserva = Map<String, dynamic>.from(r);
      if (reserva['estado']?.toString().toLowerCase() != 'activa') continue;

      final fecha = (reserva['fecha_reserva'] ?? '').toString().trim();
      final horaFin = (reserva['hora_fin'] ?? '').toString().trim();
      if (fecha.isEmpty || horaFin.isEmpty) continue;

      final endTime = DateTime.tryParse('${fecha}T$horaFin');
      if (endTime == null) continue;

      final diff = endTime.difference(now).inMinutes;
      if (diff <= 15 && diff > 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Reserva en ${reserva['parqueadero_nombre'] ?? 'parqueadero'} termina pronto.',
            ),
            backgroundColor: Colors.orange,
          ),
        );
      }
    }
  }

  Future<void> _loadReservas() async {
    final userId = await ApiService.getUserId();
    if (userId == null) {
      if (mounted) {
        setState(() => _loading = false);
        _showError('Usuario no autenticado');
      }
      return;
    }

    if (mounted) setState(() => _loading = true);

    final result = await ApiService.getReservasUsuario(userId);

    if (!mounted) return;

    if (result['success'] == true && result['data'] is List) {
      setState(() {
        _reservas = result['data'] as List<dynamic>;
        _loading = false;
      });
    } else {
      setState(() => _loading = false);
      _showError(result['message'] ?? 'Error al cargar reservas');
    }
  }

  int _countByEstado(String estado) {
    return _reservas.where((r) {
      if (r is! Map) return false;
      return r['estado']?.toString().toLowerCase() == estado;
    }).length;
  }

  void _showError(String message) {
    _showMessage(message, Colors.red);
  }

  void _showMessage(String message, Color color) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message), backgroundColor: color));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        elevation: 0,
        centerTitle: true,
        title: const Text(
          'Mis Reservas',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
          ),
        ),
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFEAF1FF), Color(0xFFF8FAFC)],
          ),
        ),
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: AppColors.primary),
            SizedBox(height: 10),
            Text('Cargando reservas...'),
          ],
        ),
      );
    }

    if (_reservas.isEmpty) {
      return const _EmptyReservasState();
    }

    final pendientes = _countByEstado('pendiente');
    final activas = _countByEstado('activa');
    final completadas = _countByEstado('completada');

    return RefreshIndicator(
      onRefresh: _loadReservas,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          _ReservasSummaryCard(
            total: _reservas.length,
            pendientes: pendientes,
            activas: activas,
            completadas: completadas,
          ),
          const SizedBox(height: 14),
          ..._reservas.map((item) {
            if (item is! Map) {
              return const SizedBox.shrink();
            }
            final reserva = Map<String, dynamic>.from(item);
            return _ReservationCard(reserva: reserva);
          }),
        ],
      ),
    );
  }
}

class _EmptyReservasState extends StatelessWidget {
  const _EmptyReservasState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.receipt_long_rounded,
                color: AppColors.primary,
                size: 44,
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Aun no tienes reservas',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.text,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Cuando hagas una reserva aparecera aqui con su estado y detalles.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 15),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _ReservasSummaryCard extends StatelessWidget {
  final int total;
  final int pendientes;
  final int activas;
  final int completadas;

  const _ReservasSummaryCard({
    required this.total,
    required this.pendientes,
    required this.activas,
    required this.completadas,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withValues(alpha: 0.96),
            AppColors.secondary.withValues(alpha: 0.92),
          ],
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.22),
            blurRadius: 14,
            offset: const Offset(0, 7),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Resumen',
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 18,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _miniStat('Total', total.toString()),
              _miniStat('Pendientes', pendientes.toString()),
              _miniStat('Activas', activas.toString()),
              _miniStat('Completadas', completadas.toString()),
            ],
          ),
        ],
      ),
    );
  }

  Widget _miniStat(String label, String value) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 19,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.9),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _ReservationCard extends StatelessWidget {
  final Map<String, dynamic> reserva;

  const _ReservationCard({required this.reserva});

  _StatusMeta _statusMeta(String rawEstado) {
    switch (rawEstado) {
      case 'pendiente':
        return const _StatusMeta(
          label: 'Pendiente',
          color: AppColors.warning,
          icon: Icons.schedule_rounded,
        );
      case 'activa':
        return const _StatusMeta(
          label: 'Activa',
          color: AppColors.success,
          icon: Icons.directions_car_filled_rounded,
        );
      case 'completada':
        return const _StatusMeta(
          label: 'Completada',
          color: AppColors.info,
          icon: Icons.check_circle_rounded,
        );
      case 'cancelada':
        return const _StatusMeta(
          label: 'Cancelada',
          color: AppColors.error,
          icon: Icons.cancel_rounded,
        );
      default:
        return _StatusMeta(
          label: rawEstado.isEmpty ? 'Sin estado' : rawEstado,
          color: AppColors.textSecondary,
          icon: Icons.info_rounded,
        );
    }
  }

  String _formatCurrency(dynamic value) {
    final number = double.tryParse(value?.toString() ?? '') ?? 0;
    final fixed = number.toStringAsFixed(0);
    final withCommas = fixed.replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'),
      (_) => ',',
    );
    return '\$$withCommas';
  }

  @override
  Widget build(BuildContext context) {
    final estado = (reserva['estado'] ?? '').toString().toLowerCase();
    final meta = _statusMeta(estado);

    final placa = (reserva['vehiculo_placa'] ?? '').toString().trim();
    final color = (reserva['vehiculo_color'] ?? '').toString().trim();
    final vehiculo = (reserva['tipo_vehiculo'] ?? 'N/A')
        .toString()
        .toUpperCase();

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            height: 5,
            decoration: BoxDecoration(
              color: meta.color.withValues(alpha: 0.95),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(16),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: meta.color.withValues(alpha: 0.14),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(meta.icon, color: meta.color, size: 22),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            (reserva['parqueadero_nombre'] ?? 'Parqueadero')
                                .toString(),
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: AppColors.text,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            (reserva['direccion'] ?? 'Direccion no disponible')
                                .toString(),
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: meta.color.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Text(
                        meta.label,
                        style: TextStyle(
                          color: meta.color,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _infoLine(
                  icon: Icons.schedule_rounded,
                  text:
                      'Horario: ${(reserva['hora_inicio'] ?? '--').toString()} - ${(reserva['hora_fin'] ?? '--').toString()}',
                ),
                const SizedBox(height: 6),
                _infoLine(
                  icon: Icons.directions_car_rounded,
                  text:
                      'Vehiculo: $vehiculo${placa.isNotEmpty ? ' | Placa: $placa' : ''}${color.isNotEmpty ? ' | Color: $color' : ''}',
                ),
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.payments_rounded,
                        color: AppColors.primary,
                        size: 19,
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Valor estimado',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        _formatCurrency(reserva['valor_estimado']),
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoLine({required IconData icon, required String text}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 17, color: AppColors.textSecondary),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13.5),
          ),
        ),
      ],
    );
  }
}

class _StatusMeta {
  final String label;
  final Color color;
  final IconData icon;

  const _StatusMeta({
    required this.label,
    required this.color,
    required this.icon,
  });
}
