import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:usuarios/main.dart';

void main() {
  testWidgets('Login screen shows inputs and navigates to register', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const ParqueaderosApp());

    expect(find.text('Iniciar Sesion'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(2));
    expect(find.widgetWithText(ElevatedButton, 'Ingresar'), findsOneWidget);
    expect(
      find.widgetWithText(TextButton, 'No tienes cuenta? Registrate aqui'),
      findsOneWidget,
    );

    await tester.tap(
      find.widgetWithText(TextButton, 'No tienes cuenta? Registrate aqui'),
    );
    await tester.pumpAndSettle();

    expect(find.text('Registro de Usuario'), findsOneWidget);
    expect(find.widgetWithText(ElevatedButton, 'Registrarse'), findsOneWidget);
  });
}
