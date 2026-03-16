import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Decodifica JSON en un isolate para no bloquear el hilo principal (evita "Skipped frames").
dynamic _decodeJsonInIsolate(String body) {
  try {
    return jsonDecode(body);
  } catch (_) {
    return null;
  }
}

class ApiService {
  static const String _apiScheme = String.fromEnvironment(
    'API_SCHEME',
    defaultValue: 'http',
  );
  static const String _apiHost = String.fromEnvironment(
    'API_HOST',
    defaultValue: '127.0.0.1',
  );
  static const String _apiHostAlt = String.fromEnvironment(
    'API_HOST_ALT',
    defaultValue: '',
  );
  static const int _apiPort = int.fromEnvironment(
    'API_PORT',
    defaultValue: 3000,
  );

  static List<String> _buildHostCandidates() {
    final ordered = <String>[];

    if (kIsWeb) {
      ordered.addAll(['localhost', _apiHost, _apiHostAlt]);
    } else if (defaultTargetPlatform == TargetPlatform.android) {
      ordered.addAll([
        '10.0.2.2',
        '10.0.3.2',
        _apiHost,
        _apiHostAlt,
        '192.168.56.1',
        '127.0.0.1',
        'localhost',
      ]);
    } else {
      ordered.addAll(['localhost', _apiHost, _apiHostAlt]);
    }

    final seen = <String>{};
    final uniqueHosts = <String>[];
    for (final host in ordered) {
      final trimmed = host.trim();
      if (trimmed.isEmpty) continue;
      if (seen.add(trimmed)) {
        uniqueHosts.add(trimmed);
      }
    }

    return uniqueHosts;
  }

  static List<String> _buildBaseUrls(String endpointGroup) {
    return _buildHostCandidates()
        .map((host) => '$_apiScheme://$host:$_apiPort/api/$endpointGroup')
        .toList(growable: false);
  }

  static final List<String> _baseUrls = _buildBaseUrls('auth');
  static final List<String> _parqueaderoBaseUrls = _buildBaseUrls(
    'parqueaderos',
  );
  static final List<String> _reservasBaseUrls = _buildBaseUrls('reservas');
  static final List<String> _vehiculosBaseUrls = _buildBaseUrls('vehiculos');
  static const String _serverUnavailableMessage =
      'No se pudo confirmar la respuesta del servidor. Verifica tu conexion e intenta nuevamente.';

  // Helper para procesar el cuerpo de la respuesta JSON de forma segura
  static Map<String, dynamic> _parseBody(String body) {
    try {
      return jsonDecode(body) as Map<String, dynamic>;
    } catch (e) {
      // Retorna el cuerpo sin parsear si no es un JSON válido
      return {'message': 'Invalid JSON response', 'raw': body};
    }
  }

  // Helper genérico para realizar POSTs con múltiples URLs de fallback
  static bool _isInvalidJsonPayload(Map<String, dynamic> parsed) =>
      parsed['message'] == 'Invalid JSON response';

  static String _responseMessage(
    Map<String, dynamic> parsed, [
    String fallback = 'Error desconocido',
  ]) {
    return (parsed['message'] ?? parsed['mensaje'] ?? fallback).toString();
  }

  static bool _isFallbackStatus(int statusCode) =>
      statusCode == 404 || statusCode == 405;

  static Future<Map<String, dynamic>> _postWithFallback(
    String endpoint,
    Map<String, dynamic> bodyPayload, {
    http.Client? client,
  }) async {
    // Usamos el cliente proporcionado o creamos uno nuevo
    final httpClient = client ?? http.Client();

    final candidateBases = _candidateBases(_baseUrls, _workingAuthBaseUrl);
    for (final base in candidateBases) {
      final url = '$base$endpoint';
      try {
        final response = await httpClient
            .post(
              Uri.parse(url),
              headers: {"Content-Type": "application/json"},
              body: jsonEncode(bodyPayload),
            )
            .timeout(
              const Duration(seconds: 1),
            ); // Timeout reducido para más rapidez

        final parsed = _parseBody(response.body);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (_isInvalidJsonPayload(parsed)) {
            continue;
          }
          _workingAuthBaseUrl = base;
          _syncWorkingBasesFromAuthBase(base);
          return {'success': true, 'data': parsed};
        }
        if (_isFallbackStatus(response.statusCode)) {
          continue;
        }
        return {'success': false, 'message': _responseMessage(parsed)};
      } catch (_) {}
    }
    return {'success': false, 'message': _serverUnavailableMessage};
  }

  // Métodos de autenticación
  static Future<Map<String, dynamic>> login(
    String email,
    String password,
  ) async {
    return _postWithFallback('/login', {'email': email, 'password': password});
  }

  static Future<Map<String, dynamic>> register(
    String nombre,
    String email,
    String telefono,
    String password,
  ) async {
    return _postWithFallback('/register', {
      'nombre': nombre,
      'email': email,
      'telefono': telefono,
      'password': password,
    });
  }

  static Future<Map<String, dynamic>> getProfile() async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final candidateBases = _candidateBases(_baseUrls, _workingAuthBaseUrl);
    for (final base in candidateBases) {
      try {
        final response = await http
            .get(
              Uri.parse('$base/me'),
              headers: {'Authorization': 'Bearer $token'},
            )
            .timeout(const Duration(seconds: 2));

        final parsed = _parseBody(response.body);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (_isInvalidJsonPayload(parsed)) {
            continue;
          }
          _workingAuthBaseUrl = base;
          _syncWorkingBasesFromAuthBase(base);
          return {'success': true, 'data': parsed};
        }
        if (_isFallbackStatus(response.statusCode)) {
          continue;
        }
        return {'success': false, 'message': _responseMessage(parsed)};
      } catch (_) {}
    }

    return {'success': false, 'message': _serverUnavailableMessage};
  }

  static Future<Map<String, dynamic>> updateProfile({
    required String nombre,
    required String email,
    required String telefono,
  }) async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final payload = {'nombre': nombre, 'email': email, 'telefono': telefono};

    final candidateBases = _candidateBases(_baseUrls, _workingAuthBaseUrl);
    for (final base in candidateBases) {
      try {
        final response = await http
            .put(
              Uri.parse('$base/me'),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
              },
              body: jsonEncode(payload),
            )
            .timeout(const Duration(seconds: 2));

        final parsed = _parseBody(response.body);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (_isInvalidJsonPayload(parsed)) {
            continue;
          }
          _workingAuthBaseUrl = base;
          _syncWorkingBasesFromAuthBase(base);
          return {'success': true, 'data': parsed};
        }
        if (_isFallbackStatus(response.statusCode)) {
          continue;
        }
        return {'success': false, 'message': _responseMessage(parsed)};
      } catch (_) {}
    }

    return {'success': false, 'message': _serverUnavailableMessage};
  }

  static Future<Map<String, dynamic>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final payload = {
      'password_actual': currentPassword,
      'password_nueva': newPassword,
    };

    final candidateBases = _candidateBases(_baseUrls, _workingAuthBaseUrl);
    for (final base in candidateBases) {
      try {
        final response = await http
            .put(
              Uri.parse('$base/me/password'),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
              },
              body: jsonEncode(payload),
            )
            .timeout(const Duration(seconds: 2));

        final parsed = _parseBody(response.body);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (_isInvalidJsonPayload(parsed)) {
            continue;
          }
          _workingAuthBaseUrl = base;
          _syncWorkingBasesFromAuthBase(base);
          return {'success': true, 'data': parsed};
        }
        if (_isFallbackStatus(response.statusCode)) {
          continue;
        }
        return {'success': false, 'message': _responseMessage(parsed)};
      } catch (_) {}
    }

    return {'success': false, 'message': _serverUnavailableMessage};
  }

  // Métodos para parqueaderos (peticiones en paralelo + JSON en isolate para no bloquear UI)
  static const Duration _requestTimeout = Duration(seconds: 2);
  static const Duration _mutationTimeout = Duration(seconds: 4);
  static String? _workingAuthBaseUrl;
  static String? _workingParqueaderoBaseUrl;
  static String? _workingReservasBaseUrl;
  static String? _workingVehiculosBaseUrl;
  static final Future<SharedPreferences> _prefsFuture =
      SharedPreferences.getInstance();

  static List<String> _candidateBases(List<String> bases, String? workingBase) {
    return <String>[
      if (workingBase != null) workingBase,
      ...bases.where((b) => b != workingBase),
    ];
  }

  static void _syncWorkingBasesFromAuthBase(String authBase) {
    const marker = '/api/auth';
    final markerIndex = authBase.indexOf(marker);
    if (markerIndex < 0) return;

    final root = authBase.substring(0, markerIndex);
    _workingParqueaderoBaseUrl = '$root/api/parqueaderos';
    _workingReservasBaseUrl = '$root/api/reservas';
    _workingVehiculosBaseUrl = '$root/api/vehiculos';
  }

  static Future<Map<String, dynamic>?> _getParqueaderosOne(
    String base,
    String token,
  ) async {
    try {
      final response = await http
          .get(Uri.parse(base), headers: {'Authorization': 'Bearer $token'})
          .timeout(_requestTimeout);
      if (response.statusCode == 200) {
        final data = await compute(_decodeJsonInIsolate, response.body);
        if (data != null) return {'success': true, 'data': data};
      }
    } catch (_) {}
    return null;
  }

  static Future<Map<String, dynamic>> getParqueaderos() async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final candidateBases = <String>[
      if (_workingParqueaderoBaseUrl != null) _workingParqueaderoBaseUrl!,
      ..._parqueaderoBaseUrls.where((b) => b != _workingParqueaderoBaseUrl),
    ];

    for (final base in candidateBases) {
      final result = await _getParqueaderosOne(base, token);
      if (result != null) {
        _workingParqueaderoBaseUrl = base;
        return result;
      }
    }

    return {'success': false, 'message': _serverUnavailableMessage};
  }

  static Future<Map<String, dynamic>?> _getTarifasOne(
    String base,
    String token,
    int parqueaderoId,
  ) async {
    try {
      final response = await http
          .get(
            Uri.parse('$base/$parqueaderoId/tarifas'),
            headers: {'Authorization': 'Bearer $token'},
          )
          .timeout(_requestTimeout);
      if (response.statusCode == 200) {
        final data = await compute(_decodeJsonInIsolate, response.body);
        if (data != null) return {'success': true, 'data': data};
      }
    } catch (_) {}
    return null;
  }

  static Future<Map<String, dynamic>> getTarifas(int parqueaderoId) async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final candidateBases = <String>[
      if (_workingParqueaderoBaseUrl != null) _workingParqueaderoBaseUrl!,
      ..._parqueaderoBaseUrls.where((b) => b != _workingParqueaderoBaseUrl),
    ];

    for (final base in candidateBases) {
      final result = await _getTarifasOne(base, token, parqueaderoId);
      if (result != null) {
        _workingParqueaderoBaseUrl = base;
        return result;
      }
    }

    return {'success': false, 'message': _serverUnavailableMessage};
  }

  // Métodos para reservas
  static Future<Map<String, dynamic>> crearReserva(
    Map<String, dynamic> reservaData,
  ) async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }
    final userId = await getUserId();
    if (userId == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final payload = <String, dynamic>{
      ...reservaData,
      'usuario_id': reservaData['usuario_id'] ?? userId,
      'fecha_reserva':
          reservaData['fecha_reserva'] ??
          DateTime.now().toIso8601String().split('T').first,
    };

    if (_workingReservasBaseUrl == null) {
      await getReservasUsuario(userId);
    }

    final candidateBases = (_workingReservasBaseUrl != null)
        ? <String>[_workingReservasBaseUrl!]
        : _candidateBases(_reservasBaseUrls, _workingReservasBaseUrl);

    for (final base in candidateBases) {
      try {
        final response = await http
            .post(
              Uri.parse(base),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
              },
              body: jsonEncode(payload),
            )
            .timeout(_mutationTimeout);

        final parsed = _parseBody(response.body);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          _workingReservasBaseUrl = base;
          return {'success': true, 'data': parsed};
        }
        if (_isFallbackStatus(response.statusCode)) {
          continue;
        }
        return {
          'success': false,
          'message': parsed['message'] ?? 'Error desconocido',
        };
      } catch (_) {}
    }
    return {'success': false, 'message': _serverUnavailableMessage};
  }

  static Future<Map<String, dynamic>?> _getReservasUsuarioOne(
    String base,
    String token,
    int usuarioId,
  ) async {
    try {
      final response = await http
          .get(
            Uri.parse('$base/usuario/$usuarioId'),
            headers: {'Authorization': 'Bearer $token'},
          )
          .timeout(_requestTimeout);
      if (response.statusCode == 200) {
        final data = await compute(_decodeJsonInIsolate, response.body);
        if (data != null) return {'success': true, 'data': data};
      }
    } catch (_) {}
    return null;
  }

  static Future<Map<String, dynamic>> getReservasUsuario(int usuarioId) async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final candidateBases = _candidateBases(
      _reservasBaseUrls,
      _workingReservasBaseUrl,
    );

    for (final base in candidateBases) {
      final result = await _getReservasUsuarioOne(base, token, usuarioId);
      if (result != null) {
        _workingReservasBaseUrl = base;
        return result;
      }
    }

    return {'success': false, 'message': _serverUnavailableMessage};
  }

  static Future<Map<String, dynamic>> autorizarIngreso(int reservaId) async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final candidateBases = _candidateBases(
      _reservasBaseUrls,
      _workingReservasBaseUrl,
    );

    for (final base in candidateBases) {
      try {
        final response = await http
            .put(
              Uri.parse('$base/$reservaId/autorizar-ingreso'),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
              },
            )
            .timeout(_mutationTimeout);

        final parsed = _parseBody(response.body);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          _workingReservasBaseUrl = base;
          return {'success': true, 'data': parsed};
        }
        if (_isFallbackStatus(response.statusCode)) {
          continue;
        }
        return {
          'success': false,
          'message': parsed['message'] ?? 'Error desconocido',
        };
      } catch (_) {}
    }
    return {'success': false, 'message': _serverUnavailableMessage};
  }

  static Future<Map<String, dynamic>> cancelarReserva(int reservaId) async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final candidateBases = _candidateBases(
      _reservasBaseUrls,
      _workingReservasBaseUrl,
    );

    for (final base in candidateBases) {
      try {
        final response = await http
            .put(
              Uri.parse('$base/$reservaId/cancelar'),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
              },
            )
            .timeout(_mutationTimeout);

        final parsed = _parseBody(response.body);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          _workingReservasBaseUrl = base;
          return {'success': true, 'data': parsed};
        }
        if (_isFallbackStatus(response.statusCode)) {
          continue;
        }
        return {
          'success': false,
          'message': parsed['message'] ?? 'Error desconocido',
        };
      } catch (_) {}
    }
    return {'success': false, 'message': _serverUnavailableMessage};
  }

  static Future<Map<String, dynamic>> completarReserva(int reservaId) async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final candidateBases = _candidateBases(
      _reservasBaseUrls,
      _workingReservasBaseUrl,
    );

    for (final base in candidateBases) {
      try {
        final response = await http
            .put(
              Uri.parse('$base/$reservaId/completar'),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
              },
            )
            .timeout(_mutationTimeout);

        final parsed = _parseBody(response.body);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          _workingReservasBaseUrl = base;
          return {'success': true, 'data': parsed};
        }
        if (_isFallbackStatus(response.statusCode)) {
          continue;
        }
        return {
          'success': false,
          'message': parsed['message'] ?? 'Error desconocido',
        };
      } catch (_) {}
    }
    return {'success': false, 'message': _serverUnavailableMessage};
  }

  static Future<Map<String, dynamic>> getTarifa(int reservaId) async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final candidateBases = _candidateBases(
      _reservasBaseUrls,
      _workingReservasBaseUrl,
    );

    for (final base in candidateBases) {
      try {
        final response = await http
            .get(
              Uri.parse('$base/$reservaId/tarifa'),
              headers: {'Authorization': 'Bearer $token'},
            )
            .timeout(_requestTimeout);

        if (response.statusCode == 200) {
          final data = await compute(_decodeJsonInIsolate, response.body);
          if (data != null) {
            _workingReservasBaseUrl = base;
            return {'success': true, 'data': data};
          }
        }
        if (_isFallbackStatus(response.statusCode)) {
          continue;
        }
        final parsed = _parseBody(response.body);
        return {
          'success': false,
          'message': parsed['message'] ?? 'Error desconocido',
        };
      } catch (_) {}
    }
    return {'success': false, 'message': _serverUnavailableMessage};
  }

  // Método para obtener tarifas de un parqueadero (actualizado para nueva estructura)
  static Future<Map<String, dynamic>> getTarifasParqueadero(
    int parqueaderoId,
  ) async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final candidateBases = _candidateBases(
      _parqueaderoBaseUrls,
      _workingParqueaderoBaseUrl,
    );

    for (final base in candidateBases) {
      try {
        final response = await http
            .get(
              Uri.parse('$base/$parqueaderoId/tarifas'),
              headers: {'Authorization': 'Bearer $token'},
            )
            .timeout(const Duration(seconds: 1)); // Timeout reducido

        if (response.statusCode == 200) {
          final data = await compute(_decodeJsonInIsolate, response.body);
          if (data != null) {
            _workingParqueaderoBaseUrl = base;
            return {'success': true, 'data': data};
          }
          continue;
        }
        if (_isFallbackStatus(response.statusCode)) {
          continue;
        }
        final parsed = _parseBody(response.body);
        return {'success': false, 'message': _responseMessage(parsed)};
      } catch (_) {}
    }
    return {'success': false, 'message': _serverUnavailableMessage};
  }

  // Métodos de autenticación con token
  static Future<Map<String, dynamic>?> _getVehiculosOne(
    String base,
    String token,
  ) async {
    try {
      final response = await http
          .get(
            Uri.parse('$base/mios'),
            headers: {'Authorization': 'Bearer $token'},
          )
          .timeout(_requestTimeout);

      if (response.statusCode == 200) {
        final data = await compute(_decodeJsonInIsolate, response.body);
        if (data != null) return {'success': true, 'data': data};
        return null;
      }
      if (_isFallbackStatus(response.statusCode)) {
        return null;
      }
      final parsed = _parseBody(response.body);
      return {'success': false, 'message': _responseMessage(parsed)};
    } catch (_) {}
    return null;
  }

  static Future<Map<String, dynamic>> getVehiculosUsuario() async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final candidateBases = <String>[
      if (_workingVehiculosBaseUrl != null) _workingVehiculosBaseUrl!,
      ..._vehiculosBaseUrls.where((b) => b != _workingVehiculosBaseUrl),
    ];

    for (final base in candidateBases) {
      final result = await _getVehiculosOne(base, token);
      if (result != null && result['success'] == true) {
        _workingVehiculosBaseUrl = base;
        return result;
      }
      if (result != null && result['success'] == false) {
        return result;
      }
    }

    return {'success': false, 'message': _serverUnavailableMessage};
  }

  static Future<Map<String, dynamic>> crearVehiculo(
    Map<String, dynamic> vehiculoData,
  ) async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final candidateBases = <String>[
      if (_workingVehiculosBaseUrl != null) _workingVehiculosBaseUrl!,
      ..._vehiculosBaseUrls.where((b) => b != _workingVehiculosBaseUrl),
    ];

    for (final base in candidateBases) {
      try {
        final response = await http
            .post(
              Uri.parse(base),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
              },
              body: jsonEncode(vehiculoData),
            )
            .timeout(_requestTimeout);

        final parsed = _parseBody(response.body);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (_isInvalidJsonPayload(parsed)) {
            continue;
          }
          _workingVehiculosBaseUrl = base;
          return {'success': true, 'data': parsed};
        }
        if (_isFallbackStatus(response.statusCode)) {
          continue;
        }
        return {'success': false, 'message': _responseMessage(parsed)};
      } catch (_) {}
    }

    return {'success': false, 'message': _serverUnavailableMessage};
  }

  static Future<Map<String, dynamic>> actualizarVehiculo(
    int vehiculoId,
    Map<String, dynamic> vehiculoData,
  ) async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final candidateBases = <String>[
      if (_workingVehiculosBaseUrl != null) _workingVehiculosBaseUrl!,
      ..._vehiculosBaseUrls.where((b) => b != _workingVehiculosBaseUrl),
    ];

    for (final base in candidateBases) {
      try {
        final response = await http
            .put(
              Uri.parse('$base/$vehiculoId'),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $token',
              },
              body: jsonEncode(vehiculoData),
            )
            .timeout(_requestTimeout);

        final parsed = _parseBody(response.body);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (_isInvalidJsonPayload(parsed)) {
            continue;
          }
          _workingVehiculosBaseUrl = base;
          return {'success': true, 'data': parsed};
        }
        if (_isFallbackStatus(response.statusCode)) {
          continue;
        }
        return {'success': false, 'message': _responseMessage(parsed)};
      } catch (_) {}
    }

    return {'success': false, 'message': _serverUnavailableMessage};
  }

  static Future<Map<String, dynamic>> eliminarVehiculo(int vehiculoId) async {
    final token = await _getToken();
    if (token == null) {
      return {'success': false, 'message': 'Usuario no autenticado'};
    }

    final candidateBases = <String>[
      if (_workingVehiculosBaseUrl != null) _workingVehiculosBaseUrl!,
      ..._vehiculosBaseUrls.where((b) => b != _workingVehiculosBaseUrl),
    ];

    for (final base in candidateBases) {
      try {
        final response = await http
            .delete(
              Uri.parse('$base/$vehiculoId'),
              headers: {'Authorization': 'Bearer $token'},
            )
            .timeout(_requestTimeout);

        final parsed = _parseBody(response.body);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (_isInvalidJsonPayload(parsed)) {
            continue;
          }
          _workingVehiculosBaseUrl = base;
          return {'success': true, 'data': parsed};
        }
        if (_isFallbackStatus(response.statusCode)) {
          continue;
        }
        return {'success': false, 'message': _responseMessage(parsed)};
      } catch (_) {}
    }

    return {'success': false, 'message': _serverUnavailableMessage};
  }

  static Future<void> saveToken(String token) async {
    final prefs = await _prefsFuture;
    await prefs.setString('auth_token', token);
  }

  static Future<String?> getToken() async {
    final prefs = await _prefsFuture;
    return prefs.getString('auth_token');
  }

  static Future<String?> _getToken() async {
    final prefs = await _prefsFuture;
    return prefs.getString('auth_token');
  }

  static Future<void> logout() async {
    final prefs = await _prefsFuture;
    await prefs.remove('auth_token');
    await prefs.remove('user_id');
  }

  // Opcional: almacenar y obtener user id (guardarlo tras el login si la app lo hace)
  static Future<void> saveUserId(int userId) async {
    final prefs = await _prefsFuture;
    await prefs.setInt('user_id', userId);
  }

  static Future<int?> getUserId() async {
    final prefs = await _prefsFuture;
    return prefs.getInt('user_id');
  }
}
