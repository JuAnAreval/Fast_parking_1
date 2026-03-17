import 'dart:async';

import 'package:flutter/material.dart';

import '../constants/constants.dart';
import '../widgets/widgets.dart';
import 'home/home_controller.dart';
import 'home/home_widgets.dart';

class HomeScreen extends StatefulWidget {
  final Future<void> Function()? onLogout;

  const HomeScreen({super.key, this.onLogout});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  late final HomeController _controller;
  late final AnimationController _cardAnimationController;
  late final Animation<Offset> _cardOffsetAnimation;

  @override
  void initState() {
    super.initState();

    _cardAnimationController = AnimationController(
      vsync: this,
      duration: AppDuration.cardAnimation,
    );
    _cardOffsetAnimation =
        Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero).animate(
          CurvedAnimation(
            parent: _cardAnimationController,
            curve: Curves.easeOutCubic,
          ),
        );

    _controller = HomeController()
      ..onReservationActivated = _showReservationActivatedSnackBar
      ..addListener(_onControllerChanged);

    unawaited(_controller.initialize());
  }

  @override
  void dispose() {
    _controller
      ..removeListener(_onControllerChanged)
      ..dispose();
    _cardAnimationController.dispose();
    super.dispose();
  }

  void _onControllerChanged() {
    if (!mounted) return;
    setState(() {});
  }

  Future<void> _handleLogout() async {
    await widget.onLogout?.call();
  }

  Future<void> _selectParqueadero(Map<String, dynamic> parqueadero) async {
    final selected = await _controller.selectParqueadero(parqueadero);
    if (!mounted) return;

    if (!selected) {
      _showReservaActivaSnackBar();
      return;
    }
    _cardAnimationController.forward(from: 0);
  }

  void _unselectParqueadero() {
    if (_controller.selectedParqueadero == null) return;

    _cardAnimationController.reverse().then((_) {
      if (!mounted) return;
      _controller.unselectParqueadero();
    });
  }

  Future<void> _refreshParqueaderos() async {
    _unselectParqueadero();
    await _controller.loadParqueaderos();
  }

  Future<void> _cancelarReservaActivaManual() async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmar cancelacion'),
        content: const Text('Deseas cancelar tu reserva activa?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('No'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Si, cancelar'),
          ),
        ],
      ),
    );

    if (confirmar != true) return;

    await _controller.cancelarReservaActiva(notifyApi: true);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Reserva cancelada manualmente'),
        backgroundColor: Colors.orange,
      ),
    );
  }

  void _volverInicioDesdeRecibo() {
    _controller.dismissReservaCompletada();
  }

  void _showReservationActivatedSnackBar() {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Ingreso autorizado: tu vehiculo ya fue marcado como dentro del parqueadero.',
        ),
        backgroundColor: Colors.green,
      ),
    );
  }

  void _showReservaActivaSnackBar() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Ya tienes una reserva activa. Cancelala antes de reservar otra.',
        ),
        backgroundColor: Colors.orange,
      ),
    );
  }

  void _showReservationDialog() {
    final selected = _controller.selectedParqueadero;
    if (selected == null) return;

    showDialog(
      context: context,
      builder: (context) => ReservationDialog(
        parqueadero: selected,
        tarifas: _controller.tarifas,
        onReservar: _crearReserva,
      ),
    );
  }

  Future<bool> _crearReserva(Map<String, dynamic> reservaData) async {
    final result = await _controller.crearReserva(reservaData);
    if (!mounted) return false;

    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Reserva creada exitosamente'),
          backgroundColor: Colors.green,
        ),
      );
      if (Navigator.of(context, rootNavigator: true).canPop()) {
        Navigator.of(context, rootNavigator: true).pop();
      }
      return true;
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            (result['message'] ?? 'Error al crear reserva').toString(),
          ),
          backgroundColor: Colors.red,
        ),
      );
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_controller.reservaActiva != null) {
      return ActiveReservationView(
        reserva: _controller.reservaActiva!,
        onCancelar: _cancelarReservaActivaManual,
        onLogout: () {
          unawaited(_handleLogout());
        },
      );
    }

    if (_controller.reservaCompletada != null) {
      return ReservationReceiptView(
        reserva: _controller.reservaCompletada!,
        onBackHome: _volverInicioDesdeRecibo,
        onLogout: () {
          unawaited(_handleLogout());
        },
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: HomeAppBar(
        onOpenReservations: () {
          Navigator.pushNamed(context, '/reservations');
        },
        onOpenSettings: () {
          Navigator.pushNamed(context, '/settings');
        },
        onLogout: () {
          unawaited(_handleLogout());
        },
      ),
      body: Stack(
        children: [
          _buildMapContent(),
          if (_controller.selectedParqueadero != null) _buildDetailCard(),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        shape: const CircleBorder(),
        onPressed: _refreshParqueaderos,
        child: const Icon(Icons.refresh_rounded, color: Colors.white),
      ),
    );
  }

  Widget _buildMapContent() {
    if (_controller.loading) {
      return const HomeLoadingIndicator();
    }

    return Stack(
      children: [
        RepaintBoundary(
          child: ParkingMapView(
            parqueaderos: _controller.parqueaderos,
            selectedParqueadero: _controller.selectedParqueadero,
            onSelectParqueadero: _selectParqueadero,
            onTapEmpty: _unselectParqueadero,
          ),
        ),
        if (_controller.parqueaderos.isEmpty)
          const IgnorePointer(child: HomeEmptyState()),
      ],
    );
  }

  Widget _buildDetailCard() {
    return SlideTransition(
      position: _cardOffsetAnimation,
      child: Align(
        alignment: Alignment.bottomCenter,
        child: SafeArea(
          top: false,
          minimum: const EdgeInsets.fromLTRB(20, 0, 20, 12),
          child: ParkingDetailCard(
            parqueadero: _controller.selectedParqueadero!,
            tarifas: _controller.tarifas,
            loadingTarifas: _controller.loadingTarifas,
            onClose: _unselectParqueadero,
            onReservar: _showReservationDialog,
          ),
        ),
      ),
    );
  }
}
