import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import '../main.dart';

class ApiService {
  static const _baseUrl = kBaseUrl;
  static final _random = Random.secure();

  static Future<Map<String, dynamic>> login(String cpf, String senha) async {
    final res = await http.post(
      Uri.parse('$_baseUrl/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'cpf': cpf, 'senha': senha}),
    );
    if (res.statusCode == 200) return jsonDecode(res.body);
    throw Exception('Login falhou: ${res.statusCode}');
  }

  static Future<Map<String, dynamic>> getAccount(int accountId) async {
    final res = await http.get(Uri.parse('$_baseUrl/api/accounts/$accountId'));
    if (res.statusCode == 200) return jsonDecode(res.body);
    throw Exception('Conta não encontrada');
  }

  static Future<List<InvestmentProduct>> getInvestmentProducts() async {
    final res = await http.get(Uri.parse('$_baseUrl/api/investments/products'));
    if (res.statusCode != 200) {
      throw Exception('Produtos indisponíveis: ${res.statusCode}');
    }
    final data = jsonDecode(res.body) as List<dynamic>;
    return data
        .map((item) => InvestmentProduct.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  static Future<List<InvestmentPosition>> getInvestments(int accountId) async {
    final res = await http.get(
      Uri.parse('$_baseUrl/api/investments/account/$accountId'),
    );
    if (res.statusCode != 200) {
      throw Exception('Carteira indisponível: ${res.statusCode}');
    }
    final data = jsonDecode(res.body) as List<dynamic>;
    return data
        .map(
          (item) => InvestmentPosition.fromJson(item as Map<String, dynamic>),
        )
        .toList();
  }

  static Future<InvestmentPosition> subscribeInvestment({
    required int accountId,
    required String cpf,
    required String userName,
    required String productCode,
    required double amount,
    required String password,
  }) async {
    final loginData = await login(cpf, password);
    if ((loginData['accountId'] as num?)?.toInt() != accountId) {
      throw Exception('Senha não confere com a conta atual.');
    }

    final res = await http.post(
      Uri.parse('$_baseUrl/api/investments/subscribe'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'accountId': accountId,
        'cpf': cpf,
        'userName': userName,
        'productCode': productCode,
        'amount': amount,
        'requestedBy': 'dogbank-flutter-android',
      }),
    );
    if (res.statusCode == 200 || res.statusCode == 201) {
      return InvestmentPosition.fromJson(jsonDecode(res.body));
    }
    throw Exception(_messageFromError(res, 'Falha ao contratar investimento'));
  }

  static Future<InvestmentPosition> syncInvestment(String positionId) async {
    final res = await http.post(
      Uri.parse('$_baseUrl/api/investments/sync/$positionId'),
    );
    if (res.statusCode == 200) {
      return InvestmentPosition.fromJson(jsonDecode(res.body));
    }
    throw Exception(_messageFromError(res, 'Falha ao sincronizar posição'));
  }

  static Future<Map<String, dynamic>> sendPix({
    required int accountOriginId,
    required String pixKeyDestination,
    required double amount,
    required String password,
    String? description,
  }) async {
    final idempotencyKey = _newPixIdempotencyKey(accountOriginId);
    final res = await http.post(
      Uri.parse('$_baseUrl/api/transactions/pix'),
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: jsonEncode({
        'accountOriginId': accountOriginId,
        'pixKeyDestination': pixKeyDestination,
        'amount': amount,
        'password': password,
        'description': description?.trim().isNotEmpty == true
            ? description!.trim()
            : 'PIX via DogBank Flutter',
      }),
    );
    if (res.statusCode == 200) return jsonDecode(res.body);
    throw Exception('PIX falhou: ${res.statusCode} - ${res.body}');
  }

  static String _newPixIdempotencyKey(int accountId) {
    final now = DateTime.now().toUtc().microsecondsSinceEpoch;
    final suffix = _random.nextInt(0x7fffffff).toRadixString(16);
    return 'flutter-pix-$accountId-$now-$suffix';
  }

  static Future<List<dynamic>> getTransactions(int accountId) async {
    final res = await http.get(
      Uri.parse('$_baseUrl/api/transactions/account/$accountId'),
    );
    if (res.statusCode == 200) return jsonDecode(res.body);
    return [];
  }

  static String _messageFromError(http.Response res, String fallback) {
    try {
      final body = jsonDecode(res.body);
      if (body is Map<String, dynamic>) {
        return body['message']?.toString() ??
            body['error']?.toString() ??
            '$fallback: ${res.statusCode}';
      }
    } catch (_) {}
    return '$fallback: ${res.statusCode}';
  }
}

class InvestmentProduct {
  final String code;
  final String name;
  final String description;
  final String riskLevel;
  final double? annualRate;
  final double? dailyRate;
  final double? referencePrice;
  final String quoteSource;
  final String? updatedAt;
  final List<String> tags;

  const InvestmentProduct({
    required this.code,
    required this.name,
    required this.description,
    required this.riskLevel,
    this.annualRate,
    this.dailyRate,
    this.referencePrice,
    required this.quoteSource,
    this.updatedAt,
    required this.tags,
  });

  factory InvestmentProduct.fromJson(Map<String, dynamic> json) {
    return InvestmentProduct(
      code: json['code']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Investimento',
      description: json['description']?.toString() ?? '',
      riskLevel: json['riskLevel']?.toString() ?? 'Médio',
      annualRate: _toDouble(json['annualRate']),
      dailyRate: _toDouble(json['dailyRate']),
      referencePrice: _toDouble(json['referencePrice']),
      quoteSource: json['quoteSource']?.toString() ?? 'dogbank-feed',
      updatedAt: json['updatedAt']?.toString(),
      tags:
          (json['tags'] as List<dynamic>?)
              ?.map((tag) => tag.toString())
              .toList() ??
          const [],
    );
  }
}

class InvestmentPosition {
  final String positionId;
  final int accountId;
  final String productCode;
  final String productName;
  final String status;
  final double principalAmount;
  final double currentValue;
  final double expectedValue;
  final double driftAmount;
  final double driftPercent;
  final double units;
  final double? annualRate;
  final double? referencePrice;
  final String contractedBy;
  final String? contractedAt;
  final String? lastSyncedAt;
  final String? nextSyncAt;
  final String auditCorrelationId;
  final String syncReason;
  final String message;
  final String? registryId;
  final String? registryProtocol;
  final String? registryVenue;
  final String? registryStatus;

  const InvestmentPosition({
    required this.positionId,
    required this.accountId,
    required this.productCode,
    required this.productName,
    required this.status,
    required this.principalAmount,
    required this.currentValue,
    required this.expectedValue,
    required this.driftAmount,
    required this.driftPercent,
    required this.units,
    this.annualRate,
    this.referencePrice,
    required this.contractedBy,
    this.contractedAt,
    this.lastSyncedAt,
    this.nextSyncAt,
    required this.auditCorrelationId,
    required this.syncReason,
    required this.message,
    this.registryId,
    this.registryProtocol,
    this.registryVenue,
    this.registryStatus,
  });

  bool get isDrifted =>
      status.toUpperCase() == 'DRIFT' || driftAmount.abs() >= 1;

  factory InvestmentPosition.fromJson(Map<String, dynamic> json) {
    return InvestmentPosition(
      positionId: json['positionId']?.toString() ?? '',
      accountId: _toDouble(json['accountId']).toInt(),
      productCode: json['productCode']?.toString() ?? '',
      productName: json['productName']?.toString() ?? 'Investimento',
      status: json['status']?.toString() ?? 'UNKNOWN',
      principalAmount: _toDouble(json['principalAmount']),
      currentValue: _toDouble(json['currentValue']),
      expectedValue: _toDouble(json['expectedValue']),
      driftAmount: _toDouble(json['driftAmount']),
      driftPercent: _toDouble(json['driftPercent']),
      units: _toDouble(json['units']),
      annualRate: _toNullableDouble(json['annualRate']),
      referencePrice: _toNullableDouble(json['referencePrice']),
      contractedBy: json['contractedBy']?.toString() ?? '',
      contractedAt: json['contractedAt']?.toString(),
      lastSyncedAt: json['lastSyncedAt']?.toString(),
      nextSyncAt: json['nextSyncAt']?.toString(),
      auditCorrelationId: json['auditCorrelationId']?.toString() ?? '',
      syncReason: json['syncReason']?.toString() ?? '',
      message: json['message']?.toString() ?? '',
      registryId: json['registryId']?.toString(),
      registryProtocol: json['registryProtocol']?.toString(),
      registryVenue: json['registryVenue']?.toString(),
      registryStatus: json['registryStatus']?.toString(),
    );
  }
}

double _toDouble(Object? value) {
  if (value == null) return 0;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString()) ?? 0;
}

double? _toNullableDouble(Object? value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}
