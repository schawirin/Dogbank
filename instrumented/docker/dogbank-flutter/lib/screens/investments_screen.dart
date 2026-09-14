import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../widgets/db_button.dart';

class InvestmentsScreen extends StatefulWidget {
  final int accountId;
  final String cpf;
  final String nome;
  final String senha;

  const InvestmentsScreen({
    super.key,
    required this.accountId,
    required this.cpf,
    required this.nome,
    required this.senha,
  });

  @override
  State<InvestmentsScreen> createState() => _InvestmentsScreenState();
}

class _InvestmentsScreenState extends State<InvestmentsScreen> {
  final _money = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
  final _date = DateFormat('dd/MM, HH:mm', 'pt_BR');

  List<InvestmentProduct> _products = [];
  List<InvestmentPosition> _positions = [];
  bool _loading = true;
  String? _busyProductCode;
  String? _status;
  Color _statusColor = DT.muted;
  InvestmentPosition? _receiptPosition;

  @override
  void initState() {
    super.initState();
    DatadogSdk.instance.rum?.startView('Invest', 'InvestmentsScreen');
    _load();
  }

  @override
  void dispose() {
    DatadogSdk.instance.rum?.stopView('Invest');
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _status = 'Carregando investimentos...';
      _statusColor = DT.purple;
    });

    try {
      final results = await Future.wait([
        ApiService.getInvestmentProducts(),
        ApiService.getInvestments(widget.accountId),
      ]);
      if (!mounted) return;
      setState(() {
        _products = results[0] as List<InvestmentProduct>;
        _positions = results[1] as List<InvestmentPosition>;
        _loading = false;
        _status = _positions.isEmpty ? 'Nenhum investimento encontrado.' : null;
        _statusColor = DT.muted;
      });
      DatadogSdk.instance.rum?.addAttribute(
        'investments.positions',
        _positions.length,
      );
      DatadogSdk.instance.rum?.addAttribute(
        'investments.drifted',
        _positions.where((item) => item.isDrifted).length,
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
        _status = e.toString().replaceAll('Exception: ', '');
        _statusColor = DT.red;
      });
    }
  }

  Future<void> _apply(InvestmentProduct product) async {
    if (_busyProductCode != null) return;
    final amount = _defaultAmount(product);
    final password = await _requestInvestmentPassword(product, amount);
    if (password == null || password.isEmpty) return;

    setState(() {
      _busyProductCode = product.code;
      _status = 'Validando senha e contratando ${product.name}...';
      _statusColor = DT.purple;
    });

    try {
      final position = await ApiService.subscribeInvestment(
        accountId: widget.accountId,
        cpf: widget.cpf,
        userName: widget.nome,
        productCode: product.code,
        amount: amount,
        password: password,
      );
      _upsert(position);
      if (!mounted) return;
      setState(() {
        _busyProductCode = null;
        _receiptPosition = position;
        _status = 'Investimento concluído com sucesso.';
        _statusColor = DT.green;
      });
    } catch (e) {
      DatadogSdk.instance.rum?.addError(
        e,
        RumErrorSource.source,
        stackTrace: StackTrace.current,
      );
      if (!mounted) return;
      setState(() {
        _busyProductCode = null;
        _status = e.toString().replaceAll('Exception: ', '');
        _statusColor = DT.red;
      });
    }
  }

  void _upsert(InvestmentPosition position) {
    final index = _positions.indexWhere(
      (item) => item.positionId == position.positionId,
    );
    setState(() {
      if (index >= 0) {
        _positions[index] = position;
      } else {
        _positions.insert(0, position);
      }
    });
  }

  Future<String?> _requestInvestmentPassword(
    InvestmentProduct product,
    double amount,
  ) {
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
                      'Confirmar investimento',
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
                '${product.name} • ${_money.format(amount)}',
                style: const TextStyle(
                  color: DT.ink,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Digite sua senha bancária para validar a contratação.',
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
                ),
                onSubmitted: (value) => Navigator.pop(context, value),
              ),
              const SizedBox(height: 16),
              DbButton(
                label: 'Validar e aplicar',
                icon: Icons.verified_user_outlined,
                onTap: () => Navigator.pop(context, controller.text),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final receipt = _receiptPosition;

    return Scaffold(
      backgroundColor: DT.background,
      body: SafeArea(
        child: RefreshIndicator(
          color: DT.purple,
          onRefresh: _load,
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: DT.purple))
              : receipt != null
              ? ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    _investmentReceipt(receipt),
                    const SizedBox(height: 16),
                    DbButton(
                      label: 'Fazer outro investimento',
                      icon: Icons.add_circle_outline,
                      onTap: () => setState(() => _receiptPosition = null),
                    ),
                    const SizedBox(height: 10),
                    DbButton(
                      label: 'Ver carteira',
                      icon: Icons.account_balance_wallet_outlined,
                      filled: false,
                      onTap: () => setState(() => _receiptPosition = null),
                    ),
                  ],
                )
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    const Text(
                      'Investimentos',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        color: DT.ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Contratações e posições em tempo real.',
                      style: TextStyle(color: DT.muted, fontSize: 14),
                    ),
                    const SizedBox(height: 18),
                    _portfolioHeader(),
                    const SizedBox(height: 22),
                    _sectionTitle('Produtos para demo'),
                    const SizedBox(height: 12),
                    ..._products.map(_productCard),
                    const SizedBox(height: 22),
                    _sectionTitle('Carteira'),
                    const SizedBox(height: 12),
                    if (_positions.isEmpty) _emptyWallet(),
                    ..._positions.map(_positionCard),
                    if (_status != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _status!,
                        style: TextStyle(
                          color: _statusColor,
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
  }

  Widget _portfolioHeader() {
    final expectedTotal = _positions.fold<double>(
      0,
      (sum, item) => sum + item.expectedValue,
    );
    final positionCount = _positions.length;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: DT.blue,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1F1E5CD7),
            blurRadius: 18,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Valor esperado da carteira',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _money.format(expectedTotal),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  positionCount == 0
                      ? 'Nenhuma posição contratada.'
                      : '$positionCount ${positionCount == 1 ? 'posição ativa' : 'posições ativas'}.',
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ],
            ),
          ),
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.18),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.trending_up, color: Colors.white, size: 26),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String value) {
    return Text(
      value,
      style: const TextStyle(
        fontSize: 17,
        fontWeight: FontWeight.w800,
        color: DT.ink,
      ),
    );
  }

  Widget _productCard(InvestmentProduct product) {
    final tint = product.code == 'BTC' ? DT.amber : DT.green;
    final amount = _defaultAmount(product);
    final busy = _busyProductCode == product.code;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: DT.cardDecoration(radius: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: tint.withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  product.code == 'BTC'
                      ? Icons.currency_bitcoin
                      : Icons.percent,
                  color: tint,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            product.name,
                            style: const TextStyle(
                              color: DT.ink,
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        _riskPill(product.riskLevel, tint),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      product.description,
                      style: const TextStyle(color: DT.muted, fontSize: 12),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _productMeta(product),
                      style: TextStyle(
                        color: tint,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _infoStrip([
            _miniInfo('Fonte', product.quoteSource),
            _miniInfo('Aplicação demo', _money.format(amount)),
          ]),
          const SizedBox(height: 14),
          DbButton(
            label: product.code == 'BTC'
                ? 'Aplicar R\$ 50 mil'
                : 'Aplicar R\$ 1 mi',
            icon: Icons.add_circle_outline,
            loading: busy,
            filled: false,
            onTap: _busyProductCode == null ? () => _apply(product) : null,
          ),
        ],
      ),
    );
  }

  Widget _positionCard(InvestmentPosition position) {
    final tint = _colorFor(position);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: DT.cardDecoration(radius: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: tint.withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  position.productCode == 'BTC'
                      ? Icons.currency_bitcoin
                      : Icons.account_balance,
                  color: tint,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      position.productName,
                      style: const TextStyle(
                        color: DT.ink,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Contrato ${position.positionId} • ${position.contractedBy}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: DT.muted, fontSize: 11),
                    ),
                  ],
                ),
              ),
              _statusPill(position, tint),
            ],
          ),
          const SizedBox(height: 14),
          _metricRow(
            'Aplicado',
            _money.format(position.principalAmount),
            DT.purple,
          ),
          _metricRow(
            'Valor contabilizado',
            _money.format(position.currentValue),
            DT.blue,
          ),
          _metricRow(
            'Valor esperado',
            _money.format(position.expectedValue),
            DT.green,
          ),
          _metricRow('Último sync', _dateText(position.lastSyncedAt), DT.muted),
          const SizedBox(height: 10),
          _auditBox(position),
          if (position.message.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              position.message,
              style: const TextStyle(color: DT.muted, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }

  Widget _investmentReceipt(InvestmentPosition position) {
    final completedAt = _dateText(position.contractedAt);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: DT.green,
            borderRadius: BorderRadius.circular(20),
            boxShadow: const [
              BoxShadow(
                color: Color(0x1F00A86B),
                blurRadius: 18,
                offset: Offset(0, 10),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.22),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_circle,
                  color: Colors.white,
                  size: 38,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Investimento concluído!',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Text(
                      'Aplicação realizada com sucesso.',
                      style: TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _money.format(position.principalAmount),
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
        Container(
          decoration: DT.cardDecoration(radius: 18),
          clipBehavior: Clip.hardEdge,
          child: Column(
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                color: DT.purple,
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'DogBank',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'Comprovante de investimento',
                      style: TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                  ],
                ),
              ),
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
                      'Valor aplicado',
                      style: TextStyle(
                        color: DT.green,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      _money.format(position.principalAmount),
                      style: const TextStyle(
                        color: DT.green,
                        fontSize: 30,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Column(
                  children: [
                    _receiptRow('Produto', position.productName),
                    _receiptRow('Conta', '${position.accountId} | DOG BANK'),
                    _receiptRow('Posição', position.positionId),
                    _receiptRow('Data', completedAt),
                    if (position.registryProtocol != null)
                      _receiptRow('Protocolo', position.registryProtocol!),
                    _receiptRow('Status', 'Concluído'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _receiptRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: DT.muted, fontSize: 13)),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(
                color: DT.ink,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _auditBox(InvestmentPosition position) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: DT.fieldBg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _auditLine(
            Icons.manage_search,
            'Audit ID',
            position.auditCorrelationId,
          ),
          if (position.syncReason.isNotEmpty)
            _auditLine(Icons.rule, 'Motivo', position.syncReason),
          if (position.registryVenue != null)
            _auditLine(
              Icons.account_balance,
              'Registro',
              position.registryVenue!,
            ),
          if (position.registryProtocol != null)
            _auditLine(
              Icons.confirmation_number_outlined,
              'Protocolo',
              position.registryProtocol!,
            ),
        ],
      ),
    );
  }

  Widget _auditLine(IconData icon, String title, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: DT.muted, size: 16),
          const SizedBox(width: 8),
          SizedBox(
            width: 70,
            child: Text(
              title,
              style: const TextStyle(
                color: DT.muted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: DT.ink,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _emptyWallet() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: DT.cardDecoration(radius: 16),
      child: const Text(
        'A carteira aparecerá aqui após uma contratação.',
        style: TextStyle(color: DT.muted, fontSize: 13),
      ),
    );
  }

  Widget _riskPill(String text, Color tint) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: tint.withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: tint,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _statusPill(InvestmentPosition position, Color tint) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: tint.withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        'ATIVO',
        style: TextStyle(
          color: tint,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _infoStrip(List<Widget> children) {
    return Row(
      children: children
          .map(
            (child) => Expanded(
              child: Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: DT.fieldBg,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: child,
              ),
            ),
          )
          .toList(),
    );
  }

  Widget _miniInfo(String title, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: DT.muted,
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: DT.ink,
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }

  Widget _metricRow(String title, String value, Color tint) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(color: DT.muted, fontSize: 12),
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                color: tint,
                fontSize: 13,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _productMeta(InvestmentProduct product) {
    if (product.code == 'BTC') {
      return 'Cotação ${_money.format(product.referencePrice ?? 0)} | risco ${product.riskLevel}';
    }
    return 'CDI ${_percent(product.annualRate)} a.a. | risco ${product.riskLevel}';
  }

  String _percent(double? value) {
    if (value == null) return '--';
    return '${(value * 100).toStringAsFixed(2)}%';
  }

  String _dateText(String? raw) {
    if (raw == null || raw.isEmpty) return '--';
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return '--';
    return _date.format(parsed.toLocal());
  }

  Color _colorFor(InvestmentPosition position) {
    return position.productCode == 'BTC' ? DT.amber : DT.green;
  }

  double _defaultAmount(InvestmentProduct product) {
    return product.code == 'BTC' ? 50000 : 1000000;
  }
}
