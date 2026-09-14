import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../theme.dart';

class ExtractScreen extends StatefulWidget {
  final int accountId;

  const ExtractScreen({super.key, required this.accountId});

  @override
  State<ExtractScreen> createState() => _ExtractScreenState();
}

class _ExtractScreenState extends State<ExtractScreen> {
  final _money = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
  final _date = DateFormat('dd/MM/yyyy HH:mm', 'pt_BR');
  List<dynamic> _transactions = [];
  bool _loading = true;
  String? _status;

  @override
  void initState() {
    super.initState();
    DatadogSdk.instance.rum?.startView('Extrato', 'ExtractScreen');
    _load();
  }

  @override
  void dispose() {
    DatadogSdk.instance.rum?.stopView('Extrato');
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _status = 'Atualizando extrato...';
    });

    try {
      final transactions = await ApiService.getTransactions(widget.accountId);
      if (!mounted) return;
      setState(() {
        _transactions = transactions.take(20).toList();
        _loading = false;
        _status = _transactions.isEmpty
            ? 'Nenhuma transação encontrada.'
            : null;
      });
      DatadogSdk.instance.rum?.addAttribute(
        'extract.transactions',
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
        _transactions = [];
        _loading = false;
        _status = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: DT.background,
    body: SafeArea(
      child: RefreshIndicator(
        color: DT.purple,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const Text(
              'Extrato',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: DT.ink,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Histórico carregado direto de /api/transactions.',
              style: TextStyle(color: DT.muted, fontSize: 14),
            ),
            const SizedBox(height: 18),
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 80),
                child: Center(
                  child: CircularProgressIndicator(color: DT.purple),
                ),
              )
            else if (_transactions.isEmpty)
              _emptyState()
            else
              Container(
                decoration: DT.cardDecoration(radius: 18),
                child: Column(
                  children: List.generate(_transactions.length, (index) {
                    final tx = _transactions[index] as Map<String, dynamic>;
                    return Column(
                      children: [
                        _transactionRow(tx),
                        if (index < _transactions.length - 1)
                          const Divider(height: 1, indent: 68),
                      ],
                    );
                  }),
                ),
              ),
            if (_status != null) ...[
              const SizedBox(height: 12),
              Text(
                _status!,
                style: const TextStyle(
                  color: DT.muted,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ],
        ),
      ),
    ),
  );

  Widget _transactionRow(Map<String, dynamic> tx) {
    final originId = _intValue(tx['accountOriginId'] ?? tx['contaOrigemId']);
    final amount = _doubleValue(tx['amount'] ?? tx['valorTransacionado']);
    final outgoing = originId == widget.accountId;
    final tint = outgoing ? DT.red : DT.green;
    final name = outgoing
        ? _stringValue(tx['receiverName'] ?? tx['destinatarioNome'])
        : _stringValue(tx['senderName'] ?? tx['remetenteNome']);
    final description =
        _stringValue(tx['description'] ?? tx['descricao']) ?? 'PIX DogBank';
    final status = _stringValue(tx['status']) ?? 'PROCESSADO';
    final dateText = _dateText(
      _stringValue(tx['completedAt'] ?? tx['createdAt'] ?? tx['timestamp']),
    );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: tint.withOpacity(0.10),
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
                  name ?? (outgoing ? 'PIX enviado' : 'PIX recebido'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: DT.ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$description • $status • $dateText',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: DT.muted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            '${outgoing ? '-' : '+'} ${_money.format(amount)}',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: tint,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  Widget _emptyState() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: DT.cardDecoration(radius: 18),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: DT.blue.withOpacity(0.10),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.receipt_long, color: DT.blue, size: 32),
          ),
          const SizedBox(height: 16),
          const Text(
            'Nenhuma transação',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: DT.ink,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'As movimentações PIX aparecerão aqui.',
            style: TextStyle(color: DT.muted, fontSize: 14),
          ),
        ],
      ),
    );
  }

  String _dateText(String? raw) {
    if (raw == null || raw.isEmpty) return '--';
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return '--';
    return _date.format(parsed.toLocal());
  }

  String? _stringValue(Object? value) {
    if (value == null) return null;
    final text = value.toString();
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
    return double.tryParse(value.toString()) ?? 0;
  }
}
