import 'package:flutter/material.dart';
import '../theme.dart';

class DbButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onTap;
  final bool loading;
  final bool filled;

  const DbButton({
    super.key,
    required this.label,
    this.icon,
    this.onTap,
    this.loading = false,
    this.filled = true,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: ElevatedButton.icon(
        onPressed: loading ? null : onTap,
        icon: loading
            ? const SizedBox(width: 20, height: 20,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
            : (icon != null ? Icon(icon, size: 20) : const SizedBox.shrink()),
        label: Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        style: ElevatedButton.styleFrom(
          backgroundColor: filled ? DT.purple : DT.purple.withOpacity(0.10),
          foregroundColor: filled ? Colors.white : DT.purple,
          elevation: filled ? 0 : 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
    );
  }
}
