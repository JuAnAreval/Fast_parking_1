/// Constantes de tiempo de la aplicación
class AppDuration {
  const AppDuration._();

  /// Duración de la animación de la tarjeta
  static const Duration cardAnimation = Duration(milliseconds: 300);

  /// Tiempo de espera para requests API
  static const Duration apiTimeout = Duration(seconds: 2);
  static const Duration apiTimeoutShort = Duration(seconds: 1);

  /// Duración de la reserva (15 minutos = 900 segundos)
  static const int reservaSegundos = 900;

  /// Duración de la reserva extendida (20 minutos)
  static const int reservaExtendidaSegundos = 1200;

  /// Alerta de 5 minutos (en segundos)
  static const int alerta5MinSegundos = 300;

  /// Intervalo de actualización del contador
  static const Duration countdownInterval = Duration(seconds: 1);

  /// Intervalo para sincronizar estado de reserva con backend
  static const Duration reservaSyncInterval = Duration(seconds: 5);
}
