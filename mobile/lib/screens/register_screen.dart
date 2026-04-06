import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../constants/constants.dart';
import '../services/api_service.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  bool _loading = false;
  bool _isPasswordVisible = false;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _showMessage(String message, Color color, IconData icon) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(icon, color: Colors.white),
            const SizedBox(width: 10),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: color,
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) {
      return 'Ingresa tu correo.';
    }

    final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    if (!emailRegex.hasMatch(email)) {
      return 'Ingresa un correo valido.';
    }

    return null;
  }

  String? _validatePhone(String? value) {
    final phone = value?.trim() ?? '';
    if (phone.isEmpty) {
      return 'Ingresa tu telefono.';
    }

    final phoneRegex = RegExp(r'^\+?[0-9()\-\s]{7,20}$');
    if (!phoneRegex.hasMatch(phone)) {
      return 'Ingresa un telefono valido.';
    }

    return null;
  }

  Future<void> _register() async {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    setState(() => _loading = true);

    try {
      final result = await ApiService.register(
        _nameController.text.trim(),
        _emailController.text.trim(),
        _phoneController.text.trim(),
        _passwordController.text,
      );
      if (!mounted) return;

      if (result['success'] == true) {
        TextInput.finishAutofillContext();
        _showMessage(
          'Cuenta creada con exito.',
          AppColors.success,
          Icons.check_circle_outline,
        );
        Navigator.pushReplacementNamed(context, '/login');
      } else {
        _showMessage(
          (result['message'] ?? 'Error al registrar').toString(),
          AppColors.error,
          Icons.error_outline,
        );
      }
    } catch (e) {
      if (!mounted) return;
      _showMessage(
        'Error de conexion: $e',
        AppColors.error,
        Icons.error_outline,
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFEFF4FF), AppColors.background],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 20),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildHeader(context),
                    const SizedBox(height: 18),
                    _buildFormCard(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Stack(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                AppColors.primary.withValues(alpha: 0.94),
                AppColors.secondary.withValues(alpha: 0.9),
              ],
            ),
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.24),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.22),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.person_add_alt_1_rounded,
                  color: Colors.white,
                  size: 32,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Crear cuenta',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 27,
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.3,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Registra tus datos para empezar con ${AppConstants.appName}.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.white.withValues(alpha: 0.92),
                ),
              ),
            ],
          ),
        ),
        Positioned(
          top: 10,
          left: 10,
          child: Material(
            color: Colors.white.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(12),
            child: IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
              tooltip: 'Volver',
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildFormCard() {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: AutofillGroup(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Datos de registro',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.text,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Completa la informacion para crear tu cuenta.',
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 18),
              TextFormField(
                controller: _nameController,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.name],
                decoration: const InputDecoration(
                  labelText: 'Nombre completo',
                  prefixIcon: Icon(Icons.person_rounded),
                ),
                validator: (value) {
                  if ((value ?? '').trim().isEmpty) {
                    return 'Ingresa tu nombre.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(
                  labelText: 'Correo electronico',
                  prefixIcon: Icon(Icons.email_rounded),
                ),
                validator: _validateEmail,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.telephoneNumber],
                decoration: const InputDecoration(
                  labelText: 'Numero de telefono',
                  prefixIcon: Icon(Icons.phone_rounded),
                ),
                validator: _validatePhone,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _passwordController,
                obscureText: !_isPasswordVisible,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.newPassword],
                onFieldSubmitted: (_) => _loading ? null : _register(),
                decoration: InputDecoration(
                  labelText: 'Contrasena',
                  prefixIcon: const Icon(Icons.lock_rounded),
                  suffixIcon: IconButton(
                    onPressed: () {
                      setState(() => _isPasswordVisible = !_isPasswordVisible);
                    },
                    icon: Icon(
                      _isPasswordVisible ? Icons.visibility : Icons.visibility_off,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                validator: (value) {
                  if ((value ?? '').isEmpty) {
                    return 'Ingresa una contrasena.';
                  }
                  if ((value ?? '').length < 6) {
                    return 'Debe tener al menos 6 caracteres.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _loading ? null : _register,
                icon: _loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.person_add_rounded),
                label: Text(_loading ? 'Creando cuenta...' : 'Registrarse'),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Ya tienes cuenta? Volver a iniciar sesion'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
