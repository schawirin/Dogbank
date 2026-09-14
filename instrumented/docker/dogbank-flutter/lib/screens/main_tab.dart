import 'package:flutter/material.dart';
import '../theme.dart';
import 'dashboard_screen.dart';
import 'extract_screen.dart';
import 'investments_screen.dart';
import 'pix_screen.dart';
import 'profile_screen.dart';

class MainTab extends StatefulWidget {
  final String nome;
  final int accountId;
  final String cpf;
  final String senha;
  final String chavePix;

  const MainTab({
    super.key,
    required this.nome,
    required this.accountId,
    required this.cpf,
    required this.senha,
    required this.chavePix,
  });

  @override
  State<MainTab> createState() => _MainTabState();
}

class _MainTabState extends State<MainTab> {
  int _idx = 0;

  late final List<Widget> _screens;

  @override
  void initState() {
    super.initState();
    _screens = [
      DashboardScreen(
        nome: widget.nome,
        accountId: widget.accountId,
        cpf: widget.cpf,
        senha: widget.senha,
        onPixTap: () => setState(() => _idx = 1),
        onHistoryTap: () => setState(() => _idx = 2),
        onInvestTap: () => setState(() => _idx = 3),
      ),
      PixScreen(
        accountId: widget.accountId,
        cpf: widget.cpf,
        senha: widget.senha,
        onHomeTap: () => setState(() => _idx = 0),
      ),
      ExtractScreen(accountId: widget.accountId),
      InvestmentsScreen(
        accountId: widget.accountId,
        cpf: widget.cpf,
        nome: widget.nome,
        senha: widget.senha,
      ),
      ProfileScreen(
        nome: widget.nome,
        cpf: widget.cpf,
        chavePix: widget.chavePix,
        accountId: widget.accountId,
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_idx],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _idx,
        onDestinationSelected: (i) {
          setState(() => _idx = i);
        },
        backgroundColor: Colors.white,
        indicatorColor: DT.purple.withOpacity(0.12),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Início',
          ),
          NavigationDestination(
            icon: Icon(Icons.bolt_outlined),
            selectedIcon: Icon(Icons.bolt),
            label: 'PIX',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Extrato',
          ),
          NavigationDestination(
            icon: Icon(Icons.show_chart),
            selectedIcon: Icon(Icons.trending_up),
            label: 'Invest',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.account_circle),
            label: 'Perfil',
          ),
        ],
      ),
    );
  }
}
