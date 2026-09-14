import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme.dart';
import '../widgets/dogbank_logo.dart';
import '../widgets/db_button.dart';
import '../widgets/db_text_field.dart';
import '../services/api_service.dart';
import 'main_tab.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  // 2-step flow: cpf → password
  bool _onPasswordStep = false;
  final _cpfCtrl = TextEditingController();
  final _senhaCtrl = TextEditingController();
  bool _loading = false;
  String? _error;
  late final AnimationController _animCtrl;
  late final Animation<double> _fadeAnim;

  static const _demoCPF = '12345678915';
  static const _demoPassword = String.fromEnvironment(
    'DOGBANK_DEMO_PASSWORD',
    defaultValue: '123456',
  );
  static const _demoAutoLogin = bool.fromEnvironment(
    'DOGBANK_DEMO_AUTO_LOGIN',
    defaultValue: false,
  );

  @override
  void initState() {
    super.initState();
    DatadogSdk.instance.rum?.startView('Login', 'LoginScreen');
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
    );
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _animCtrl.forward();
    if (_demoAutoLogin) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _autoLoginDemoUser());
    }
  }

  @override
  void dispose() {
    DatadogSdk.instance.rum?.stopView('Login');
    _animCtrl.dispose();
    super.dispose();
  }

  String _formatCPF(String v) {
    final n = v.replaceAll(RegExp(r'\D'), '');
    if (n.length <= 3) return n;
    if (n.length <= 6) return '${n.substring(0, 3)}.${n.substring(3)}';
    if (n.length <= 9)
      return '${n.substring(0, 3)}.${n.substring(3, 6)}.${n.substring(6)}';
    return '${n.substring(0, 3)}.${n.substring(3, 6)}.${n.substring(6, 9)}-${n.substring(9, n.length.clamp(0, 11))}';
  }

  String _maskCPF(String cpf) {
    final n = cpf.replaceAll(RegExp(r'\D'), '');
    if (n.length < 11) return cpf;
    return '${n.substring(0, 3)}.***.***-${n.substring(9)}';
  }

  Future<void> _continueCPF() async {
    final raw = _cpfCtrl.text.replaceAll(RegExp(r'\D'), '');
    if (raw.length != 11) {
      setState(() => _error = 'Digite um CPF válido com 11 dígitos.');
      return;
    }
    setState(() {
      _error = null;
      _loading = true;
    });
    await Future.delayed(const Duration(milliseconds: 400));
    setState(() {
      _loading = false;
      _onPasswordStep = true;
    });
    _animCtrl.forward(from: 0);
  }

  Future<void> _login() async {
    if (_senhaCtrl.text.isEmpty) {
      setState(() => _error = 'Digite sua senha.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final cpf = _cpfCtrl.text.replaceAll(RegExp(r'\D'), '');
      final data = await ApiService.login(cpf, _senhaCtrl.text);
      final accountId = (data['accountId'] as num?)?.toInt() ?? 0;
      DatadogSdk.instance.setUserInfo(
        id: cpf,
        name: data['nome'] ?? '',
        email: data['chavePix'] ?? '',
        extraInfo: {'account_id': accountId, 'platform': 'flutter-android'},
      );
      DatadogSdk.instance.setAccountInfo(
        id: accountId.toString(),
        name: 'DogBank $accountId',
        extraInfo: {'cpf_masked': _maskCPF(cpf)},
      );
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => MainTab(
            nome: data['nome'] ?? '',
            accountId: accountId,
            cpf: cpf,
            senha: _senhaCtrl.text,
            chavePix: data['chavePix'] ?? '',
          ),
        ),
      );
    } catch (e) {
      DatadogSdk.instance.rum?.addError(
        e,
        RumErrorSource.source,
        stackTrace: StackTrace.current,
      );
      setState(() {
        _error = 'CPF ou senha incorretos.';
        _loading = false;
      });
    }
  }

  Future<void> _autoLoginDemoUser() async {
    if (!mounted || _loading) return;
    _cpfCtrl.text = _formatCPF(_demoCPF);
    _senhaCtrl.text = _demoPassword;
    setState(() {
      _onPasswordStep = true;
      _error = null;
    });
    _animCtrl.forward(from: 0);
    await Future.delayed(const Duration(milliseconds: 350));
    if (mounted) {
      await _login();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: DT.loginBg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            children: [
              const DogBankLogo(fontSize: 32),
              const SizedBox(height: 20),
              _buildHeroCard(),
              const SizedBox(height: 24),
              _buildFormCard(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeroCard() {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Colors.white, DT.loginLav, DT.loginRose, DT.loginSky],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [DT.purpleShadow],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _onPasswordStep ? 'Digite sua senha' : 'Acesso seguro',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: DT.ink,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _onPasswordStep
                ? 'Confirme sua identidade para acessar a conta.'
                : 'Entre com segurança para movimentar sua conta DogBank.',
            style: const TextStyle(fontSize: 13, color: DT.muted, height: 1.4),
          ),
          const SizedBox(height: 16),
          _featureRow(
            Icons.lock_outlined,
            'Segurança avançada',
            'CPF e senha em etapas separadas',
          ),
          const SizedBox(height: 10),
          _featureRow(
            Icons.bolt,
            'PIX instantâneo',
            'Envie e receba em poucos segundos',
          ),
        ],
      ),
    );
  }

  Widget _featureRow(IconData icon, String title, String sub) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.62),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: DT.purple,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(icon, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: DT.ink,
                  ),
                ),
                Text(
                  sub,
                  style: const TextStyle(fontSize: 11, color: DT.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormCard() {
    return FadeTransition(
      opacity: _fadeAnim,
      child: Container(
        decoration: DT.cardDecoration(radius: 20),
        padding: const EdgeInsets.all(20),
        child: _onPasswordStep ? _buildPasswordStep() : _buildCPFStep(),
      ),
    );
  }

  Widget _buildCPFStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _stepBadge('ETAPA 1 DE 2'),
        const SizedBox(height: 12),
        const Text(
          'Entre na sua conta',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: DT.ink,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Confirme seu CPF para continuar.',
          style: TextStyle(color: DT.muted, fontSize: 13),
        ),
        const SizedBox(height: 20),
        DbTextField(
          label: 'CPF',
          placeholder: '000.000.000-00',
          icon: Icons.person_outline,
          controller: _cpfCtrl,
          keyboard: TextInputType.number,
          action: TextInputAction.done,
        ),
        const SizedBox(height: 12),
        DbButton(
          label: 'Usar CPF demo ${_maskCPF(_demoCPF)}',
          icon: Icons.person_pin,
          filled: false,
          onTap: () {
            _cpfCtrl.text = _formatCPF(_demoCPF);
            setState(() => _error = null);
          },
        ),
        if (_error != null) ...[const SizedBox(height: 12), _errorBox(_error!)],
        const SizedBox(height: 16),
        DbButton(
          label: 'Continuar',
          icon: Icons.arrow_forward,
          loading: _loading,
          onTap: _continueCPF,
        ),
      ],
    );
  }

  Widget _buildPasswordStep() {
    final cpfMask = _maskCPF(_cpfCtrl.text.replaceAll(RegExp(r'\D'), ''));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _stepBadge('ETAPA 2 DE 2'),
        const SizedBox(height: 12),
        const Text(
          'Digite sua senha',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: DT.ink,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'CPF: $cpfMask',
          style: const TextStyle(color: DT.muted, fontSize: 13),
        ),
        const SizedBox(height: 16),
        // CPF confirmado card
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: DT.green.withOpacity(0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: DT.green.withOpacity(0.2)),
          ),
          child: Row(
            children: [
              const Icon(Icons.credit_card, color: DT.green, size: 20),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'CPF confirmado',
                    style: TextStyle(
                      fontSize: 11,
                      color: DT.green,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    cpfMask,
                    style: const TextStyle(
                      fontSize: 13,
                      color: DT.ink,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        DbTextField(
          label: 'Senha bancária',
          placeholder: '••••••',
          icon: Icons.lock_outline,
          controller: _senhaCtrl,
          obscure: true,
          action: TextInputAction.done,
        ),
        if (_error != null) ...[const SizedBox(height: 12), _errorBox(_error!)],
        const SizedBox(height: 16),
        DbButton(
          label: 'Entrar',
          icon: Icons.security,
          loading: _loading,
          onTap: _login,
        ),
        const SizedBox(height: 12),
        DbButton(
          label: 'Voltar',
          icon: Icons.arrow_back,
          filled: false,
          onTap: () {
            setState(() {
              _onPasswordStep = false;
              _error = null;
              _senhaCtrl.clear();
            });
            _animCtrl.forward(from: 0);
          },
        ),
      ],
    );
  }

  Widget _stepBadge(String text) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: DT.purple.withOpacity(0.10),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      text,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: DT.purple,
        letterSpacing: 0.5,
      ),
    ),
  );

  Widget _errorBox(String msg) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: DT.red.withOpacity(0.07),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      children: [
        const Icon(Icons.error_outline, color: DT.red, size: 18),
        const SizedBox(width: 8),
        Expanded(
          child: Text(msg, style: const TextStyle(color: DT.red, fontSize: 13)),
        ),
      ],
    ),
  );
}
