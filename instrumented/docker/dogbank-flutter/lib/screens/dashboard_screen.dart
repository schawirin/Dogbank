import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../widgets/db_button.dart';
import '../widgets/dogbank_logo.dart';

class DashboardScreen extends StatefulWidget {
  final String nome;
  final int accountId;
  final String cpf;
  final String senha;
  final VoidCallback? onPixTap;
  final VoidCallback? onHistoryTap;
  final VoidCallback? onInvestTap;

  const DashboardScreen({
    super.key,
    required this.nome,
    required this.accountId,
    required this.cpf,
    required this.senha,
    this.onPixTap,
    this.onHistoryTap,
    this.onInvestTap,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _money = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
  double? _balance;
  String? _accountNumber;
  String? _bankName;
  List<Map<String, dynamic>> _transactions = [];
  bool _loading = true;
  String? _status;

  @override
  void initState() {
    super.initState();
    DatadogSdk.instance.rum?.startView('Dashboard', 'DashboardScreen');
    _load();
  }

  @override
  void dispose() {
    DatadogSdk.instance.rum?.stopView('Dashboard');
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final account = await ApiService.getAccount(widget.accountId);
      final transactions = await ApiService.getTransactions(widget.accountId);
      if (!mounted) return;

      setState(() {
        _balance = _doubleValue(account['balance']);
        _accountNumber = _stringValue(
          account['accountNumber'] ??
              account['numeroConta'] ??
              account['account_number'],
        );
        _bankName =
            _stringValue(account['bank'] ?? account['banco']) ?? 'DOG BANK';
        _transactions = transactions
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .take(4)
            .toList();
        _status = _transactions.isEmpty
            ? 'Nenhuma transacao encontrada.'
            : null;
        _loading = false;
      });

      DatadogSdk.instance.rum?.addAttribute('dogbank.balance', _balance);
      DatadogSdk.instance.rum?.addAttribute(
        'dogbank.dashboard.transactions',
        _transactions.length,
      );
    } catch (e) {
      DatadogSdk.instance.rum?.addError(
        e,
        RumErrorSource.source,
        stackTrace: StackTrace.current,
      );
      if (!mounted) return;
      setState(() {
        _loading = false;
        _status = 'Nao foi possivel atualizar os dados agora.';
      });
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
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: DT.purple))
              : ListView(
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 26),
                  children: [
                    _header(),
                    const SizedBox(height: 18),
                    _balanceCard(),
                    const SizedBox(height: 16),
                    _quickActionsCard(),
                    const SizedBox(height: 16),
                    _transactionsCard(),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _header() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const DogBankLogo(fontSize: 22),
        const SizedBox(height: 22),
        Text(
          'Ola, ${_firstName(widget.nome)}',
          style: const TextStyle(
            color: DT.ink,
            fontSize: 28,
            fontWeight: FontWeight.w900,
            height: 1.1,
          ),
        ),
        const SizedBox(height: 10),
        const Text(
          'Painel nativo conectado ao backend DogBank.',
          style: TextStyle(
            color: DT.muted,
            fontSize: 16,
            fontWeight: FontWeight.w500,
            height: 1.25,
          ),
        ),
      ],
    );
  }

  Widget _balanceCard() {
    return Container(
      decoration: DT.cardDecoration(radius: 18),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Saldo disponivel',
            style: TextStyle(
              color: DT.muted,
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            _balance != null ? _money.format(_balance) : 'R\$ --',
            style: const TextStyle(
              color: DT.ink,
              fontSize: 34,
              fontWeight: FontWeight.w900,
              height: 1,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            _accountLabel,
            style: const TextStyle(
              color: DT.muted,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: DbButton(
                  label: 'Fazer PIX',
                  icon: Icons.bolt,
                  onTap: widget.onPixTap ?? () {},
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DbButton(
                  label: 'Ver extrato',
                  icon: Icons.list_alt,
                  filled: false,
                  onTap: widget.onHistoryTap ?? () {},
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _quickActionsCard() {
    return Container(
      decoration: DT.cardDecoration(radius: 18),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Acoes rapidas',
            style: TextStyle(
              color: DT.ink,
              fontSize: 17,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _quickAction(
                  icon: Icons.bolt,
                  label: 'PIX',
                  color: DT.purple,
                  onTap: widget.onPixTap ?? () {},
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _quickAction(
                  icon: Icons.description,
                  label: 'Extrato',
                  color: DT.blue,
                  onTap: widget.onHistoryTap ?? () {},
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _quickAction(
                  icon: Icons.show_chart,
                  label: 'Invest',
                  color: DT.green,
                  onTap: widget.onInvestTap ?? () {},
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _quickAction({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: color.withOpacity(0.06),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: SizedBox(
          height: 82,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 27),
              const SizedBox(height: 7),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _transactionsCard() {
    return Container(
      decoration: DT.cardDecoration(radius: 18),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Ultimas transacoes',
            style: TextStyle(
              color: DT.ink,
              fontSize: 17,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 14),
          if (_transactions.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Text(
                _status ?? 'Nenhuma transacao encontrada.',
                style: const TextStyle(color: DT.muted, fontSize: 14),
              ),
            )
          else
            ...List.generate(_transactions.length, (index) {
              return Padding(
                padding: EdgeInsets.only(top: index == 0 ? 0 : 10),
                child: _transactionRow(_transactions[index]),
              );
            }),
        ],
      ),
    );
  }

  Widget _transactionRow(Map<String, dynamic> tx) {
    final originId = _intValue(tx['accountOriginId'] ?? tx['contaOrigemId']);
    final outgoing = originId == widget.accountId || originId == null;
    final amount = _doubleValue(tx['amount'] ?? tx['valorTransacionado']);
    final tint = outgoing ? DT.red : DT.green;
    final title = _transactionTitle(tx, outgoing);
    final subtitle = _transactionSubtitle(tx, outgoing, title);

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFF),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: tint.withOpacity(0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(
              outgoing ? Icons.arrow_upward : Icons.arrow_downward,
              color: tint,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: DT.ink,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: DT.muted, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '${outgoing ? '-' : '+'} ${_money.format(amount)}',
            textAlign: TextAlign.right,
            style: TextStyle(
              color: tint,
              fontSize: 14,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  String get _accountLabel {
    final account =
        _accountNumber ?? widget.accountId.toString().padLeft(6, '0');
    return 'Conta $account | ${_bankName ?? 'DOG BANK'}';
  }

  String _firstName(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return 'Cliente';
    return trimmed.split(RegExp(r'\s+')).first;
  }

  String _transactionTitle(Map<String, dynamic> tx, bool outgoing) {
    final value = outgoing
        ? tx['receiverName'] ??
              tx['destinatarioNome'] ??
              tx['destinatario_nome'] ??
              tx['destinatario']
        : tx['senderName'] ??
              tx['remetenteNome'] ??
              tx['remetente_nome'] ??
              tx['remetente'];
    return _stringValue(value) ?? (outgoing ? 'PIX enviado' : 'PIX recebido');
  }

  String _transactionSubtitle(
    Map<String, dynamic> tx,
    bool outgoing,
    String title,
  ) {
    final explicit = _stringValue(tx['description'] ?? tx['descricao']);
    if (explicit != null) return explicit;
    return outgoing ? 'PIX para $title' : 'PIX de $title';
  }

  String? _stringValue(Object? value) {
    if (value == null) return null;
    final text = value.toString().trim();
    return text.isEmpty ? null : text;
  }

  int? _intValue(Object? value) {
    if (value == null) return null;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString());
  }

  double _doubleValue(Object? value) {
    if (value == null) return 0;
    if (value is num) return value.toDouble();
    final sanitized = value.toString().replaceAll(RegExp(r'[^0-9,.-]'), '');
    if (sanitized.contains(',')) {
      return double.tryParse(
            sanitized.replaceAll('.', '').replaceAll(',', '.'),
          ) ??
          0;
    }
    return double.tryParse(sanitized) ?? 0;
  }
}
