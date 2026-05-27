import 'package:flutter/material.dart';

/// Colores base de la aplicacion Fast Parking.
class AppColors {
  const AppColors._();

  /// Azul principal para acciones y encabezados.
  static const Color primary = Color(0xFF1D4ED8);

  /// Azul secundario para gradientes y estados activos.
  static const Color secondary = Color(0xFF2563EB);

  /// Acento para detalles y enfasis.
  static const Color accent = Color(0xFF0EA5E9);

  /// Fondo neutro y colores de superficie.
  static const Color background = Color(0xFFF7F9FC);
  static const Color surface = Colors.white;
  static const Color surfaceSoft = Color(0xFFF1F5F9);
  static const Color border = Color(0xFFD8E1EE);

  /// Texto.
  static const Color text = Color(0xFF0F172A);
  static Color get textSecondary => text.withValues(alpha: 0.8);

  /// Colores de estado.
  static const Color success = Colors.green;
  static const Color warning = Colors.orange;
  static const Color error = Colors.red;
  static const Color info = Color(0xFF2563EB);

  /// Colores de disponibilidad.
  static const Color disponible = Color(0xFF16A34A);
  static Color get noDisponible => const Color(0xFF94A3B8);

  /// Derivados.
  static Color get primaryLight => primary.withValues(alpha: 0.1);
}
