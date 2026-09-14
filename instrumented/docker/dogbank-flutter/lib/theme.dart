import 'package:flutter/material.dart';

class DT {
  static const background   = Color(0xFFF2F7FF);
  static const card         = Colors.white;
  static const ink          = Color(0xFF141A2E);
  static const muted        = Color(0xFF6172A0);
  static const purple       = Color(0xFF7D3BF0);
  static const purpleDark   = Color(0xFF5221B8);
  static const loginBg      = Color(0xFFF5FAFF);
  static const loginLav     = Color(0xFFF0E6FF);
  static const loginRose    = Color(0xFFFFEBFA);
  static const loginSky     = Color(0xFFE8F8FF);
  static const green        = Color(0xFF1E9E61);
  static const red          = Color(0xFFD12E3D);
  static const amber        = Color(0xFFED9E30);
  static const blue         = Color(0xFF1E5CD7);
  static const fieldBg      = Color(0xFFF7F9FF);
  static const fieldBorder  = Color(0xFFDCE4F5);

  static BoxDecoration cardDecoration({double radius = 16}) => BoxDecoration(
    color: card,
    borderRadius: BorderRadius.circular(radius),
    boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 12, offset: Offset(0, 8))],
  );

  static BoxShadow get purpleShadow =>
      const BoxShadow(color: Color(0x1E7D3BF0), blurRadius: 18, offset: Offset(0, 10));
}
