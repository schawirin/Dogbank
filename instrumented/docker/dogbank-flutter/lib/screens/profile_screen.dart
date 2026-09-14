import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../widgets/db_button.dart';

class ProfileScreen extends StatefulWidget {
  final String nome;
  final String cpf;
  final String chavePix;
  final int accountId;

  const ProfileScreen({
    super.key,
    required this.nome,
    required this.cpf,
    required this.chavePix,
    required this.accountId,
  });

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _money = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
  Map<String, dynamic>? _account;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    DatadogSdk.instance.rum?.startView('Perfil', 'ProfileScreen');
    _load();
  }

  @override
  void dispose() {
    DatadogSdk.instance.rum?.stopView('Perfil');
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final account = await ApiService.getAccount(widget.accountId);
      if (!mounted) return;
      setState(() {
        _account = account;
        _loading = false;
      });
    } catch (e) {
      DatadogSdk.instance.rum?.addError(
        e,
        RumErrorSource.source,
        stackTrace: StackTrace.current,
      );
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _logout() async {
    DatadogSdk.instance.rum?.stopSession();
    DatadogSdk.instance.clearUserInfo();
    DatadogSdk.instance.clearAccountInfo();
    await Future<void>.delayed(const Duration(milliseconds: 450));
    try {
      await const MethodChannel(
        'dogbank.app/session',
      ).invokeMethod<void>('closeApp');
    } catch (_) {
      await SystemNavigator.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: DT.background,
      body: SafeArea(
        child: RefreshIndicator(
          color: DT.purple,
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const Text(
                'Meu Perfil',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: DT.ink,
                ),
              ),
              const SizedBox(height: 18),
              _identityCard(),
              const SizedBox(height: 16),
              if (_loading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(30),
                    child: CircularProgressIndicator(color: DT.purple),
                  ),
                )
              else
                _accountCard(),
              const SizedBox(height: 16),
              DbButton(
                label: 'Sair',
                icon: Icons.logout,
                filled: false,
                onTap: _logout,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _identityCard() {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [DT.purple, DT.purpleDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [DT.purpleShadow],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 36,
            backgroundColor: Colors.white,
            child: Text(
              widget.nome.isNotEmpty ? widget.nome[0].toUpperCase() : 'U',
              style: const TextStyle(
                color: DT.purple,
                fontSize: 34,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.nome,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'CPF ${_maskCpf(widget.cpf)}',
                  style: const TextStyle(color: Colors.white70, fontSize: 14),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _accountCard() {
    final balance = (_account?['balance'] as num?)?.toDouble() ?? 0;
    final accountNumber =
        _account?['accountNumber']?.toString() ??
        widget.accountId.toString().padLeft(4, '0');
    final bank = _account?['banco']?.toString() ?? 'DOG BANK';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: DT.cardDecoration(radius: 18),
      child: Column(
        children: [
          _profileRow(Icons.key, 'Chave PIX', widget.chavePix, DT.purple),
          _profileRow(Icons.credit_card, 'Conta', accountNumber, DT.blue),
          _profileRow(Icons.account_balance, 'Banco', bank, DT.green),
          _profileRow(
            Icons.payments_outlined,
            'Saldo',
            _money.format(balance),
            DT.amber,
          ),
        ],
      ),
    );
  }

  Widget _profileRow(IconData icon, String title, String value, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: DT.fieldBg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(icon, color: color),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(color: DT.muted, fontSize: 12),
                ),
                const SizedBox(height: 3),
                Text(
                  value,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: DT.ink,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _maskCpf(String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 11) return value;
    return '${digits.substring(0, 3)}.***.***-${digits.substring(9)}';
  }
}
