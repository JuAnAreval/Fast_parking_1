import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../constants/constants.dart';
import '../services/api_service.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback? onLoginSuccess;

  const LoginScreen({super.key, this.onLoginSuccess});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  bool _loading = false;
  bool _isPasswordVisible = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _showMessage(String message, {required Color color}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
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

  Future<void> _login() async {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    setState(() => _loading = true);

    try {
      final result = await ApiService.login(
        _emailController.text.trim(),
        _passwordController.text,
      );
      if (!mounted) return;

      if (result['success'] == true) {
        await ApiService.saveToken(result['data']['token'] as String);
        await ApiService.saveUserId(result['data']['usuario']['id'] as int);
        if (!mounted) return;

        TextInput.finishAutofillContext();
        _showMessage('Inicio de sesion exitoso.', color: AppColors.success);
        widget.onLoginSuccess?.call();
      } else {
        _showMessage(
          (result['message'] ?? 'Error al iniciar sesion').toString(),
          color: AppColors.error,
        );
      }
    } catch (e) {
      if (!mounted) return;
      _showMessage('Error de conexion: $e', color: AppColors.error);
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final keyboardInset = MediaQuery.of(context).viewInsets.bottom;

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
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: EdgeInsets.fromLTRB(22, 12, 22, 20 + keyboardInset),
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildHeader(),
                    const SizedBox(height: 16),
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

  Widget _buildHeader() {
    return Column(
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: AppColors.primaryLight,
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.local_parking_rounded,
            color: AppColors.primary,
            size: 30,
          ),
        ),
        const SizedBox(height: 10),
        const Text(
          AppConstants.appName,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 28,
            color: AppColors.text,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Ingresa para gestionar tus reservas y parqueaderos.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
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
                'Iniciar sesion',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.text,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Usa el correo y la contrasena de tu cuenta.',
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 18),
              TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.username, AutofillHints.email],
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Correo electronico',
                  hintText: 'ejemplo@dominio.com',
                  prefixIcon: Icon(Icons.email_rounded),
                ),
                validator: _validateEmail,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _passwordController,
                obscureText: !_isPasswordVisible,
                autofillHints: const [AutofillHints.password],
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _loading ? null : _login(),
                decoration: InputDecoration(
                  labelText: 'Contrasena',
                  hintText: 'Ingresa tu contrasena',
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
                    return 'Ingresa tu contrasena.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 18),
              ElevatedButton.icon(
                onPressed: _loading ? null : _login,
                icon: _loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.login_rounded),
                label: Text(_loading ? 'Ingresando...' : 'Ingresar'),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => Navigator.pushNamed(context, '/register'),
                child: const Text('No tienes cuenta? Registrate aqui'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
