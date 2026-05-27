import 'package:flutter/foundation.dart';

enum ApiEnvironment { local, production }

class ApiUrl {
  const ApiUrl._();

  static const ApiEnvironment environment = ApiEnvironment.production;
  static const String webPanelUrl = 'https://panel-web-production.up.railway.app';

  static const _ApiTarget _local = _ApiTarget(
    scheme: 'http',
    host: 'localhost',
    port: 3000,
    altHost: '127.0.0.1',
  );

  static const _ApiTarget _production = _ApiTarget(
    scheme: 'https',
    host: 'backend-production-70858.up.railway.app',
  );

  static String get scheme => _activeTarget.scheme;
  static String get host => _activeTarget.host;
  static String get altHost => _activeTarget.altHost;
  static int? get port => _activeTarget.port;

  static List<String> buildBaseUrls(String endpointGroup) {
    return buildHostCandidates()
        .map((host) => '$scheme://$host$_portSuffix/api/$endpointGroup')
        .toList(growable: false);
  }

  static String get _portSuffix => port == null ? '' : ':$port';

  static List<String> buildHostCandidates() {
    final ordered = <String>[];
    final prefersRemote = _prefersRemoteHost;

    if (kIsWeb) {
      if (environment == ApiEnvironment.production) {
        ordered.addAll([host, altHost]);
      } else {
        ordered.addAll(
          prefersRemote
              ? [host, altHost, 'localhost']
              : ['localhost', host, altHost],
        );
      }
    } else if (defaultTargetPlatform == TargetPlatform.android) {
      ordered.addAll([
        if (prefersRemote) ...[host, altHost],
        '10.0.2.2',
        '10.0.3.2',
        if (!prefersRemote) ...[host, altHost],
        '192.168.56.1',
        '127.0.0.1',
        'localhost',
      ]);
    } else {
      ordered.addAll(
        prefersRemote
            ? [host, altHost, 'localhost']
            : ['localhost', host, altHost],
      );
    }

    final seen = <String>{};
    return ordered
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty && seen.add(value))
        .toList(growable: false);
  }

  static _ApiTarget get _activeTarget {
    switch (environment) {
      case ApiEnvironment.local:
        return _local;
      case ApiEnvironment.production:
        return _production;
    }
  }

  static bool get _prefersRemoteHost {
    final normalizedHost = host.trim().toLowerCase();
    return normalizedHost.isNotEmpty &&
        normalizedHost != '127.0.0.1' &&
        normalizedHost != 'localhost' &&
        normalizedHost != '10.0.2.2' &&
        normalizedHost != '10.0.3.2' &&
        normalizedHost != '192.168.56.1';
  }
}

class _ApiTarget {
  final String scheme;
  final String host;
  final String altHost;
  final int? port;

  const _ApiTarget({
    required this.scheme,
    required this.host,
    this.port,
    this.altHost = '',
  });
}
