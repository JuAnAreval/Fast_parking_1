import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../services/api_service.dart';

class HomeMapScreen extends StatefulWidget {
  const HomeMapScreen({super.key});

  @override
  State<HomeMapScreen> createState() => _HomeMapScreenState();
}

class SeleccionarVehiculoScreen extends StatefulWidget {
  final List<Map<String, dynamic>> tarifas;
  final Map<String, dynamic> parqueadero;

  const SeleccionarVehiculoScreen({
    super.key,
    required this.tarifas,
    required this.parqueadero,
  });

  @override
  State<SeleccionarVehiculoScreen> createState() =>
      _SeleccionarVehiculoScreenState();
}

class _SeleccionarVehiculoScreenState extends State<SeleccionarVehiculoScreen> {
  String? _tipoSeleccionado;

  @override
  void initState() {
    super.initState();
    if (widget.tarifas.isNotEmpty) {
      _tipoSeleccionado = widget.tarifas.first['tipo_vehiculo'];
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Seleccionar vehículo'),
        backgroundColor: Colors.blue[900],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Parqueadero: ${widget.parqueadero['nombre'] ?? ''}',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            const Text('Elige tipo de vehículo:'),
            const SizedBox(height: 8),
            if (widget.tarifas.isEmpty)
              const Text('No hay tarifas disponibles')
            else
              ...widget.tarifas
                  .where((tarifa) {
                    final primera =
                        double.tryParse(
                          tarifa['tarifa_primera_hora']?.toString() ?? '0',
                        ) ??
                        0;
                    final adicional =
                        double.tryParse(
                          tarifa['tarifa_hora_adicional']?.toString() ?? '0',
                        ) ??
                        0;
                    return primera > 0 && adicional > 0;
                  })
                  .map((tarifa) {
                    final tipo = tarifa['tipo_vehiculo'];
                    final label =
                        '${tipo.toString().toUpperCase()} - \$${tarifa['tarifa_primera_hora']}/primera hora, \$${tarifa['tarifa_hora_adicional']}/hora adicional';
                    return RadioListTile<String>(
                      title: Text(label),
                      value: tipo,
                      groupValue: _tipoSeleccionado,
                      onChanged: (v) => setState(() => _tipoSeleccionado = v),
                    );
                  }),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _tipoSeleccionado == null
                    ? null
                    : () => Navigator.pop(context, _tipoSeleccionado),
                child: const Text('Confirmar reserva'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeMapScreenState extends State<HomeMapScreen>
    with TickerProviderStateMixin {
  final MapController _mapController = MapController();
  List<Map<String, dynamic>> parqueaderos = [];
  bool cargando = true;
  Map<String, dynamic>? parqueaderoSeleccionado;
  List<Map<String, dynamic>> tarifas = [];
  bool cargandoTarifas = false;

  late AnimationController _cardAnimationController;
  late Animation<Offset> _cardOffsetAnimation;

  @override
  void initState() {
    super.initState();
    _cargarParqueaderos();

    _cardAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _cardOffsetAnimation =
        Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero).animate(
          CurvedAnimation(
            parent: _cardAnimationController,
            curve: Curves.easeOutCubic,
          ),
        );
  }

  @override
  void dispose() {
    _cardAnimationController.dispose();
    super.dispose();
  }

  Future<void> _cargarParqueaderos() async {
    setState(() => cargando = true);
    final result = await ApiService.getParqueaderos();
    if (result['success'] == true) {
      setState(() {
        parqueaderos = List<Map<String, dynamic>>.from(result['data']);
        cargando = false;
      });
    } else {
      setState(() => cargando = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? 'Error al cargar parqueaderos'),
        ),
      );
    }
  }

  Future<void> _seleccionarParqueadero(Map<String, dynamic> parqueadero) async {
    setState(() {
      parqueaderoSeleccionado = parqueadero;
      cargandoTarifas = true;
      tarifas = [];
    });
    _cardAnimationController.forward(from: 0.0);

    // Cargar tarifas en paralelo con animación para más rapidez
    final result = await ApiService.getTarifas(parqueadero['id']);
    if (result['success'] == true) {
      setState(() {
        tarifas = List<Map<String, dynamic>>.from(result['data']);
        cargandoTarifas = false;
      });
    } else {
      setState(() {
        cargandoTarifas = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['message'] ?? 'Error al cargar tarifas')),
      );
    }
  }

  void _cerrarDetalles() {
    _cardAnimationController.reverse().then((_) {
      setState(() {
        parqueaderoSeleccionado = null;
        tarifas = [];
      });
    });
  }

  Future<void> _crearReserva(
    Map<String, dynamic> parqueadero,
    String tipoVehiculo,
  ) async {
    final userId = await ApiService.getUserId();
    if (userId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Debes iniciar sesión antes de reservar')),
      );
      return;
    }

    final reservaData = {
      'usuario_id': userId,
      'parqueadero_id': parqueadero['id'],
      'tipo_vehiculo': tipoVehiculo,
      'fecha_reserva': DateTime.now().toIso8601String().split(
        'T',
      )[0], // Solo fecha
      // No enviar hora_inicio ni hora_fin para activar countdown de 15 minutos
    };

    final result = await ApiService.crearReserva(reservaData);
    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Reserva creada exitosamente. Tienes 15 minutos para autorizar.',
          ),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 5),
        ),
      );
      _cerrarDetalles();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result['message'] ?? 'Error al crear reserva')),
      );
    }
  }

  Widget _construirMarcador(Map<String, dynamic> parqueadero) {
    final bool disponible =
        parqueadero['disponible'] == true || parqueadero['disponible'] == 1;
    final bool isSelected = parqueaderoSeleccionado?['id'] == parqueadero['id'];
    return GestureDetector(
      onTap: () => _seleccionarParqueadero(parqueadero),
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: isSelected
              ? Colors.blueAccent
              : (disponible ? Colors.blue : Colors.grey),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 5,
              spreadRadius: 1,
            ),
          ],
        ),
        child: const Icon(
          Icons.local_parking_rounded,
          color: Colors.white,
          size: 22,
        ),
      ),
    );
  }

  Widget _construirTarjetaDetalles() {
    if (parqueaderoSeleccionado == null) return const SizedBox.shrink();
    return SlideTransition(
      position: _cardOffsetAnimation,
      child: Align(
        alignment: Alignment.bottomCenter,
        child: SafeArea(
          top: false,
          minimum: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Material(
            elevation: 8,
            borderRadius: BorderRadius.circular(20),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          parqueaderoSeleccionado!['nombre'] ?? '',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: _cerrarDetalles,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    parqueaderoSeleccionado!['direccion'] ?? '',
                    style: const TextStyle(fontSize: 16),
                  ),
                  const SizedBox(height: 8),
                  Text('Cupos: ${parqueaderoSeleccionado!['cupos'] ?? '-'}'),
                  const SizedBox(height: 8),
                  cargandoTarifas
                      ? const SizedBox(
                          height: 20,
                          child: Center(
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : tarifas.isNotEmpty
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Tarifas:',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                            ...tarifas
                                .where((tarifa) {
                                  final primera =
                                      double.tryParse(
                                        tarifa['tarifa_primera_hora']
                                                ?.toString() ??
                                            '0',
                                      ) ??
                                      0;
                                  final adicional =
                                      double.tryParse(
                                        tarifa['tarifa_hora_adicional']
                                                ?.toString() ??
                                            '0',
                                      ) ??
                                      0;
                                  return primera > 0 && adicional > 0;
                                })
                                .map(
                                  (tarifa) => Text(
                                    '${tarifa['tipo_vehiculo']}: \$${tarifa['tarifa_primera_hora']}/primera hora, \$${tarifa['tarifa_hora_adicional']}/hora adicional',
                                    style: const TextStyle(fontSize: 13),
                                  ),
                                ),
                          ],
                        )
                      : const Text(
                          'No hay tarifas disponibles',
                          style: TextStyle(fontSize: 13),
                        ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async {
                        // Abrir pantalla para seleccionar tipo de vehículo
                        final seleccionado = await Navigator.push<String?>(
                          context,
                          MaterialPageRoute(
                            builder: (_) => SeleccionarVehiculoScreen(
                              tarifas: tarifas,
                              parqueadero: parqueaderoSeleccionado!,
                            ),
                          ),
                        );
                        if (seleccionado != null) {
                          await _crearReserva(
                            parqueaderoSeleccionado!,
                            seleccionado,
                          );
                        }
                      },
                      child: const Text('Reservar'),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mapa de Parqueaderos'),
        backgroundColor: Colors.blue[900],
        actions: [
          IconButton(
            onPressed: _cargarParqueaderos,
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            onPressed: () async {
              await ApiService.logout();
              Navigator.pushReplacementNamed(context, '/login');
            },
            icon: const Icon(Icons.logout),
            tooltip: 'Cerrar sesión',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.pushNamed(context, '/reservations'),
        tooltip: 'Ver mis reservas',
        child: const Icon(Icons.list),
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              center: const LatLng(1.21361, -77.28111),
              zoom: 13.0,
              onTap: (_, __) => _cerrarDetalles(),
              maxZoom: 18.0,
            ),
            children: [
              TileLayer(
                // Uso de tile gratuito alternativo que respeta la política de OSM
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                subdomains: const ['a', 'b', 'c'],
                userAgentPackageName: 'com.parqueadero.usuarios',
              ),
              RichAttributionWidget(
                attributions: [
                  TextSourceAttribution(
                    '© OpenStreetMap contributors',
                    onTap: () {},
                  ),
                ],
              ),
              MarkerLayer(
                markers: parqueaderos.map((p) {
                  return Marker(
                    point: LatLng(
                      double.tryParse(p['latitud'].toString()) ?? 0,
                      double.tryParse(p['longitud'].toString()) ?? 0,
                    ),
                    width: 40,
                    height: 40,
                    child: _construirMarcador(p),
                  );
                }).toList(),
              ),
            ],
          ),
          // Atributo obligatorio visible
          Positioned(
            bottom: 4,
            right: 4,
            child: Container(
              color: Colors.white.withOpacity(0.7),
              padding: const EdgeInsets.all(2),
              child: const Text(
                '© OpenStreetMap contributors',
                style: TextStyle(fontSize: 10),
              ),
            ),
          ),
          if (cargando)
            Container(
              color: Colors.black.withOpacity(0.2),
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(strokeWidth: 3),
                    SizedBox(height: 16),
                    Text(
                      'Cargando parqueaderos...',
                      style: TextStyle(color: Colors.white, fontSize: 16),
                    ),
                  ],
                ),
              ),
            ),
          if (parqueaderoSeleccionado != null) _construirTarjetaDetalles(),
        ],
      ),
    );
  }
}
