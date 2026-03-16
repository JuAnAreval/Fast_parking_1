import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_cancellable_tile_provider/flutter_map_cancellable_tile_provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../constants/constants.dart';

/// Widget que muestra el mapa con los parqueaderos.
/// Incluye controles de ubicacion, centrado y norte arriba.
class ParkingMapView extends StatefulWidget {
  final List<dynamic> parqueaderos;
  final Map<String, dynamic>? selectedParqueadero;
  final Function(Map<String, dynamic>) onSelectParqueadero;
  final VoidCallback onTapEmpty;

  const ParkingMapView({
    super.key,
    required this.parqueaderos,
    this.selectedParqueadero,
    required this.onSelectParqueadero,
    required this.onTapEmpty,
  });

  @override
  State<ParkingMapView> createState() => _ParkingMapViewState();
}

class _ParkingMapViewState extends State<ParkingMapView> {
  late List<Marker> _cachedMarkers;
  final MapController _mapController = MapController();

  LatLng? _userLocation;
  bool _locating = false;
  double _currentZoom = AppConstants.mapZoom;
  double _currentRotation = 0;

  @override
  void initState() {
    super.initState();
    _cachedMarkers = _buildMarkers();
  }

  @override
  void didUpdateWidget(covariant ParkingMapView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.parqueaderos != widget.parqueaderos ||
        oldWidget.selectedParqueadero?['id'] !=
            widget.selectedParqueadero?['id']) {
      _cachedMarkers = _buildMarkers();
    }
  }

  @override
  Widget build(BuildContext context) {
    final markers = <Marker>[
      ..._cachedMarkers,
      if (_userLocation != null) _buildUserLocationMarker(_userLocation!),
    ];

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30)),
      child: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: const LatLng(
                AppConstants.mapCenterLat,
                AppConstants.mapCenterLng,
              ),
              initialZoom: AppConstants.mapZoom,
              initialRotation: 0,
              maxZoom: AppConstants.mapMaxZoom,
              onTap: (_, __) => widget.onTapEmpty(),
              onPositionChanged: (position, _) {
                final zoom = position.zoom;
                if (zoom != null) {
                  _currentZoom = zoom;
                }
                _currentRotation = _mapController.camera.rotation;
              },
            ),
            children: [
              TileLayer(
                urlTemplate:
                    'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
                fallbackUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                tileProvider: CancellableNetworkTileProvider(
                  silenceExceptions: false,
                ),
                userAgentPackageName: 'com.parqueaderos.usuarios',
                errorTileCallback: (tile, error, stackTrace) {
                  debugPrint(
                    'Tile error z=${tile.coordinates.z} x=${tile.coordinates.x} '
                    'y=${tile.coordinates.y} error=$error',
                  );
                },
              ),
              RichAttributionWidget(
                attributions: [
                  TextSourceAttribution(
                    'OpenStreetMap contributors, CARTO',
                    onTap: () {},
                  ),
                ],
              ),
              MarkerLayer(markers: markers),
            ],
          ),
          Positioned(
            top: 14,
            right: 10,
            child: Column(
              children: [
                _buildMapControl(
                  icon: Icons.my_location_rounded,
                  tooltip: 'Mi ubicacion',
                  loading: _locating,
                  onPressed: _locating ? null : _goToMyLocation,
                ),
                const SizedBox(height: 10),
                _buildMapControl(
                  icon: Icons.center_focus_strong_rounded,
                  tooltip: 'Centrar mapa',
                  onPressed: _centerMap,
                ),
                const SizedBox(height: 10),
                _buildMapControl(
                  icon: Icons.explore_off_rounded,
                  tooltip: 'Norte arriba',
                  onPressed: _currentRotation.abs() < 0.5
                      ? null
                      : _resetNorthUp,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapControl({
    required IconData icon,
    required String tooltip,
    required VoidCallback? onPressed,
    bool loading = false,
  }) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 3,
      child: InkWell(
        onTap: onPressed,
        customBorder: const CircleBorder(),
        child: Tooltip(
          message: tooltip,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Center(
              child: loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(
                      icon,
                      color: onPressed == null
                          ? Colors.grey.shade400
                          : AppColors.primary,
                      size: 23,
                    ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _goToMyLocation() async {
    if (_locating) return;

    setState(() => _locating = true);

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _showMessage('Activa la ubicacion del celular para continuar.');
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied) {
        _showMessage('Permiso de ubicacion denegado.');
        return;
      }

      if (permission == LocationPermission.deniedForever) {
        _showMessage(
          'Permiso de ubicacion bloqueado. Habilitalo desde ajustes del sistema.',
        );
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 8),
      );

      if (!mounted) return;

      final point = LatLng(position.latitude, position.longitude);
      setState(() => _userLocation = point);
      _mapController.move(point, _currentZoom < 16 ? 16 : _currentZoom);
    } catch (_) {
      _showMessage('No fue posible obtener tu ubicacion en este momento.');
    } finally {
      if (mounted) {
        setState(() => _locating = false);
      }
    }
  }

  void _centerMap() {
    final target =
        _asLatLng(widget.selectedParqueadero) ??
        _userLocation ??
        const LatLng(AppConstants.mapCenterLat, AppConstants.mapCenterLng);

    _mapController.move(target, _currentZoom);
  }

  void _resetNorthUp() {
    _mapController.rotate(0);
  }

  LatLng? _asLatLng(Map<String, dynamic>? data) {
    if (data == null) return null;

    final lat = double.tryParse((data['latitud'] ?? '').toString());
    final lng = double.tryParse((data['longitud'] ?? '').toString());
    if (lat == null || lng == null) return null;

    return LatLng(lat, lng);
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.orange),
    );
  }

  List<Marker> _buildMarkers() {
    return widget.parqueaderos.map((p) {
      final isSelected = widget.selectedParqueadero?['id'] == p['id'];
      return Marker(
        point: LatLng(
          double.tryParse(p['latitud'].toString()) ?? 0.0,
          double.tryParse(p['longitud'].toString()) ?? 0.0,
        ),
        width: AppConstants.markerSize,
        height: AppConstants.markerSize,
        child: GestureDetector(
          onTap: () => widget.onSelectParqueadero(p),
          child: _ParkingMarker(parqueadero: p, isSelected: isSelected),
        ),
      );
    }).toList();
  }

  Marker _buildUserLocationMarker(LatLng point) {
    return Marker(
      point: point,
      width: 26,
      height: 26,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.blue,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 3),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.2),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
      ),
    );
  }
}

class _ParkingMarker extends StatelessWidget {
  final Map<String, dynamic> parqueadero;
  final bool isSelected;

  const _ParkingMarker({required this.parqueadero, required this.isSelected});

  @override
  Widget build(BuildContext context) {
    final disponible =
        parqueadero['disponible'] == 1 ||
        parqueadero['disponible'] == true ||
        parqueadero['disponible']?.toString().toLowerCase() == 'true';
    final color = disponible ? AppColors.disponible : AppColors.noDisponible;
    final size = isSelected ? 24.0 : 18.0;

    return Container(
      decoration: BoxDecoration(
        color: isSelected ? AppColors.primary : color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 3),
      ),
      child: Icon(Icons.local_parking_rounded, color: Colors.white, size: size),
    );
  }
}
