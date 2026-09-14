import 'package:flutter/material.dart';
import '../theme.dart';

class CardsScreen extends StatelessWidget {
  const CardsScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: DT.background,
    body: SafeArea(child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Cartões', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: DT.ink)),
        const SizedBox(height: 4),
        const Text('Seus cartões DogBank', style: TextStyle(color: DT.muted, fontSize: 14)),
        const SizedBox(height: 24),
        // Visual card
        Container(
          height: 180,
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [DT.purple, DT.purpleDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [BoxShadow(color: DT.purple.withOpacity(0.30), blurRadius: 18, offset: const Offset(0, 8))],
          ),
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: const [
                Text('DogBank', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18)),
                Icon(Icons.pets, color: Colors.white70, size: 22),
              ]),
              const Text('•••• •••• •••• 4242', style: TextStyle(color: Colors.white70, fontSize: 18, letterSpacing: 2)),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: const [
                Text('PEDRO SCHAWIRIN', style: TextStyle(color: Colors.white70, fontSize: 12, letterSpacing: 1)),
                Text('12/28', style: TextStyle(color: Colors.white70, fontSize: 12)),
              ]),
            ],
          ),
        ),
      ]),
    )),
  );
}
