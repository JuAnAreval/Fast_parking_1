import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:usuarios/main.dart';

void main() {
  testWidgets('Login screen shows inputs and navigates to register', (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const ParqueaderosApp());
    await tester.pumpAndSettle();

    expect(find.text('Iniciar sesion'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(2));
    expect(find.text('Ingresar'), findsOneWidget);
    expect(
      find.widgetWithText(TextButton, 'No tienes cuenta? Registrate aqui'),
      findsOneWidget,
    );

    await tester.tap(
      find.widgetWithText(TextButton, 'No tienes cuenta? Registrate aqui'),
    );
    await tester.pumpAndSettle();

    expect(find.text('Crear cuenta'), findsOneWidget);
    expect(find.text('Registrarse'), findsOneWidget);
  });
}
