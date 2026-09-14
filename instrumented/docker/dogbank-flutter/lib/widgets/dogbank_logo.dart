import 'package:flutter/material.dart';
import '../theme.dart';

class DogBankLogo extends StatelessWidget {
  final double fontSize;
  const DogBankLogo({super.key, this.fontSize = 28});

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      Text('DogBank', style: TextStyle(
        fontSize: fontSize,
        fontWeight: FontWeight.w800,
        color: DT.purple,
        letterSpacing: -0.5,
      )),
      const SizedBox(width: 4),
      Icon(Icons.pets, color: DT.purple, size: fontSize * 0.72),
    ],
  );
}
