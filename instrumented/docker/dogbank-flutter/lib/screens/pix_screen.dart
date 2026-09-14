import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../theme.dart';
import '../services/api_service.dart';
import '../widgets/db_button.dart';
import '../widgets/db_text_field.dart';

class _SavedKey {
  final String name, key, bank;
  final double amount;
  const _SavedKey(this.name, this.key, this.bank, this.amount);
}

class PixScreen extends StatefulWidget {
  final int accountId;
  final String cpf;
  final String senha;
  final VoidCallback? onHomeTap;
  const PixScreen({
    super.key,
    required this.accountId,
    required this.cpf,
    required this.senha,
    this.onHomeTap,
  });
  @override
  State<PixScreen> createState() => _PixScreenState();
}

class _PixScreenState extends State<PixScreen> {
  final _keyCtrl = TextEditingController();
  final _amtCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  bool _loading = false;
  bool _awaitingPassword = false;
  bool _success = false;
  String? _error;
  String? _receiverLabel;
  Map<String, dynamic>? _receipt;
  double? _balance;
  final _fmt = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');

  static const _savedKeys = [
    _SavedKey('Pedro Silva', 'pedro.silva@dogbank.com', 'DogBank', 35.66),
    _SavedKey('João Santos', 'joao.santos@dogbank.com', 'DogBank', 18.90),
    _SavedKey('Emiliano Costa', 'emiliano.costa@dogbank.com', 'DogBank', 50.26),
    _SavedKey(
      'Eliane Oliveira',
      'eliane.oliveira@dogbank.com',
      'DogBank',
      46.46,
    ),
    _SavedKey('Patricia Souza', 'patricia.souza@dogbank.com', 'DogBank', 27.40),
  ];

  @override
  void initState() {
    super.initState();
    DatadogSdk.instance.rum?.startView('PIX', 'PixScreen');
    _loadBalance();
  }

  @override
  void dispose() {
    DatadogSdk.instance.rum?.stopView('PIX');
    _keyCtrl.dispose();
    _amtCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadBalance() async {
    try {
      final acc = await ApiService.getAccount(widget.accountId);
      if (mounted)
        setState(() => _balance = (acc['balance'] as num?)?.toDouble());
    } catch (_) {}
  }

  void _selectSaved(_SavedKey k) {
    _keyCtrl.text = k.key;
    _amtCtrl.text = k.amount.toStringAsFixed(2).replaceAll('.', ',');
    _descCtrl.text = 'PIX para ${k.name}';
    setState(() {
      _receiverLabel = '${k.name} • ${k.bank}';
      _error = null;
    });
  }

  void _selectAmount(int v) {
    _amtCtrl.text = '$v,00';
    setState(() => _error = null);
  }

  Future<String?> _requestPixPassword(double amount) {
    final demoPassword = widget.senha.isNotEmpty ? widget.senha : '123456';
    final controller = TextEditingController(text: demoPassword)
      ..selection = TextSelection.collapsed(offset: demoPassword.length);
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: DT.purple.withOpacity(0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.lock_outline, color: DT.purple),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Confirmar PIX',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: DT.ink,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                '${_fmt.format(amount)} para ${_receiverLabel ?? _keyCtrl.text.trim()}',
                style: const TextStyle(
                  color: DT.ink,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Digite sua senha bancária para autorizar a transferência.',
                style: TextStyle(color: DT.muted, fontSize: 13),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: controller,
                autofocus: true,
                obscureText: true,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                decoration: InputDecoration(
                  labelText: 'Senha',
                  hintText: '6 dígitos',
                  prefixIcon: const Icon(Icons.password, color: DT.purple),
                  filled: true,
                  fillColor: DT.fieldBg,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: DT.fieldBorder),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: DT.purple, width: 1.5),
                  ),
                ),
                onSubmitted: (value) => Navigator.pop(context, value),
              ),
              const SizedBox(height: 16),
              DbButton(
                label: 'Autorizar PIX',
                icon: Icons.verified_user_outlined,
                onTap: () => Navigator.pop(context, controller.text),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _submit() async {
    if (_loading || _awaitingPassword) return;
    final amt = double.tryParse(_amtCtrl.text.replaceAll(',', '.'));
    if (amt == null || amt <= 0) {
      setState(() => _error = 'Valor inválido.');
      return;
    }
    if (_keyCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Informe a chave PIX.');
      return;
    }
    setState(() {
      _awaitingPassword = true;
      _error = null;
    });
    final password = await _requestPixPassword(amt);
    if (!mounted) return;
    setState(() => _awaitingPassword = false);
    if (password == null || password.isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiService.sendPix(
        accountOriginId: widget.accountId,
        pixKeyDestination: _keyCtrl.text.trim(),
        amount: amt,
        password: password,
        description: _descCtrl.text,
      );
      DatadogSdk.instance.rum?.addAttribute('pix.last_amount', amt);
      setState(() {
        _success = true;
        _receipt = data;
        _loading = false;
      });
    } catch (e) {
      final rawError = e.toString().replaceAll('Exception: ', '');
      DatadogSdk.instance.rum?.addError(
        e,
        RumErrorSource.source,
        stackTrace: StackTrace.current,
      );
      if (!mounted) return;
      setState(() {
        _error = null;
        _loading = false;
      });
      _showPixError(rawError);
    }
  }

  Future<void> _showPixError(String rawError) {
    final message = _friendlyPixError(rawError);
    return showDialog<void>(
      context: context,
      barrierColor: Colors.black.withOpacity(0.36),
      builder: (context) {
        return Dialog(
          insetPadding: const EdgeInsets.symmetric(horizontal: 26),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(22),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(22, 24, 22, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: DT.red.withOpacity(0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.warning_rounded,
                    color: DT.red,
                    size: 30,
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'PIX nao realizado',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: DT.ink,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: DT.muted,
                    fontSize: 15,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 18),
                DbButton(
                  label: 'Tentar novamente',
                  icon: Icons.refresh,
                  onTap: () {
                    Navigator.pop(context);
                    setState(() => _error = null);
                  },
                ),
                const SizedBox(height: 10),
                DbButton(
                  label: 'Voltar ao inicio',
                  icon: Icons.home,
                  filled: false,
                  onTap: () {
                    Navigator.pop(context);
                    widget.onHomeTap?.call();
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _friendlyPixError(String rawError) {
    final lower = rawError.toLowerCase();
    if (lower.contains('saldo') || lower.contains('insufficient')) {
      return 'Saldo insuficiente para concluir esta transferencia.';
    }
    if (lower.contains('duplicate') || lower.contains('duplicada')) {
      return 'Esta transferencia ja foi enviada. Altere os dados ou tente novamente em alguns instantes.';
    }
    if (lower.contains('banco central') || lower.contains('spi')) {
      return 'Nao foi possivel comunicar com o Banco Central agora. Tente novamente mais tarde.';
    }
    return 'Nao foi possivel concluir a transferencia. Tente novamente mais tarde.';
  }

  void _reset() => setState(() {
    _success = false;
    _receipt = null;
    _keyCtrl.clear();
    _amtCtrl.clear();
    _descCtrl.clear();
    _receiverLabel = null;
  });

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: DT.background,
    body: SafeArea(child: _success ? _buildReceipt() : _buildForm()),
  );

  Widget _buildForm() => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      const Text(
        'PIX',
        style: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w800,
          color: DT.ink,
        ),
      ),
      const SizedBox(height: 4),
      const Text(
        'Transferência instantânea',
        style: TextStyle(color: DT.muted, fontSize: 14),
      ),
      const SizedBox(height: 16),
      // Balance chip
      if (_balance != null)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [DT.purple, DT.purpleDark]),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Saldo disponível',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
              Text(
                _fmt.format(_balance),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
            ],
          ),
        ),
      const SizedBox(height: 20),
      // Saved keys carousel
      const Text(
        'Contatos recentes',
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: DT.ink,
        ),
      ),
      const SizedBox(height: 10),
      SizedBox(
        height: 76,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: _savedKeys.length,
          separatorBuilder: (_, __) => const SizedBox(width: 10),
          itemBuilder: (_, i) {
            final k = _savedKeys[i];
            return GestureDetector(
              onTap: () => _selectSaved(k),
              child: Container(
                width: 210,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: DT.purple.withOpacity(0.07),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: DT.purple.withOpacity(0.15)),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: DT.purple.withOpacity(0.15),
                      child: Text(
                        k.name[0],
                        style: const TextStyle(
                          color: DT.purple,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            k.name,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: DT.ink,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            _fmt.format(k.amount),
                            style: const TextStyle(
                              fontSize: 11,
                              color: DT.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
      const SizedBox(height: 20),
      Container(
        decoration: DT.cardDecoration(radius: 18),
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DbTextField(
              label: 'Chave PIX',
              placeholder: 'CPF, e-mail, telefone ou chave aleatória',
              icon: Icons.key_outlined,
              controller: _keyCtrl,
              keyboard: TextInputType.emailAddress,
            ),
            if (_receiverLabel != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.check_circle, color: DT.green, size: 16),
                  const SizedBox(width: 6),
                  Text(
                    _receiverLabel!,
                    style: const TextStyle(
                      color: DT.green,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 16),
            DbTextField(
              label: 'Valor (R\$)',
              placeholder: '0,00',
              icon: Icons.attach_money,
              controller: _amtCtrl,
              keyboard: TextInputType.number,
            ),
            const SizedBox(height: 12),
            // Quick amounts
            const Text(
              'Valor rápido',
              style: TextStyle(
                fontSize: 12,
                color: DT.muted,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [10, 25, 50, 100, 200]
                  .map(
                    (v) => GestureDetector(
                      onTap: () => _selectAmount(v),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: DT.purple.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          'R\$ $v',
                          style: const TextStyle(
                            color: DT.purple,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 16),
            DbTextField(
              label: 'Descrição (opcional)',
              placeholder: 'Para que é essa transferência?',
              icon: Icons.notes,
              controller: _descCtrl,
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.error_outline, color: DT.red, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error!,
                      style: const TextStyle(
                        color: DT.red,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        height: 1.3,
                      ),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 20),
            DbButton(
              label: 'Continuar',
              icon: Icons.arrow_forward,
              loading: _loading || _awaitingPassword,
              onTap: _submit,
            ),
          ],
        ),
      ),
    ],
  );

  Widget _buildReceipt() {
    final amt = double.tryParse(_amtCtrl.text.replaceAll(',', '.')) ?? 0;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Green success header
        Container(
          decoration: BoxDecoration(
            color: DT.green,
            borderRadius: BorderRadius.circular(20),
          ),
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.20),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check, color: Colors.white, size: 38),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'PIX Concluído!',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Text(
                      'Transferência realizada com sucesso.',
                      style: TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _fmt.format(amt),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // Purple receipt card
        Container(
          decoration: DT.cardDecoration(radius: 18),
          clipBehavior: Clip.hardEdge,
          child: Column(
            children: [
              // Purple header
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                color: DT.purple,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'DogBank',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'Comprovante PIX',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              // Green value
              Container(
                width: double.infinity,
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: DT.green.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Valor da transferência',
                      style: TextStyle(
                        color: DT.green,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      _fmt.format(amt),
                      style: const TextStyle(
                        color: DT.green,
                        fontSize: 30,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              // Details
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Column(
                  children: [
                    _receiptRow('Para', _keyCtrl.text),
                    _receiptRow('Destino', _receiverLabel ?? 'DogBank'),
                    _receiptRow(
                      'Data',
                      DateTime.now().toString().substring(0, 16),
                    ),
                    _receiptRow(
                      'ID',
                      _receipt?['transactionId']?.toString() ?? '--',
                    ),
                    _receiptRow('Status', 'Concluído'),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        DbButton(label: 'Novo PIX', icon: Icons.bolt, onTap: _reset),
      ],
    );
  }

  Widget _receiptRow(String label, String val) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: DT.muted, fontSize: 13)),
        Flexible(
          child: Text(
            val,
            style: const TextStyle(
              color: DT.ink,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
            textAlign: TextAlign.end,
          ),
        ),
      ],
    ),
  );
}
