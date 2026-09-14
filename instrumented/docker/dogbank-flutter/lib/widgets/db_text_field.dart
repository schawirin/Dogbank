import 'package:flutter/material.dart';
import '../theme.dart';

class DbTextField extends StatelessWidget {
  final String label;
  final String placeholder;
  final IconData icon;
  final TextEditingController controller;
  final bool obscure;
  final TextInputType keyboard;
  final TextInputAction action;

  const DbTextField({
    super.key,
    required this.label,
    required this.placeholder,
    required this.icon,
    required this.controller,
    this.obscure = false,
    this.keyboard = TextInputType.text,
    this.action = TextInputAction.next,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(
          fontSize: 14, fontWeight: FontWeight.w600, color: DT.ink,
        )),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboard,
          textInputAction: action,
          style: const TextStyle(fontSize: 16, color: DT.ink),
          decoration: InputDecoration(
            hintText: placeholder,
            hintStyle: const TextStyle(color: DT.muted, fontSize: 15),
            prefixIcon: Icon(icon, color: DT.purple, size: 20),
            filled: true,
            fillColor: DT.fieldBg,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: DT.fieldBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: DT.fieldBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: DT.purple, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}
