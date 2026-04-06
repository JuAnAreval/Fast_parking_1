# Fast Parking Mobile

Aplicacion Flutter para usuarios finales de Fast Parking.

## Estado actual

- API configurada en produccion mediante [api_url.dart](/C:/Users/juand/Documents/parqueaderos/mobile/lib/constants/api_url.dart)
- Sesion persistente con `SharedPreferences`
- Login, registro, reservas, mapa, perfil y gestion de vehiculos

## Checklist antes de compartir por QR

1. Confirma que `ApiEnvironment.production` siga activo.
2. Ejecuta `flutter analyze`.
3. Ejecuta `flutter test`.
4. Genera el APK o AAB final.
5. Instala el build en al menos un Android fisico y valida:
   - login
   - registro
   - carga del mapa
   - crear reserva
   - ver reservas
   - cerrar sesion y restaurar sesion

## Comandos utiles

```bash
flutter pub get
flutter analyze
flutter test
flutter build apk --release
```

## Nota de release

En Android el proyecto sigue firmando `release` con la configuracion `debug` por defecto en [build.gradle.kts](/C:/Users/juand/Documents/parqueaderos/mobile/android/app/build.gradle.kts). Eso sirve para pruebas y distribucion interna, pero para una publicacion formal conviene configurar tu keystore propia.
