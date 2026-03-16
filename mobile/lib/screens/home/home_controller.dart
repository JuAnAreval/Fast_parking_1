import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../constants/constants.dart';
import '../../services/api_service.dart';

class HomeController extends ChangeNotifier {
  final List<dynamic> _parqueaderos = <dynamic>[];
  final List<Map<String, dynamic>> _tarifas = <Map<String, dynamic>>[];

  Map<String, dynamic>? _selectedParqueadero;
  Map<String, dynamic>? _reservaActiva;
  Map<String, dynamic>? _reservaCompletada;

  bool _loading = true;
  bool _loadingTarifas = false;
  int _tiempoRestante = 0;
  bool _disposed = false;
  bool _syncingReserva = false;

  static const int _reservaPendienteMensajeSegundos = 14 * 60;

  Timer? _statusSyncTimer;

  VoidCallback? onReservationActivated;

  List<dynamic> get parqueaderos => List<dynamic>.unmodifiable(_parqueaderos);
  List<Map<String, dynamic>> get tarifas =>
      List<Map<String, dynamic>>.unmodifiable(_tarifas);
  Map<String, dynamic>? get selectedParqueadero => _selectedParqueadero;
  Map<String, dynamic>? get reservaActiva => _reservaActiva;
  Map<String, dynamic>? get reservaCompletada => _reservaCompletada;
  bool get loading => _loading;
  bool get loadingTarifas => _loadingTarifas;
  int get tiempoRestante => _tiempoRestante;
  bool get hasReservaActiva => _reservaActiva != null;

  Future<void> initialize() async {
    await loadParqueaderos();
    if (_disposed) return;

    await Future<void>.delayed(const Duration(milliseconds: 350));
    if (_disposed) return;

    await checkReservaActiva(notifyOnActivation: false);
    if (_disposed) return;

    _startReservaStatusSync();
  }

  Future<void> loadParqueaderos() async {
    if (_disposed) return;

    _loading = true;
    _selectedParqueadero = null;
    _tarifas.clear();
    _notify();

    final result = await ApiService.getParqueaderos();
    if (_disposed) return;

    if (result['success'] == true && result['data'] is List) {
      _parqueaderos
        ..clear()
        ..addAll(result['data'] as List);
    } else {
      _parqueaderos.clear();
    }

    _loading = false;
    _notify();
  }

  Future<void> checkReservaActiva({bool notifyOnActivation = true}) async {
    if (_syncingReserva || _disposed) return;

    final userId = await ApiService.getUserId();
    if (_disposed) return;

    if (userId == null) {
      if (_reservaActiva != null || _reservaCompletada != null) {
        _reservaActiva = null;
        _reservaCompletada = null;
        _tiempoRestante = 0;
        _notify();
      }
      return;
    }

    _syncingReserva = true;
    final previousReservaId = _asInt(_reservaActiva?['id']);
    final previousEstado = _reservaActiva?['estado']?.toString().toLowerCase();

    final result = await ApiService.getReservasUsuario(userId);

    if (_disposed) {
      _syncingReserva = false;
      return;
    }

    if (result['success'] != true || result['data'] is! List) {
      _syncingReserva = false;
      return;
    }

    final List<dynamic> reservas = result['data'] as List<dynamic>;
    Map<String, dynamic>? reserva;
    for (final item in reservas) {
      if (item is! Map) continue;
      final data = Map<String, dynamic>.from(item);
      final estado = data['estado']?.toString();
      if (estado == 'activa' || estado == 'pendiente') {
        reserva = data;
        break;
      }
    }

    if (reserva == null) {
      final reservaPrevia = _findReservaById(reservas, previousReservaId);
      final estadoPrevioActualizado = reservaPrevia?['estado']
          ?.toString()
          .toLowerCase();

      _reservaActiva = null;
      _tiempoRestante = 0;
      if (previousEstado == 'activa' &&
          estadoPrevioActualizado == 'completada') {
        _reservaCompletada = reservaPrevia;
      }
      _syncingReserva = false;
      _notify();
      return;
    }

    final estado = reserva['estado']?.toString().toLowerCase();
    final reservaId = _asInt(reserva['id']);

    _reservaActiva = reserva;
    _reservaCompletada = null;
    if (estado == 'pendiente') {
      _tiempoRestante = _reservaPendienteMensajeSegundos;
    } else {
      _tiempoRestante = 0;
    }

    final justActivated =
        notifyOnActivation &&
        previousReservaId != null &&
        reservaId != null &&
        previousReservaId == reservaId &&
        previousEstado == 'pendiente' &&
        estado == 'activa';

    _syncingReserva = false;
    _notify();

    if (justActivated) {
      onReservationActivated?.call();
    }
  }

  Future<bool> selectParqueadero(Map<String, dynamic> parqueadero) async {
    if (hasReservaActiva || _disposed) return false;

    _selectedParqueadero = parqueadero;
    _loadingTarifas = true;
    _notify();

    final parqueaderoId = _asInt(parqueadero['id']);
    if (parqueaderoId == null) {
      _tarifas.clear();
      _loadingTarifas = false;
      _notify();
      return true;
    }

    final result = await ApiService.getTarifas(parqueaderoId);
    if (_disposed) return true;

    if (result['success'] == true && result['data'] is List) {
      _tarifas.clear();
      for (final item in result['data'] as List) {
        if (item is Map) {
          final tarifa = Map<String, dynamic>.from(item);
          if (_isTarifaConfigurada(tarifa)) {
            _tarifas.add(tarifa);
          }
        }
      }
    } else {
      _tarifas.clear();
    }

    _loadingTarifas = false;
    _notify();
    return true;
  }

  void unselectParqueadero() {
    if (_disposed) return;
    _selectedParqueadero = null;
    _tarifas.clear();
    _notify();
  }

  Future<Map<String, dynamic>> crearReserva(
    Map<String, dynamic> reservaData,
  ) async {
    final result = await ApiService.crearReserva(reservaData);
    if (_disposed) return result;

    if (result['success'] == true && result['data'] is Map) {
      _reservaActiva = Map<String, dynamic>.from(result['data'] as Map);
      _reservaCompletada = null;
      final estado = _reservaActiva?['estado']?.toString().toLowerCase();
      if (estado == 'pendiente') {
        _tiempoRestante = _reservaPendienteMensajeSegundos;
      } else {
        _tiempoRestante = 0;
      }
      _notify();
      return result;
    }

    // Si el POST fallo por red, intentamos sincronizar para detectar si
    // la reserva se alcanzÃ³ a crear en backend.
    await checkReservaActiva(notifyOnActivation: false);
    if (_disposed) return result;

    if (_reservaActiva != null) {
      return {
        'success': true,
        'data': _reservaActiva,
        'message': 'Reserva sincronizada correctamente.',
      };
    }

    return result;
  }

  Future<void> cancelarReservaActiva({required bool notifyApi}) async {
    if (_reservaActiva == null) return;

    final reservaId = _asInt(_reservaActiva!['id']);
    if (notifyApi && reservaId != null) {
      await ApiService.cancelarReserva(reservaId);
    }
    if (_disposed) return;

    _reservaActiva = null;
    _tiempoRestante = 0;
    _notify();
  }

  void dismissReservaCompletada() {
    if (_reservaCompletada == null) return;
    _reservaCompletada = null;
    _notify();
  }

  void _startReservaStatusSync() {
    _statusSyncTimer?.cancel();
    _statusSyncTimer = Timer.periodic(AppDuration.reservaSyncInterval, (_) {
      if (_disposed) return;
      unawaited(checkReservaActiva());
    });
  }

  int? _asInt(dynamic value) {
    if (value is int) return value;
    if (value is String) return int.tryParse(value);
    return null;
  }

  Map<String, dynamic>? _findReservaById(
    List<dynamic> reservas,
    int? reservaId,
  ) {
    if (reservaId == null) return null;

    for (final item in reservas) {
      if (item is! Map) continue;
      final data = Map<String, dynamic>.from(item);
      if (_asInt(data['id']) == reservaId) {
        return data;
      }
    }
    return null;
  }

  double _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0;
    return 0;
  }

  bool _isTarifaConfigurada(Map<String, dynamic> tarifa) {
    final hasNewStructure =
        tarifa.containsKey('tarifa_primera_hora') ||
        tarifa.containsKey('tarifa_hora_adicional');

    if (hasNewStructure) {
      final primeraHora = _asDouble(tarifa['tarifa_primera_hora']);
      final horaAdicional = _asDouble(tarifa['tarifa_hora_adicional']);
      return primeraHora > 0 && horaAdicional > 0;
    }

    final tarifaHora = _asDouble(tarifa['tarifa_hora']);
    return tarifaHora > 0;
  }

  void _notify() {
    if (_disposed) return;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _statusSyncTimer?.cancel();
    super.dispose();
  }
}
