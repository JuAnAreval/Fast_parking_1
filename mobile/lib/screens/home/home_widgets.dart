import 'package:flutter/material.dart';

import '../../constants/constants.dart';
import '../../utils/vehicle_rules.dart';

class HomeAppBar extends StatelessWidget implements PreferredSizeWidget {
  final VoidCallback onOpenReservations;
  final VoidCallback onOpenSettings;
  final VoidCallback onLogout;

  const HomeAppBar({
    super.key,
    required this.onOpenReservations,
    required this.onOpenSettings,
    required this.onLogout,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(16)),
      ),
      flexibleSpace: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.primary, AppColors.secondary],
          ),
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(16)),
        ),
      ),
      centerTitle: true,
      title: const Text(
        AppConstants.appName,
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
        ),
      ),
      actions: [
        _HomeActionButton(
          onTap: onOpenReservations,
          icon: Icons.list_alt_rounded,
          tooltip: 'Mis Reservas',
        ),
        _HomeActionButton(
          onTap: onOpenSettings,
          icon: Icons.settings_rounded,
          tooltip: 'Configuracion',
        ),
        _HomeActionButton(
          onTap: onLogout,
          icon: Icons.logout_rounded,
          tooltip: 'Cerrar sesion',
        ),
        const SizedBox(width: 6),
      ],
    );
  }
}

class _HomeActionButton extends StatelessWidget {
  final VoidCallback onTap;
  final IconData icon;
  final String tooltip;

  const _HomeActionButton({
    required this.onTap,
    required this.icon,
    required this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: Material(
        color: Colors.white.withValues(alpha: 0.17),
        borderRadius: BorderRadius.circular(12),
        child: IconButton(
          onPressed: onTap,
          icon: Icon(icon, color: Colors.white),
          tooltip: tooltip,
        ),
      ),
    );
  }
}

class HomeLoadingIndicator extends StatelessWidget {
  const HomeLoadingIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: AppColors.primary),
            SizedBox(height: 10),
            Text(
              'Buscando parqueaderos...',
              style: TextStyle(fontSize: 16, color: AppColors.text),
            ),
          ],
        ),
      ),
    );
  }
}

class HomeEmptyState extends StatelessWidget {
  final String message;

  const HomeEmptyState({
    super.key,
    this.message = 'No hay parqueaderos disponibles.',
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 24),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.local_parking_rounded,
              size: 42,
              color: AppColors.secondary,
            ),
            SizedBox(height: 10),
            Text(
              message,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.text,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class HomeVehicleFilterBar extends StatelessWidget {
  final String? selectedType;
  final ValueChanged<String?> onSelected;

  const HomeVehicleFilterBar({
    super.key,
    required this.selectedType,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final options = <String?>[null, ...kVehicleTypes];

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 14),
            child: Text(
              'Filtrar por vehiculo',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.text,
              ),
            ),
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Row(
              children: options.map((tipo) {
                final isSelected = selectedType == tipo;
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: FilterChip(
                    selected: isSelected,
                    label: Text(
                      tipo == null ? 'Todos' : vehicleTypeLabel(tipo),
                    ),
                    avatar: Icon(
                      tipo == null ? Icons.tune_rounded : vehicleTypeIcon(tipo),
                      size: 18,
                      color: isSelected ? Colors.white : AppColors.primary,
                    ),
                    selectedColor: AppColors.primary,
                    checkmarkColor: Colors.white,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : AppColors.text,
                      fontWeight: FontWeight.w600,
                    ),
                    side: BorderSide(
                      color: isSelected ? AppColors.primary : AppColors.border,
                    ),
                    backgroundColor: AppColors.surfaceSoft,
                    onSelected: (_) => onSelected(tipo),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class HomeFilterLoadingState extends StatelessWidget {
  const HomeFilterLoadingState({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 28),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.96),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 14,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: AppColors.primary),
            SizedBox(height: 12),
            Text(
              'Encontrando parqueaderos...',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.text,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
