import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../constants/constants.dart';
import '../services/api_service.dart';
import '../utils/vehicle_rules.dart';

class SettingsScreen extends StatefulWidget {
  final Future<void> Function()? onLogout;

  const SettingsScreen({super.key, this.onLogout});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _nombreController = TextEditingController();
  final _emailController = TextEditingController();
  final _telefonoController = TextEditingController();
  final _actualPasswordController = TextEditingController();
  final _nuevaPasswordController = TextEditingController();
  final _confirmarPasswordController = TextEditingController();

  bool _loadingProfile = true;
  bool _loadingVehiculos = true;
  bool _savingProfile = false;
  bool _savingPassword = false;
  bool _deletingVehiculo = false;
  bool _showActual = false;
  bool _showNueva = false;
  bool _showConfirmar = false;

  List<Map<String, dynamic>> _vehiculos = <Map<String, dynamic>>[];

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadVehiculos();
  }

  @override
  void dispose() {
    _nombreController.dispose();
    _emailController.dispose();
    _telefonoController.dispose();
    _actualPasswordController.dispose();
    _nuevaPasswordController.dispose();
    _confirmarPasswordController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    setState(() => _loadingProfile = true);

    final result = await ApiService.getProfile();
    if (!mounted) return;

    if (result['success'] == true && result['data'] is Map) {
      final data = Map<String, dynamic>.from(result['data'] as Map);
      _nombreController.text = (data['nombre'] ?? '').toString();
      _emailController.text = (data['email'] ?? '').toString();
      _telefonoController.text = (data['telefono'] ?? '').toString();
    } else {
      _showMessage(
        (result['message'] ?? 'No se pudo cargar el perfil').toString(),
        Colors.red,
      );
    }

    setState(() => _loadingProfile = false);
  }

  Future<void> _loadVehiculos() async {
    setState(() => _loadingVehiculos = true);

    final result = await ApiService.getVehiculosUsuario();
    if (!mounted) return;

    if (result['success'] == true && result['data'] is List) {
      final data = (result['data'] as List)
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
      setState(() {
        _vehiculos = data;
        _loadingVehiculos = false;
      });
      return;
    }

    setState(() => _loadingVehiculos = false);
    _showMessage(
      (result['message'] ?? 'No se pudieron cargar los vehiculos').toString(),
      Colors.red,
    );
  }

  Future<void> _saveProfile() async {
    final nombre = _nombreController.text.trim();
    final email = _emailController.text.trim();
    final telefono = _telefonoController.text.trim();

    if (nombre.isEmpty || email.isEmpty || telefono.isEmpty) {
      _showMessage(
        'Nombre, correo y telefono son obligatorios.',
        Colors.orange,
      );
      return;
    }

    setState(() => _savingProfile = true);
    final result = await ApiService.updateProfile(
      nombre: nombre,
      email: email,
      telefono: telefono,
    );
    if (!mounted) return;

    setState(() => _savingProfile = false);

    if (result['success'] == true) {
      _showMessage('Perfil actualizado.', Colors.green);
    } else {
      _showMessage(
        (result['message'] ?? 'No se pudo actualizar el perfil').toString(),
        Colors.red,
      );
    }
  }

  Future<void> _changePassword() async {
    final actual = _actualPasswordController.text;
    final nueva = _nuevaPasswordController.text;
    final confirmar = _confirmarPasswordController.text;

    if (actual.isEmpty || nueva.isEmpty || confirmar.isEmpty) {
      _showMessage('Completa todos los campos de contrasena.', Colors.orange);
      return;
    }
    if (nueva.length < 6) {
      _showMessage(
        'La nueva contrasena debe tener al menos 6 caracteres.',
        Colors.orange,
      );
      return;
    }
    if (nueva != confirmar) {
      _showMessage('La confirmacion no coincide.', Colors.orange);
      return;
    }

    setState(() => _savingPassword = true);
    final result = await ApiService.changePassword(
      currentPassword: actual,
      newPassword: nueva,
    );
    if (!mounted) return;

    setState(() => _savingPassword = false);

    if (result['success'] == true) {
      _actualPasswordController.clear();
      _nuevaPasswordController.clear();
      _confirmarPasswordController.clear();
      _showMessage('Contrasena actualizada.', Colors.green);
    } else {
      _showMessage(
        (result['message'] ?? 'No se pudo actualizar la contrasena').toString(),
        Colors.red,
      );
    }
  }

  Future<void> _openVehiculoDialog({Map<String, dynamic>? vehiculo}) async {
    final isEdit = vehiculo != null;
    final vehiculoId = _asInt(vehiculo?['id']);
    final placaController = TextEditingController(
      text: (vehiculo?['placa'] ?? '').toString(),
    );
    final colorController = TextEditingController(
      text: (vehiculo?['color'] ?? '').toString(),
    );

    String tipo = normalizeVehicleType(
      (vehiculo?['tipo'] ?? 'carro').toString(),
    );
    if (!kVehicleTypes.contains(tipo)) {
      tipo = kVehicleTypes.first;
    }

    bool saving = false;
    bool placaTouched = false;
    bool? saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final requiresPlate = vehicleTypeRequiresPlate(tipo);
            final placaError = vehiclePlateError(
              tipo,
              placaController.text,
              touched: placaTouched,
            );

            return AlertDialog(
              title: Text(isEdit ? 'Editar vehiculo' : 'Nuevo vehiculo'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<String>(
                      initialValue: tipo,
                      decoration: const InputDecoration(
                        labelText: 'Tipo',
                        border: OutlineInputBorder(),
                      ),
                      items: kVehicleTypes
                          .map(
                            (item) => DropdownMenuItem<String>(
                              value: item,
                              child: Text(vehicleTypeLabel(item).toUpperCase()),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        if (value == null) return;
                        setDialogState(() {
                          tipo = value;
                          if (!vehicleTypeRequiresPlate(value)) {
                            placaController.clear();
                            placaTouched = false;
                          }
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                    if (requiresPlate)
                      TextField(
                        controller: placaController,
                        textCapitalization: TextCapitalization.characters,
                        inputFormatters: <TextInputFormatter>[
                          ...vehiclePlateInputFormatters(),
                        ],
                        decoration: InputDecoration(
                          labelText: 'Placa',
                          border: const OutlineInputBorder(),
                          hintText: vehiclePlateHint(tipo),
                          helperText:
                              'Formato esperado: ${vehiclePlateHint(tipo)}',
                          errorText: placaError,
                        ),
                        onChanged: (_) {
                          if (!placaTouched) {
                            setDialogState(() => placaTouched = true);
                            return;
                          }
                          setDialogState(() {});
                        },
                      )
                    else
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Row(
                          children: [
                            Icon(
                              Icons.pedal_bike_rounded,
                              color: AppColors.primary,
                            ),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Las bicicletas se registran sin placa.',
                              ),
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: colorController,
                      decoration: const InputDecoration(
                        labelText: 'Color',
                        border: OutlineInputBorder(),
                        hintText: 'Ej: Negro',
                      ),
                      onChanged: (_) => setDialogState(() {}),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: saving
                      ? null
                      : () => Navigator.pop(dialogContext, false),
                  child: const Text('Cancelar'),
                ),
                ElevatedButton(
                  onPressed: saving
                      ? null
                      : () async {
                          final color = colorController.text.trim();
                          final requiresPlate = vehicleTypeRequiresPlate(tipo);
                          final placa = normalizeVehiclePlate(
                            placaController.text,
                          );

                          if ((requiresPlate &&
                                  vehiclePlateError(
                                        tipo,
                                        placaController.text,
                                        touched: true,
                                      ) !=
                                      null) ||
                              color.isEmpty) {
                            setDialogState(() => placaTouched = true);
                            _showMessage(
                              requiresPlate
                                  ? (vehiclePlateError(
                                          tipo,
                                          placaController.text,
                                          touched: true,
                                        ) ??
                                        'Debes completar placa y color.')
                                  : 'Debes completar el color del vehiculo.',
                              Colors.orange,
                            );
                            return;
                          }

                          setDialogState(() => saving = true);
                          final payload = <String, dynamic>{
                            'tipo': tipo,
                            'placa': vehiclePlatePayload(tipo, placa),
                            'color': color,
                          };

                          final result = isEdit
                              ? await ApiService.actualizarVehiculo(
                                  vehiculoId ?? 0,
                                  payload,
                                )
                              : await ApiService.crearVehiculo(payload);

                          if (!dialogContext.mounted) return;

                          if (result['success'] == true) {
                            Navigator.pop(dialogContext, true);
                            return;
                          }

                          setDialogState(() => saving = false);
                          _showMessage(
                            (result['message'] ??
                                    'No se pudo guardar el vehiculo')
                                .toString(),
                            Colors.red,
                          );
                        },
                  child: saving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(isEdit ? 'Guardar cambios' : 'Guardar vehiculo'),
                ),
              ],
            );
          },
        );
      },
    );

    placaController.dispose();
    colorController.dispose();

    if (saved == true) {
      _showMessage(
        isEdit ? 'Vehiculo actualizado.' : 'Vehiculo registrado.',
        Colors.green,
      );
      await _loadVehiculos();
    }
  }

  Future<void> _eliminarVehiculo(Map<String, dynamic> vehiculo) async {
    if (_deletingVehiculo) return;

    final vehiculoId = _asInt(vehiculo['id']);
    if (vehiculoId == null) return;

    final placa = vehicleDisplayPlate(
      vehiculo['tipo']?.toString(),
      vehiculo['placa']?.toString(),
    );
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Eliminar vehiculo'),
        content: Text('Deseas eliminar el vehiculo $placa?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );

    if (confirmar != true) return;

    setState(() => _deletingVehiculo = true);
    final result = await ApiService.eliminarVehiculo(vehiculoId);
    if (!mounted) return;
    setState(() => _deletingVehiculo = false);

    if (result['success'] == true) {
      _showMessage('Vehiculo eliminado.', Colors.green);
      await _loadVehiculos();
      return;
    }

    _showMessage(
      (result['message'] ?? 'No se pudo eliminar el vehiculo').toString(),
      Colors.red,
    );
  }

  int? _asInt(dynamic value) {
    if (value is int) return value;
    if (value is String) return int.tryParse(value);
    return null;
  }

  Future<void> _logout() async {
    if (widget.onLogout != null) {
      await widget.onLogout!.call();
      return;
    }

    await ApiService.logout();
    if (!mounted) return;
    Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
  }

  void _showMessage(String message, Color color) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message), backgroundColor: color));
  }

  @override
  Widget build(BuildContext context) {
    final loading = _loadingProfile && _loadingVehiculos;
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        centerTitle: true,
        title: const Text(
          'Configuracion',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
        ),
      ),
      body: loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : RefreshIndicator(
              onRefresh: () async {
                await _loadProfile();
                await _loadVehiculos();
              },
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildProfileCard(),
                  const SizedBox(height: 16),
                  _buildPasswordCard(),
                  const SizedBox(height: 16),
                  _buildVehiculosCard(),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red.shade600,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: _logout,
                    icon: const Icon(Icons.logout_rounded),
                    label: const Text('Cerrar sesion'),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildProfileCard() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Perfil',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _nombreController,
              decoration: const InputDecoration(
                labelText: 'Nombre',
                prefixIcon: Icon(Icons.person_rounded),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Correo',
                prefixIcon: Icon(Icons.email_rounded),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _telefonoController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Telefono',
                prefixIcon: Icon(Icons.phone_rounded),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _savingProfile ? null : _saveProfile,
              icon: _savingProfile
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.save_rounded),
              label: Text(_savingProfile ? 'Guardando...' : 'Guardar perfil'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPasswordCard() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Seguridad',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _actualPasswordController,
              obscureText: !_showActual,
              decoration: InputDecoration(
                labelText: 'Contrasena actual',
                prefixIcon: const Icon(Icons.lock_outline_rounded),
                suffixIcon: IconButton(
                  onPressed: () => setState(() => _showActual = !_showActual),
                  icon: Icon(
                    _showActual ? Icons.visibility_off : Icons.visibility,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _nuevaPasswordController,
              obscureText: !_showNueva,
              decoration: InputDecoration(
                labelText: 'Nueva contrasena',
                prefixIcon: const Icon(Icons.lock_reset_rounded),
                suffixIcon: IconButton(
                  onPressed: () => setState(() => _showNueva = !_showNueva),
                  icon: Icon(
                    _showNueva ? Icons.visibility_off : Icons.visibility,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _confirmarPasswordController,
              obscureText: !_showConfirmar,
              decoration: InputDecoration(
                labelText: 'Confirmar nueva contrasena',
                prefixIcon: const Icon(Icons.verified_user_rounded),
                suffixIcon: IconButton(
                  onPressed: () =>
                      setState(() => _showConfirmar = !_showConfirmar),
                  icon: Icon(
                    _showConfirmar ? Icons.visibility_off : Icons.visibility,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _savingPassword ? null : _changePassword,
              icon: _savingPassword
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.password_rounded),
              label: Text(
                _savingPassword ? 'Actualizando...' : 'Cambiar contrasena',
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVehiculosCard() {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Mis vehiculos',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                ),
                IconButton(
                  tooltip: 'Recargar',
                  onPressed: _loadingVehiculos ? null : _loadVehiculos,
                  icon: const Icon(Icons.refresh),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_loadingVehiculos)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              )
            else if (_vehiculos.isEmpty)
              Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  'No tienes vehiculos registrados.',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              )
            else
              ..._vehiculos.map((vehiculo) => _buildVehiculoTile(vehiculo)),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: () => _openVehiculoDialog(),
              icon: const Icon(Icons.add),
              label: const Text('Agregar vehiculo'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVehiculoTile(Map<String, dynamic> vehiculo) {
    final placa = vehicleDisplayPlate(
      vehiculo['tipo']?.toString(),
      vehiculo['placa']?.toString(),
    );
    final tipo = vehicleTypeLabel(vehiculo['tipo']?.toString()).toUpperCase();
    final color = (vehiculo['color'] ?? '').toString();

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        title: Text(
          placa.isEmpty ? 'Sin placa' : placa,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text('$tipo | Color: $color'),
        trailing: Wrap(
          spacing: 2,
          children: [
            IconButton(
              tooltip: 'Editar',
              onPressed: () => _openVehiculoDialog(vehiculo: vehiculo),
              icon: const Icon(Icons.edit_outlined),
            ),
            IconButton(
              tooltip: 'Eliminar',
              onPressed: _deletingVehiculo
                  ? null
                  : () => _eliminarVehiculo(vehiculo),
              icon: const Icon(Icons.delete_outline, color: Colors.red),
            ),
          ],
        ),
      ),
    );
  }
}
