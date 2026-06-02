import UIKit
import DatadogCore
import DatadogRUM
import DatadogSessionReplay

private typealias DogBankRUMAttributes = [String: any Encodable]

private enum DogBankTheme {
    static let background = UIColor(red: 0.95, green: 0.97, blue: 1.00, alpha: 1.0)
    static let card = UIColor.white
    static let ink = UIColor(red: 0.08, green: 0.10, blue: 0.18, alpha: 1.0)
    static let muted = UIColor(red: 0.38, green: 0.45, blue: 0.56, alpha: 1.0)
    static let purple = UIColor(red: 0.49, green: 0.23, blue: 0.94, alpha: 1.0)
    static let purpleDark = UIColor(red: 0.32, green: 0.13, blue: 0.72, alpha: 1.0)
    static let loginBackground = UIColor(red: 0.96, green: 0.98, blue: 1.00, alpha: 1.0)
    static let loginLavender = UIColor(red: 0.94, green: 0.90, blue: 1.00, alpha: 1.0)
    static let loginRose = UIColor(red: 1.00, green: 0.92, blue: 0.98, alpha: 1.0)
    static let loginSky = UIColor(red: 0.91, green: 0.97, blue: 1.00, alpha: 1.0)
    static let green = UIColor(red: 0.12, green: 0.62, blue: 0.38, alpha: 1.0)
    static let red = UIColor(red: 0.82, green: 0.18, blue: 0.24, alpha: 1.0)
    static let amber = UIColor(red: 0.93, green: 0.62, blue: 0.19, alpha: 1.0)
    static let blue = UIColor(red: 0.12, green: 0.36, blue: 0.84, alpha: 1.0)
}

private final class DogBankGradientView: UIView {
    private let gradientLayer = CAGradientLayer()

    init(colors: [UIColor], startPoint: CGPoint = CGPoint(x: 0, y: 0), endPoint: CGPoint = CGPoint(x: 1, y: 1)) {
        super.init(frame: .zero)
        gradientLayer.colors = colors.map(\.cgColor)
        gradientLayer.startPoint = startPoint
        gradientLayer.endPoint = endPoint
        layer.insertSublayer(gradientLayer, at: 0)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        gradientLayer.frame = bounds
        gradientLayer.cornerRadius = layer.cornerRadius
    }
}

private let brlFormatter: NumberFormatter = {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.locale = Locale(identifier: "pt_BR")
    formatter.currencyCode = "BRL"
    return formatter
}()

private let dateFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "pt_BR")
    formatter.dateStyle = .short
    formatter.timeStyle = .short
    return formatter
}()

private struct DogBankSession {
    let cpf: String
    let name: String
    let pixKey: String
    let accountID: Int
}

private struct DogBankAccount {
    let id: Int
    let accountNumber: String
    let balance: Double
    let userName: String
    let bank: String
}

private struct DogBankPixValidation {
    let valid: Bool
    let receiverName: String?
    let receiverBank: String?
    let receiverCPF: String?
    let message: String?
}

private struct DogBankPixReceipt {
    let id: Int?
    let amount: Double
    let pixKeyDestination: String
    let receiverName: String?
    let receiverBank: String?
    let description: String
    let completedAt: Date?
}

private struct DogBankPixDraft {
    let pixKey: String
    let amount: Double
    let description: String
    let receiverName: String?
    let receiverBank: String?
    let sourceAccountID: Int
}

private struct DogBankTransaction {
    let id: Int
    let originID: Int?
    let destinationID: Int?
    let amount: Double
    let description: String
    let receiverName: String?
    let senderName: String?
    let receiverBank: String?
    let pixKeyDestination: String?
    let completedAt: Date?

    func isOutgoing(from accountID: Int) -> Bool {
        originID == accountID
    }
}

final class DogBankURLSessionDelegate: NSObject, URLSessionDataDelegate, URLSessionTaskDelegate {}

private enum DogBankAPIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case server(status: Int, message: String)
    case missingField(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "URL invalida para o backend DogBank."
        case .invalidResponse:
            return "Resposta invalida do backend DogBank."
        case .server(_, let message):
            return message
        case .missingField(let field):
            return "Resposta sem o campo esperado: \(field)."
        }
    }
}

private enum DogBankDemoError: LocalizedError {
    case expectedInvalidPixKey(String)

    var errorDescription: String? {
        switch self {
        case .expectedInvalidPixKey(let pixKey):
            return "Erro esperado da demo: chave PIX invalida \(pixKey)."
        }
    }
}

private final class DogBankAPI {
    static let shared = DogBankAPI()

    private let baseURL = URL(string: "https://lab.dogbank.dog")!
    private let decoder = JSONDecoder()
    private let session = URLSession(
        configuration: .default,
        delegate: DogBankURLSessionDelegate(),
        delegateQueue: nil
    )

    private init() {}

    func login(cpf: String, password: String) async throws -> DogBankSession {
        let json = try await request(
            path: "/api/auth/login",
            method: "POST",
            body: [
                "cpf": cpf.trimmingCharacters(in: .whitespacesAndNewlines),
                "senha": password
            ]
        )
        let dict = try dictionary(json)
        let name = try requiredString(dict, "nome")
        let accountID = try requiredInt(dict, "accountId")
        let pixKey = string(dict, "chavePix") ?? ""
        return DogBankSession(cpf: cpf, name: name, pixKey: pixKey, accountID: accountID)
    }

    func fetchAccount(cpf: String) async throws -> DogBankAccount {
        let json = try await request(path: "/api/accounts/user/cpf/\(cpf)", method: "GET")
        let dict = try dictionary(json)
        return DogBankAccount(
            id: int(dict, "id") ?? 0,
            accountNumber: string(dict, "accountNumber") ?? "0000-0",
            balance: double(dict, "balance") ?? double(dict, "saldo") ?? 0,
            userName: string(dict, "userName") ?? string(dict, "nome") ?? "Cliente DogBank",
            bank: string(dict, "banco") ?? "DOG BANK"
        )
    }

    func fetchTransactions(accountID: Int) async throws -> [DogBankTransaction] {
        let json = try await request(path: "/api/transactions/account/\(accountID)", method: "GET")
        guard let items = json as? [[String: Any]] else {
            return []
        }
        return items.map { tx in
            DogBankTransaction(
                id: int(tx, "id") ?? 0,
                originID: int(tx, "accountOriginId"),
                destinationID: int(tx, "accountDestinationId"),
                amount: double(tx, "amount") ?? 0,
                description: string(tx, "description") ?? "PIX DogBank",
                receiverName: string(tx, "receiverName"),
                senderName: string(tx, "senderName"),
                receiverBank: string(tx, "receiverBank"),
                pixKeyDestination: string(tx, "pixKeyDestination"),
                completedAt: date(tx, "completedAt") ?? date(tx, "startedAt")
            )
        }
        .sorted { lhs, rhs in
            (lhs.completedAt ?? .distantPast) > (rhs.completedAt ?? .distantPast)
        }
    }

    func validatePixKey(_ pixKey: String) async throws -> DogBankPixValidation {
        let json = try await request(
            path: "/api/auth/validate-pix",
            method: "GET",
            queryItems: [URLQueryItem(name: "chavePix", value: pixKey)]
        )
        let dict = try dictionary(json)
        let valid = bool(dict, "valid") ?? false
        let user = dict["user"] as? [String: Any]
        return DogBankPixValidation(
            valid: valid,
            receiverName: user.flatMap { string($0, "nome") ?? string($0, "name") },
            receiverBank: user.flatMap { string($0, "banco") ?? string($0, "bank") },
            receiverCPF: user.flatMap { string($0, "cpf") },
            message: string(dict, "message") ?? string(dict, "error")
        )
    }

    func executePix(
        session: DogBankSession,
        pixKey: String,
        amount: Double,
        description: String,
        password: String
    ) async throws -> DogBankPixReceipt {
        _ = try await login(cpf: session.cpf, password: password)

        let bcJSON = try await request(
            path: "/api/bancocentral/pix/validate",
            method: "POST",
            body: [
                "pixKey": pixKey,
                "amount": amount
            ],
            timeout: 15
        )
        let bc = try dictionary(bcJSON)
        if let status = string(bc, "status"), status != "APPROVED" {
            throw DogBankAPIError.server(
                status: 422,
                message: string(bc, "error") ?? "Transacao nao aprovada pelo Banco Central."
            )
        }

        let txJSON = try await request(
            path: "/api/transactions/pix",
            method: "POST",
            body: [
                "accountOriginId": session.accountID,
                "pixKeyDestination": pixKey,
                "amount": amount,
                "description": description,
                "password": password
            ],
            timeout: 15
        )
        let tx = try dictionary(txJSON)
        return DogBankPixReceipt(
            id: int(tx, "id") ?? int(tx, "transactionId"),
            amount: double(tx, "amount") ?? amount,
            pixKeyDestination: string(tx, "pixKeyDestination") ?? pixKey,
            receiverName: string(tx, "receiverName"),
            receiverBank: string(tx, "receiverBank"),
            description: string(tx, "description") ?? description,
            completedAt: date(tx, "completedAt") ?? date(tx, "startedAt")
        )
    }

    private func request(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        body: [String: Any]? = nil,
        timeout: TimeInterval = 10
    ) async throws -> Any {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        components?.path = path
        components?.queryItems = queryItems.isEmpty ? nil : queryItems
        guard let url = components?.url else {
            throw DogBankAPIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = timeout
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("dogbank-ios-native", forHTTPHeaderField: "x-dogbank-client")

        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await dataTask(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw DogBankAPIError.invalidResponse
        }

        guard (200...299).contains(http.statusCode) else {
            throw DogBankAPIError.server(
                status: http.statusCode,
                message: message(from: data) ?? "Erro HTTP \(http.statusCode) no backend DogBank."
            )
        }

        guard !data.isEmpty else {
            return [:]
        }

        return try JSONSerialization.jsonObject(with: data)
    }

    private func dataTask(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await withCheckedThrowingContinuation { continuation in
            session.dataTask(with: request) { data, response, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let response else {
                    continuation.resume(throwing: DogBankAPIError.invalidResponse)
                    return
                }

                continuation.resume(returning: (data ?? Data(), response))
            }.resume()
        }
    }

    private func dictionary(_ json: Any) throws -> [String: Any] {
        guard let dict = json as? [String: Any] else {
            throw DogBankAPIError.invalidResponse
        }
        return dict
    }

    private func requiredString(_ dict: [String: Any], _ key: String) throws -> String {
        guard let value = string(dict, key) else {
            throw DogBankAPIError.missingField(key)
        }
        return value
    }

    private func requiredInt(_ dict: [String: Any], _ key: String) throws -> Int {
        guard let value = int(dict, key) else {
            throw DogBankAPIError.missingField(key)
        }
        return value
    }

    private func message(from data: Data) -> String? {
        guard !data.isEmpty,
              let object = try? JSONSerialization.jsonObject(with: data),
              let dict = object as? [String: Any] else {
            return nil
        }
        return string(dict, "error") ?? string(dict, "message") ?? string(dict, "details")
    }
}

private func string(_ dict: [String: Any], _ key: String) -> String? {
    if let value = dict[key] as? String {
        return value
    }
    if let value = dict[key] as? NSNumber {
        return value.stringValue
    }
    return nil
}

private func int(_ dict: [String: Any], _ key: String) -> Int? {
    if let value = dict[key] as? Int {
        return value
    }
    if let value = dict[key] as? NSNumber {
        return value.intValue
    }
    if let value = dict[key] as? String {
        return Int(value)
    }
    return nil
}

private func double(_ dict: [String: Any], _ key: String) -> Double? {
    if let value = dict[key] as? Double {
        return value
    }
    if let value = dict[key] as? NSNumber {
        return value.doubleValue
    }
    if let value = dict[key] as? String {
        return Double(value)
    }
    return nil
}

private func bool(_ dict: [String: Any], _ key: String) -> Bool? {
    if let value = dict[key] as? Bool {
        return value
    }
    if let value = dict[key] as? NSNumber {
        return value.boolValue
    }
    if let value = dict[key] as? String {
        return ["true", "1", "yes"].contains(value.lowercased())
    }
    return nil
}

private func date(_ dict: [String: Any], _ key: String) -> Date? {
    guard let raw = string(dict, key) else {
        return nil
    }

    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let parsed = iso.date(from: raw) {
        return parsed
    }

    iso.formatOptions = [.withInternetDateTime]
    return iso.date(from: raw)
}

private func money(_ value: Double) -> String {
    brlFormatter.string(from: NSNumber(value: value)) ?? "R$ \(String(format: "%.2f", value))"
}

private func digitsOnly(_ value: String) -> String {
    String(value.filter { $0.isNumber })
}

private func formatCPF(_ value: String) -> String {
    let digits = digitsOnly(value)
    guard digits.count == 11 else {
        return digits
    }
    let first = digits.prefix(3)
    let secondStart = digits.index(digits.startIndex, offsetBy: 3)
    let secondEnd = digits.index(digits.startIndex, offsetBy: 6)
    let thirdEnd = digits.index(digits.startIndex, offsetBy: 9)
    let second = digits[secondStart..<secondEnd]
    let third = digits[secondEnd..<thirdEnd]
    let verifier = digits[thirdEnd..<digits.endIndex]
    return "\(first).\(second).\(third)-\(verifier)"
}

private func formatCPFForDemoReplay(_ value: String) -> String {
    let digits = digitsOnly(value)
    guard digits.count == 11 else {
        return formatCPF(value)
    }

    let secondStart = digits.index(digits.startIndex, offsetBy: 3)
    let secondEnd = digits.index(digits.startIndex, offsetBy: 6)
    let thirdEnd = digits.index(digits.startIndex, offsetBy: 9)
    let second = digits[secondStart..<secondEnd]
    let third = digits[secondEnd..<thirdEnd]
    let verifier = digits[thirdEnd..<digits.endIndex]
    return "***.\(second).\(third)-\(verifier)"
}

private func dogbankTrack(_ name: String, attributes: DogBankRUMAttributes = [:]) {
    RUMMonitor.shared().addAction(type: .custom, name: name, attributes: attributes)
}

private func dogbankError(_ error: Error, attributes: DogBankRUMAttributes = [:]) {
    RUMMonitor.shared().addError(error: error, source: .custom, attributes: attributes)
    var logAttributes: [String: any Encodable] = attributes
    logAttributes["error.kind"] = String(describing: type(of: error))
    dogbankLogger?.error(error.localizedDescription, attributes: logAttributes)
}

private func dogbankLaunchArgumentValue(_ name: String) -> String? {
    let prefix = "\(name)="
    return ProcessInfo.processInfo.arguments
        .first { $0.hasPrefix(prefix) }
        .map { String($0.dropFirst(prefix.count)) }
}

private func makeDogBankLogoView(height: CGFloat = 58, fontSize: CGFloat = 34, centered: Bool = true) -> UIView {
    let wordmark = UILabel()
    wordmark.text = "DogBank"
    let baseFont = UIFont.systemFont(ofSize: fontSize, weight: .heavy)
    if let rounded = baseFont.fontDescriptor.withDesign(.rounded) {
        wordmark.font = UIFont(descriptor: rounded, size: fontSize)
    } else {
        wordmark.font = baseFont
    }
    wordmark.textColor = DogBankTheme.purple
    wordmark.adjustsFontForContentSizeCategory = false
    wordmark.setContentHuggingPriority(.required, for: .horizontal)

    let paw = UIImageView(image: UIImage(systemName: "pawprint.fill"))
    paw.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: fontSize * 0.62, weight: .bold)
    paw.tintColor = DogBankTheme.purple
    paw.contentMode = .scaleAspectFit
    paw.translatesAutoresizingMaskIntoConstraints = false

    let stack = UIStackView(arrangedSubviews: [wordmark, paw])
    stack.axis = .horizontal
    stack.alignment = .center
    stack.spacing = 2
    stack.translatesAutoresizingMaskIntoConstraints = false

    let container = UIView()
    container.translatesAutoresizingMaskIntoConstraints = false
    container.addSubview(stack)

    var constraints = [
        container.heightAnchor.constraint(equalToConstant: height),
        stack.topAnchor.constraint(greaterThanOrEqualTo: container.topAnchor),
        stack.bottomAnchor.constraint(lessThanOrEqualTo: container.bottomAnchor),
        stack.centerYAnchor.constraint(equalTo: container.centerYAnchor),
        paw.widthAnchor.constraint(equalToConstant: fontSize * 0.74),
        paw.heightAnchor.constraint(equalToConstant: fontSize * 0.74)
    ]

    if centered {
        constraints.append(stack.centerXAnchor.constraint(equalTo: container.centerXAnchor))
        constraints.append(stack.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor))
        constraints.append(stack.trailingAnchor.constraint(lessThanOrEqualTo: container.trailingAnchor))
    } else {
        constraints.append(stack.leadingAnchor.constraint(equalTo: container.leadingAnchor))
        constraints.append(stack.trailingAnchor.constraint(lessThanOrEqualTo: container.trailingAnchor))
    }

    NSLayoutConstraint.activate(constraints)
    return container
}

private final class DogBankButton: UIButton {
    init(title: String, systemImage: String? = nil, filled: Bool = true) {
        super.init(frame: .zero)
        var configuration = UIButton.Configuration.filled()
        if !filled {
            configuration = .tinted()
        }
        configuration.title = title
        configuration.image = systemImage.flatMap { UIImage(systemName: $0) }
        configuration.imagePadding = 8
        configuration.baseForegroundColor = filled ? .white : DogBankTheme.purple
        configuration.baseBackgroundColor = filled ? DogBankTheme.purple : DogBankTheme.purple.withAlphaComponent(0.12)
        configuration.cornerStyle = .medium
        self.configuration = configuration
        titleLabel?.font = .preferredFont(forTextStyle: .headline)
        heightAnchor.constraint(greaterThanOrEqualToConstant: 48).isActive = true
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

private final class DogBankTextField: UITextField {
    init(placeholder: String, systemImage: String? = nil, secure: Bool = false, keyboard: UIKeyboardType = .default) {
        super.init(frame: .zero)
        self.placeholder = placeholder
        self.isSecureTextEntry = secure
        self.keyboardType = keyboard
        self.textContentType = secure ? .password : nil
        self.autocapitalizationType = .none
        self.autocorrectionType = .no
        self.backgroundColor = UIColor(red: 0.97, green: 0.98, blue: 1.00, alpha: 1)
        self.layer.cornerRadius = 14
        self.layer.borderColor = UIColor(red: 0.86, green: 0.89, blue: 0.95, alpha: 1).cgColor
        self.layer.borderWidth = 1
        self.font = .preferredFont(forTextStyle: .body)
        self.textColor = DogBankTheme.ink
        self.heightAnchor.constraint(equalToConstant: 52).isActive = true

        let icon = UIImageView(image: systemImage.flatMap { UIImage(systemName: $0) })
        icon.tintColor = DogBankTheme.purple
        icon.contentMode = .center
        let container = UIView(frame: CGRect(x: 0, y: 0, width: 44, height: 52))
        icon.frame = container.bounds
        container.addSubview(icon)
        leftView = container
        leftViewMode = .always
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

private final class InfoRowView: UIView {
    init(icon: String, title: String, value: String, tint: UIColor = DogBankTheme.purple) {
        super.init(frame: .zero)
        backgroundColor = UIColor(red: 0.97, green: 0.98, blue: 1.00, alpha: 1)
        layer.cornerRadius = 12

        let imageView = UIImageView(image: UIImage(systemName: icon))
        imageView.tintColor = tint
        imageView.contentMode = .center
        imageView.backgroundColor = tint.withAlphaComponent(0.12)
        imageView.layer.cornerRadius = 10
        imageView.translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = UILabel()
        titleLabel.text = title
        titleLabel.font = .preferredFont(forTextStyle: .caption1)
        titleLabel.textColor = DogBankTheme.muted

        let valueLabel = UILabel()
        valueLabel.text = value
        valueLabel.font = .preferredFont(forTextStyle: .subheadline)
        valueLabel.textColor = DogBankTheme.ink
        valueLabel.numberOfLines = 2

        let labels = UIStackView(arrangedSubviews: [titleLabel, valueLabel])
        labels.axis = .vertical
        labels.spacing = 3

        let stack = UIStackView(arrangedSubviews: [imageView, labels])
        stack.alignment = .center
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            imageView.widthAnchor.constraint(equalToConstant: 38),
            imageView.heightAnchor.constraint(equalToConstant: 38),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

private func makeScrollStack(in view: UIView) -> (UIScrollView, UIStackView) {
    let scrollView = UIScrollView()
    scrollView.alwaysBounceVertical = true
    scrollView.keyboardDismissMode = .interactive
    scrollView.contentInset.bottom = 28
    if #available(iOS 13.0, *) {
        scrollView.verticalScrollIndicatorInsets.bottom = 28
    } else {
        scrollView.scrollIndicatorInsets.bottom = 28
    }
    scrollView.translatesAutoresizingMaskIntoConstraints = false

    let stack = UIStackView()
    stack.axis = .vertical
    stack.spacing = 16
    stack.translatesAutoresizingMaskIntoConstraints = false

    view.addSubview(scrollView)
    scrollView.addSubview(stack)

    let bottomConstraint: NSLayoutConstraint
    if #available(iOS 15.0, *) {
        bottomConstraint = scrollView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor)
    } else {
        bottomConstraint = scrollView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
    }

    NSLayoutConstraint.activate([
        scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
        scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
        scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        bottomConstraint,
        stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 18),
        stack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 20),
        stack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -20),
        stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -40)
    ])

    return (scrollView, stack)
}

private func card(_ arrangedSubviews: [UIView], spacing: CGFloat = 12) -> UIView {
    let stack = UIStackView(arrangedSubviews: arrangedSubviews)
    stack.axis = .vertical
    stack.spacing = spacing
    stack.translatesAutoresizingMaskIntoConstraints = false

    let view = UIView()
    view.backgroundColor = DogBankTheme.card
    view.layer.cornerRadius = 16
    view.layer.shadowColor = UIColor.black.cgColor
    view.layer.shadowOpacity = 0.06
    view.layer.shadowRadius = 12
    view.layer.shadowOffset = CGSize(width: 0, height: 8)
    view.addSubview(stack)

    NSLayoutConstraint.activate([
        stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 18),
        stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 18),
        stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -18),
        stack.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -18)
    ])

    return view
}

private func label(_ text: String, style: UIFont.TextStyle, color: UIColor = DogBankTheme.ink, weight: UIFont.Weight = .regular, lines: Int = 0) -> UILabel {
    let label = UILabel()
    label.text = text
    label.textColor = color
    label.numberOfLines = lines
    label.font = .systemFont(ofSize: UIFont.preferredFont(forTextStyle: style).pointSize, weight: weight)
    return label
}

private final class PixProcessingOverlay: UIView {
    private let container = UIView()
    private let spinner = UIActivityIndicatorView(style: .large)
    private let titleLabel = label("Processando seu PIX", style: .title2, weight: .bold, lines: 0)
    private let messageLabel = label("Aguarde enquanto processamos sua transferencia.", style: .body, color: DogBankTheme.muted, lines: 0)
    private let counterLabel = label("", style: .largeTitle, color: DogBankTheme.purple, weight: .bold)
    private let stepStack = UIStackView()
    private var dots: [UIView] = []

    override init(frame: CGRect) {
        super.init(frame: frame)
        configure()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func configure() {
        backgroundColor = UIColor(red: 0.95, green: 0.97, blue: 1.0, alpha: 0.96)
        alpha = 0
        translatesAutoresizingMaskIntoConstraints = false

        container.backgroundColor = .white
        container.layer.cornerRadius = 22
        container.layer.shadowColor = UIColor.black.cgColor
        container.layer.shadowOpacity = 0.12
        container.layer.shadowRadius = 22
        container.layer.shadowOffset = CGSize(width: 0, height: 12)
        container.translatesAutoresizingMaskIntoConstraints = false
        addSubview(container)

        spinner.color = DogBankTheme.purple
        spinner.startAnimating()

        let iconHost = UIView()
        iconHost.backgroundColor = DogBankTheme.purple.withAlphaComponent(0.12)
        iconHost.layer.cornerRadius = 46
        iconHost.translatesAutoresizingMaskIntoConstraints = false
        iconHost.addSubview(spinner)
        spinner.translatesAutoresizingMaskIntoConstraints = false

        let pulse = UIView()
        pulse.layer.borderColor = DogBankTheme.purple.withAlphaComponent(0.25).cgColor
        pulse.layer.borderWidth = 2
        pulse.layer.cornerRadius = 46
        pulse.translatesAutoresizingMaskIntoConstraints = false
        iconHost.insertSubview(pulse, at: 0)

        titleLabel.textAlignment = .center
        messageLabel.textAlignment = .center
        counterLabel.textAlignment = .center

        stepStack.axis = .horizontal
        stepStack.spacing = 10
        stepStack.alignment = .center
        stepStack.distribution = .fillEqually
        ["Validando", "Processando", "Finalizando"].forEach { text in
            let dot = UIView()
            dot.backgroundColor = DogBankTheme.purple.withAlphaComponent(0.25)
            dot.layer.cornerRadius = 4
            dot.translatesAutoresizingMaskIntoConstraints = false
            dot.widthAnchor.constraint(equalToConstant: 8).isActive = true
            dot.heightAnchor.constraint(equalToConstant: 8).isActive = true
            dots.append(dot)

            let textLabel = label(text, style: .caption2, color: DogBankTheme.muted, weight: .medium, lines: 1)
            textLabel.textAlignment = .center
            let group = UIStackView(arrangedSubviews: [dot, textLabel])
            group.axis = .vertical
            group.spacing = 5
            group.alignment = .center
            stepStack.addArrangedSubview(group)
        }

        let stack = UIStackView(arrangedSubviews: [iconHost, titleLabel, messageLabel, counterLabel, stepStack])
        stack.axis = .vertical
        stack.spacing = 14
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(stack)

        NSLayoutConstraint.activate([
            container.centerYAnchor.constraint(equalTo: centerYAnchor),
            container.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 28),
            container.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -28),
            iconHost.widthAnchor.constraint(equalToConstant: 92),
            iconHost.heightAnchor.constraint(equalToConstant: 92),
            spinner.centerXAnchor.constraint(equalTo: iconHost.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: iconHost.centerYAnchor),
            pulse.topAnchor.constraint(equalTo: iconHost.topAnchor),
            pulse.leadingAnchor.constraint(equalTo: iconHost.leadingAnchor),
            pulse.trailingAnchor.constraint(equalTo: iconHost.trailingAnchor),
            pulse.bottomAnchor.constraint(equalTo: iconHost.bottomAnchor),
            stack.topAnchor.constraint(equalTo: container.topAnchor, constant: 24),
            stack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 22),
            stack.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -22),
            stack.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -24),
            stepStack.widthAnchor.constraint(equalTo: stack.widthAnchor)
        ])

        UIView.animate(withDuration: 1.2, delay: 0, options: [.autoreverse, .repeat, .allowUserInteraction]) {
            pulse.transform = CGAffineTransform(scaleX: 1.18, y: 1.18)
            pulse.alpha = 0.15
        }
    }

    func show(on parent: UIView) {
        parent.addSubview(self)
        NSLayoutConstraint.activate([
            topAnchor.constraint(equalTo: parent.topAnchor),
            leadingAnchor.constraint(equalTo: parent.leadingAnchor),
            trailingAnchor.constraint(equalTo: parent.trailingAnchor),
            bottomAnchor.constraint(equalTo: parent.bottomAnchor)
        ])
        parent.layoutIfNeeded()
        UIView.animate(withDuration: 0.18) {
            self.alpha = 1
        }
    }

    func update(message: String, counter: Int?, activeStep: Int) {
        messageLabel.text = message
        counterLabel.text = counter.map { "\($0)" } ?? ""
        for (index, dot) in dots.enumerated() {
            dot.backgroundColor = index <= activeStep ? DogBankTheme.purple : DogBankTheme.purple.withAlphaComponent(0.25)
        }
    }

    func dismiss() {
        UIView.animate(withDuration: 0.18, animations: {
            self.alpha = 0
        }, completion: { _ in
            self.removeFromSuperview()
        })
    }
}

private final class PixErrorViewController: UIViewController {
    private let errorTitle: String
    private let errorMessage: String
    var onRetry: (() -> Void)?
    var onDashboard: (() -> Void)?

    init(title: String, message: String) {
        self.errorTitle = title
        self.errorMessage = message
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .overFullScreen
        modalTransitionStyle = .crossDissolve
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.black.withAlphaComponent(0.36)

        let icon = UIImageView(image: UIImage(systemName: "exclamationmark.triangle.fill"))
        icon.tintColor = DogBankTheme.red
        icon.contentMode = .center
        icon.backgroundColor = DogBankTheme.red.withAlphaComponent(0.12)
        icon.layer.cornerRadius = 28
        icon.translatesAutoresizingMaskIntoConstraints = false

        let title = label(errorTitle, style: .title2, weight: .bold, lines: 0)
        title.textAlignment = .center
        let message = label(errorMessage, style: .body, color: DogBankTheme.muted, lines: 0)
        message.textAlignment = .center

        let retry = DogBankButton(title: "Tentar novamente", systemImage: "arrow.clockwise")
        retry.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)
        let dashboard = DogBankButton(title: "Voltar ao inicio", systemImage: "house.fill", filled: false)
        dashboard.addTarget(self, action: #selector(dashboardTapped), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [icon, title, message, retry, dashboard])
        stack.axis = .vertical
        stack.spacing = 14
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false

        let sheet = UIView()
        sheet.backgroundColor = .white
        sheet.layer.cornerRadius = 22
        sheet.translatesAutoresizingMaskIntoConstraints = false
        sheet.addSubview(stack)
        view.addSubview(sheet)

        NSLayoutConstraint.activate([
            icon.widthAnchor.constraint(equalToConstant: 56),
            icon.heightAnchor.constraint(equalToConstant: 56),
            retry.widthAnchor.constraint(equalTo: stack.widthAnchor),
            dashboard.widthAnchor.constraint(equalTo: stack.widthAnchor),
            sheet.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            sheet.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 26),
            sheet.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -26),
            stack.topAnchor.constraint(equalTo: sheet.topAnchor, constant: 24),
            stack.leadingAnchor.constraint(equalTo: sheet.leadingAnchor, constant: 22),
            stack.trailingAnchor.constraint(equalTo: sheet.trailingAnchor, constant: -22),
            stack.bottomAnchor.constraint(equalTo: sheet.bottomAnchor, constant: -24)
        ])
    }

    @objc private func retryTapped() {
        dismiss(animated: true) {
            self.onRetry?()
        }
    }

    @objc private func dashboardTapped() {
        dismiss(animated: true) {
            self.onDashboard?()
        }
    }
}

private final class ProgressBarView: UIView {
    private let fill = UIView()

    init(progress: CGFloat, tint: UIColor = DogBankTheme.purple) {
        super.init(frame: .zero)
        backgroundColor = UIColor(red: 0.88, green: 0.90, blue: 0.95, alpha: 1)
        layer.cornerRadius = 6
        heightAnchor.constraint(equalToConstant: 12).isActive = true

        fill.backgroundColor = tint
        fill.layer.cornerRadius = 6
        fill.translatesAutoresizingMaskIntoConstraints = false
        addSubview(fill)

        NSLayoutConstraint.activate([
            fill.topAnchor.constraint(equalTo: topAnchor),
            fill.leadingAnchor.constraint(equalTo: leadingAnchor),
            fill.bottomAnchor.constraint(equalTo: bottomAnchor),
            fill.widthAnchor.constraint(equalTo: widthAnchor, multiplier: max(0, min(progress, 1)))
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

private func makeKeyValueRow(title: String, value: String, valueColor: UIColor = DogBankTheme.ink, mono: Bool = false) -> UIView {
    let titleLabel = label(title, style: .subheadline, color: DogBankTheme.muted)
    let valueLabel = label(value, style: .subheadline, color: valueColor, weight: .semibold, lines: 0)
    if mono {
        valueLabel.font = .monospacedSystemFont(ofSize: valueLabel.font.pointSize, weight: .semibold)
    }
    valueLabel.textAlignment = .right

    let row = UIStackView(arrangedSubviews: [titleLabel, valueLabel])
    row.axis = .horizontal
    row.spacing = 12
    row.alignment = .firstBaseline
    titleLabel.setContentHuggingPriority(.defaultHigh, for: .horizontal)
    return row
}

final class DogBankNativeViewController: UIViewController {
    private enum LoginStep {
        case cpf
        case password
    }

    private let api = DogBankAPI.shared
    private let cpfField = DogBankTextField(placeholder: "000.000.000-00", systemImage: "person.text.rectangle", keyboard: .numberPad)
    private let passwordField = DogBankTextField(placeholder: "Senha de 6 digitos", systemImage: "lock", secure: true, keyboard: .numberPad)
    private let button = DogBankButton(title: "Continuar", systemImage: "arrow.right")
    private let backButton = DogBankButton(title: "Voltar e trocar CPF", systemImage: "chevron.left", filled: false)
    private let stepLabel = label("", style: .caption1, color: DogBankTheme.purple, weight: .bold)
    private let titleLabel = label("", style: .title1, weight: .bold, lines: 0)
    private let subtitleLabel = label("", style: .body, color: DogBankTheme.muted, lines: 0)
    private let formStack = UIStackView()
    private let loginScrollView = UIScrollView()
    private let loginContentStack = UIStackView()
    private let footerView = UIView()
    private let footerStack = UIStackView()
    private let statusLabel = label("", style: .footnote, color: DogBankTheme.muted, lines: 0)
    private let isAutoLoginEnabled = ProcessInfo.processInfo.arguments.contains("--dogbank-auto-login")
    private let isDemoJourneyEnabled = ProcessInfo.processInfo.arguments.contains("--dogbank-demo-journey")
    private let autoLoginPassword = dogbankLaunchArgumentValue("--dogbank-password") ?? "123456"
    private var loginStep: LoginStep = .cpf
    private var selectedCPF = dogbankLaunchArgumentValue("--dogbank-cpf")
        ?? UserDefaults.standard.string(forKey: "dogbank.last_demo_cpf")
        ?? "12345678915"
    private var didAutoLogin = false

    init() {
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = DogBankTheme.loginBackground
        cpfField.text = selectedCPF
        cpfField.textContentType = .username
        cpfField.dd.sessionReplayPrivacyOverrides.textAndInputPrivacy = .maskAll
        passwordField.dd.sessionReplayPrivacyOverrides.textAndInputPrivacy = .maskAll
        configureLayout()
        button.addTarget(self, action: #selector(loginTapped), for: .touchUpInside)
        backButton.addTarget(self, action: #selector(backToCPF), for: .touchUpInside)
        updateLoginStep()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard isAutoLoginEnabled, !didAutoLogin else {
            return
        }
        didAutoLogin = true
        let launchCPF = dogbankLaunchArgumentValue("--dogbank-cpf") ?? selectedCPF
        selectedCPF = digitsOnly(launchCPF)
        cpfField.text = selectedCPF
        passwordField.text = autoLoginPassword
        submitLogin()
    }

    private func configureLayout() {
        loginScrollView.alwaysBounceVertical = true
        loginScrollView.keyboardDismissMode = .interactive
        loginScrollView.contentInset.bottom = 18
        loginScrollView.delaysContentTouches = false
        loginScrollView.translatesAutoresizingMaskIntoConstraints = false

        loginContentStack.axis = .vertical
        loginContentStack.spacing = 16
        loginContentStack.translatesAutoresizingMaskIntoConstraints = false

        formStack.axis = .vertical
        formStack.spacing = 12

        statusLabel.textAlignment = .center

        footerView.backgroundColor = DogBankTheme.loginBackground.withAlphaComponent(0.97)
        footerView.translatesAutoresizingMaskIntoConstraints = false

        footerStack.axis = .vertical
        footerStack.spacing = 8
        footerStack.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(loginScrollView)
        view.addSubview(footerView)
        loginScrollView.addSubview(loginContentStack)
        footerView.addSubview(footerStack)

        footerStack.addArrangedSubview(statusLabel)
        footerStack.addArrangedSubview(button)

        let footerBottomConstraint: NSLayoutConstraint
        if #available(iOS 15.0, *) {
            footerBottomConstraint = footerView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor)
        } else {
            footerBottomConstraint = footerView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        }

        NSLayoutConstraint.activate([
            loginScrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            loginScrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            loginScrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            loginScrollView.bottomAnchor.constraint(equalTo: footerView.topAnchor),

            loginContentStack.topAnchor.constraint(equalTo: loginScrollView.contentLayoutGuide.topAnchor, constant: 16),
            loginContentStack.leadingAnchor.constraint(equalTo: loginScrollView.frameLayoutGuide.leadingAnchor, constant: 20),
            loginContentStack.trailingAnchor.constraint(equalTo: loginScrollView.frameLayoutGuide.trailingAnchor, constant: -20),
            loginContentStack.bottomAnchor.constraint(equalTo: loginScrollView.contentLayoutGuide.bottomAnchor, constant: -24),

            footerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            footerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            footerBottomConstraint,

            footerStack.topAnchor.constraint(equalTo: footerView.topAnchor, constant: 10),
            footerStack.leadingAnchor.constraint(equalTo: footerView.leadingAnchor, constant: 20),
            footerStack.trailingAnchor.constraint(equalTo: footerView.trailingAnchor, constant: -20),
            footerStack.bottomAnchor.constraint(equalTo: footerView.safeAreaLayoutGuide.bottomAnchor, constant: -10)
        ])

        loginContentStack.addArrangedSubview(makeLoginLogo())
        loginContentStack.addArrangedSubview(makeLoginHero())
        loginContentStack.addArrangedSubview(card([stepLabel, titleLabel, subtitleLabel, formStack], spacing: 14))
    }

    @objc private func loginTapped() {
        switch loginStep {
        case .cpf:
            continueToPassword()
        case .password:
            submitLogin()
        }
    }

    @objc private func backToCPF() {
        loginStep = .cpf
        passwordField.text = ""
        statusLabel.text = ""
        updateLoginStep()
        cpfField.becomeFirstResponder()
        dogbankTrack("dogbank.native.login.back_to_cpf")
    }

    @objc private func useDemoCPF() {
        selectedCPF = "12345678915"
        cpfField.text = selectedCPF
        statusLabel.text = "CPF demo carregado."
        statusLabel.textColor = DogBankTheme.purple
        dogbankTrack("dogbank.native.login.demo_cpf_selected")
    }

    private func makeLoginLogo() -> UIView {
        makeDogBankLogoView(height: 58, fontSize: 34)
    }

    private func makeLoginHero() -> UIView {
        let title = label("Acesso seguro", style: .largeTitle, color: DogBankTheme.ink, weight: .bold, lines: 2)
        let subtitle = label("Entre em duas etapas e gere RUM, Session Replay e chamadas ao backend no Datadog.", style: .subheadline, color: DogBankTheme.muted, lines: 0)

        let shield = featureRow(icon: "lock.shield.fill", title: "Seguranca avancada", subtitle: "CPF e senha em etapas separadas")
        let pix = featureRow(icon: "bolt.fill", title: "PIX instantaneo", subtitle: "Demo pronta para sucesso e erro")

        let stack = UIStackView(arrangedSubviews: [title, subtitle, shield, pix])
        stack.axis = .vertical
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false

        let view = DogBankGradientView(colors: [
            .white,
            DogBankTheme.loginLavender,
            DogBankTheme.loginRose,
            DogBankTheme.loginSky
        ])
        view.backgroundColor = .white
        view.layer.cornerRadius = 24
        view.layer.shadowColor = DogBankTheme.purple.cgColor
        view.layer.shadowOpacity = 0.12
        view.layer.shadowRadius = 18
        view.layer.shadowOffset = CGSize(width: 0, height: 10)
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -20)
        ])

        return view
    }

    private func featureRow(icon: String, title: String, subtitle: String) -> UIView {
        let image = UIImageView(image: UIImage(systemName: icon))
        image.tintColor = .white
        image.contentMode = .center
        image.backgroundColor = DogBankTheme.purple
        image.layer.cornerRadius = 12
        image.translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = label(title, style: .subheadline, color: DogBankTheme.ink, weight: .semibold)
        let subtitleLabel = label(subtitle, style: .caption1, color: DogBankTheme.muted, lines: 0)
        let text = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
        text.axis = .vertical
        text.spacing = 3

        let row = UIStackView(arrangedSubviews: [image, text])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 12

        NSLayoutConstraint.activate([
            image.widthAnchor.constraint(equalToConstant: 44),
            image.heightAnchor.constraint(equalToConstant: 44)
        ])

        let container = UIView()
        container.backgroundColor = UIColor.white.withAlphaComponent(0.62)
        container.layer.cornerRadius = 16
        container.addSubview(row)
        row.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: container.topAnchor, constant: 10),
            row.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 10),
            row.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -10),
            row.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -10)
        ])

        return container
    }

    private func updateLoginStep() {
        formStack.arrangedSubviews.forEach { view in
            formStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }

        statusLabel.textColor = DogBankTheme.muted

        switch loginStep {
        case .cpf:
            stepLabel.text = "ETAPA 1 DE 2"
            titleLabel.text = "Entre na sua conta"
            subtitleLabel.text = "Confirme seu CPF para continuar."
            setButton(button, title: "Continuar", image: "arrow.right")

            let demoCPF = DogBankButton(title: "Usar CPF demo \(formatCPFForDemoReplay("12345678915"))", systemImage: "person.fill.checkmark", filled: false)
            demoCPF.addTarget(self, action: #selector(useDemoCPF), for: .touchUpInside)

            formStack.addArrangedSubview(label("CPF", style: .headline, weight: .semibold))
            formStack.addArrangedSubview(cpfField)
            formStack.addArrangedSubview(demoCPF)

        case .password:
            let cpf = formatCPFForDemoReplay(selectedCPF)
            stepLabel.text = "ETAPA 2 DE 2"
            titleLabel.text = "Digite sua senha"
            subtitleLabel.text = "CPF: \(cpf)"
            setButton(button, title: "Entrar", image: "checkmark.shield.fill")

            formStack.addArrangedSubview(backButton)
            formStack.addArrangedSubview(InfoRowView(icon: "person.text.rectangle", title: "CPF confirmado", value: cpf, tint: DogBankTheme.green))
            formStack.addArrangedSubview(label("Senha bancaria", style: .headline, weight: .semibold))
            formStack.addArrangedSubview(passwordField)
        }
    }

    private func setButton(_ button: UIButton, title: String, image: String) {
        var configuration = button.configuration
        configuration?.title = title
        configuration?.image = UIImage(systemName: image)
        button.configuration = configuration
    }

    private func continueToPassword() {
        let cpf = digitsOnly(cpfField.text ?? "")
        guard cpf.count == 11 else {
            statusLabel.textColor = DogBankTheme.red
            statusLabel.text = "CPF invalido. Digite os 11 digitos."
            return
        }

        selectedCPF = cpf
        UserDefaults.standard.set(cpf, forKey: "dogbank.last_demo_cpf")
        statusLabel.text = ""
        dogbankTrack("dogbank.native.login.cpf_confirmed", attributes: ["cpf": formatCPFForDemoReplay(cpf)])

        let password = DogBankPasswordViewController(
            cpf: cpf,
            api: api,
            isDemoJourneyEnabled: isDemoJourneyEnabled
        )
        password.modalPresentationStyle = .fullScreen
        present(password, animated: true)
    }

    private func setBusy(_ busy: Bool) {
        button.isEnabled = !busy
        backButton.isEnabled = !busy
        cpfField.isEnabled = !busy
        passwordField.isEnabled = !busy
    }

    private func submitLogin() {
        let cpf = selectedCPF.isEmpty ? digitsOnly(cpfField.text ?? "") : selectedCPF
        let password = passwordField.text ?? ""
        guard cpf.count == 11, password.count >= 6 else {
            statusLabel.textColor = DogBankTheme.red
            statusLabel.text = "Informe CPF e senha de 6 digitos."
            return
        }

        setBusy(true)
        statusLabel.textColor = DogBankTheme.purple
        statusLabel.text = "Validando acesso seguro..."
        dogbankTrack("dogbank.native.login.started", attributes: ["cpf": formatCPFForDemoReplay(cpf)])

        Task {
            do {
                let session = try await api.login(cpf: cpf, password: password)
                Datadog.setUserInfo(
                    id: formatCPFForDemoReplay(session.cpf),
                    name: session.name,
                    email: session.pixKey.contains("@") ? session.pixKey : nil,
                    extraInfo: [
                        "account_id": session.accountID,
                        "pix_key": session.pixKey
                    ]
                )
                Datadog.setAccountInfo(
                    id: "\(session.accountID)",
                    name: "DogBank",
                    extraInfo: [
                        "account_number": "\(session.accountID)",
                        "customer_name": session.name
                    ]
                )
                dogbankTrack("dogbank.native.login.success", attributes: [
                    "cpf": formatCPFForDemoReplay(session.cpf),
                    "account_id": session.accountID
                ])
                await MainActor.run {
                    self.statusLabel.text = "Login confirmado."
                    self.setBusy(false)
                    let tabs = DogBankTabBarController(session: session, api: self.api)
                    tabs.modalPresentationStyle = .fullScreen
                    self.present(tabs, animated: true) {
                        if self.isDemoJourneyEnabled {
                            tabs.runDemoJourney()
                        }
                    }
                }
            } catch {
                dogbankError(error, attributes: ["flow": "login", "cpf": formatCPFForDemoReplay(cpf)])
                dogbankTrack("dogbank.native.login.failed", attributes: [
                    "cpf": formatCPFForDemoReplay(cpf),
                    "error": error.localizedDescription
                ])
                await MainActor.run {
                    self.setBusy(false)
                    self.passwordField.text = ""
                    self.statusLabel.textColor = DogBankTheme.red
                    self.statusLabel.text = error.localizedDescription
                }
            }
        }
    }
}

private final class DogBankPasswordViewController: UIViewController {
    private let cpf: String
    private let api: DogBankAPI
    private let isDemoJourneyEnabled: Bool
    private let passwordField = DogBankTextField(placeholder: "Senha de 6 digitos", systemImage: "lock", secure: true, keyboard: .numberPad)
    private let submitButton = DogBankButton(title: "Entrar", systemImage: "checkmark.shield.fill")
    private let backButton = DogBankButton(title: "Voltar e trocar CPF", systemImage: "chevron.left", filled: false)
    private let statusLabel = label("", style: .footnote, color: DogBankTheme.muted, lines: 0)
    private let scrollView = UIScrollView()
    private let contentStack = UIStackView()
    private let footerView = UIView()
    private let footerStack = UIStackView()

    init(cpf: String, api: DogBankAPI, isDemoJourneyEnabled: Bool) {
        self.cpf = cpf
        self.api = api
        self.isDemoJourneyEnabled = isDemoJourneyEnabled
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = DogBankTheme.loginBackground
        passwordField.dd.sessionReplayPrivacyOverrides.textAndInputPrivacy = .maskAll
        configureLayout()
        submitButton.addTarget(self, action: #selector(submitLogin), for: .touchUpInside)
        backButton.addTarget(self, action: #selector(backTapped), for: .touchUpInside)
        dogbankTrack("dogbank.native.login.password_view_opened", attributes: ["cpf": formatCPFForDemoReplay(cpf)])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        passwordField.becomeFirstResponder()
    }

    private func configureLayout() {
        scrollView.alwaysBounceVertical = true
        scrollView.keyboardDismissMode = .interactive
        scrollView.contentInset.bottom = 18
        scrollView.delaysContentTouches = false
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        contentStack.axis = .vertical
        contentStack.spacing = 16
        contentStack.translatesAutoresizingMaskIntoConstraints = false

        footerView.backgroundColor = DogBankTheme.loginBackground.withAlphaComponent(0.97)
        footerView.translatesAutoresizingMaskIntoConstraints = false

        footerStack.axis = .vertical
        footerStack.spacing = 8
        footerStack.translatesAutoresizingMaskIntoConstraints = false

        statusLabel.textAlignment = .center

        view.addSubview(scrollView)
        view.addSubview(footerView)
        scrollView.addSubview(contentStack)
        footerView.addSubview(footerStack)

        footerStack.addArrangedSubview(statusLabel)
        footerStack.addArrangedSubview(submitButton)

        let footerBottomConstraint: NSLayoutConstraint
        if #available(iOS 15.0, *) {
            footerBottomConstraint = footerView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor)
        } else {
            footerBottomConstraint = footerView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        }

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: footerView.topAnchor),

            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 16),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 20),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -20),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -24),

            footerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            footerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            footerBottomConstraint,

            footerStack.topAnchor.constraint(equalTo: footerView.topAnchor, constant: 10),
            footerStack.leadingAnchor.constraint(equalTo: footerView.leadingAnchor, constant: 20),
            footerStack.trailingAnchor.constraint(equalTo: footerView.trailingAnchor, constant: -20),
            footerStack.bottomAnchor.constraint(equalTo: footerView.safeAreaLayoutGuide.bottomAnchor, constant: -10)
        ])

        contentStack.addArrangedSubview(makeDogBankLogoView(height: 54, fontSize: 32))
        contentStack.addArrangedSubview(makePasswordHero())
        contentStack.addArrangedSubview(makePasswordFormCard())
    }

    private func makePasswordHero() -> UIView {
        let title = label("Senha bancaria", style: .largeTitle, color: DogBankTheme.ink, weight: .bold, lines: 2)
        let subtitle = label("Confirme sua senha para entrar com seguranca e gerar a jornada completa no Datadog.", style: .subheadline, color: DogBankTheme.muted, lines: 0)
        let cpfRow = InfoRowView(icon: "person.text.rectangle", title: "CPF confirmado", value: formatCPFForDemoReplay(cpf), tint: DogBankTheme.green)

        let stack = UIStackView(arrangedSubviews: [title, subtitle, cpfRow])
        stack.axis = .vertical
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false

        let view = DogBankGradientView(colors: [
            .white,
            DogBankTheme.loginSky,
            DogBankTheme.loginLavender
        ])
        view.backgroundColor = .white
        view.layer.cornerRadius = 24
        view.layer.shadowColor = DogBankTheme.purple.cgColor
        view.layer.shadowOpacity = 0.10
        view.layer.shadowRadius = 16
        view.layer.shadowOffset = CGSize(width: 0, height: 10)
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -20)
        ])

        return view
    }

    private func makePasswordFormCard() -> UIView {
        let title = label("Digite sua senha", style: .title1, weight: .bold, lines: 0)
        let subtitle = label("Informe sua senha bancaria para acessar sua conta.", style: .body, color: DogBankTheme.muted, lines: 0)
        let passwordTitle = label("Senha", style: .headline, weight: .semibold)

        return card([
            backButton,
            title,
            subtitle,
            passwordTitle,
            passwordField
        ], spacing: 14)
    }

    @objc private func backTapped() {
        dogbankTrack("dogbank.native.login.password_back", attributes: ["cpf": formatCPFForDemoReplay(cpf)])
        dismiss(animated: true)
    }

    private func setBusy(_ busy: Bool) {
        submitButton.isEnabled = !busy
        backButton.isEnabled = !busy
        passwordField.isEnabled = !busy
    }

    @objc private func submitLogin() {
        let password = passwordField.text ?? ""
        guard password.count >= 6 else {
            statusLabel.textColor = DogBankTheme.red
            statusLabel.text = "Informe a senha de 6 digitos."
            return
        }

        setBusy(true)
        statusLabel.textColor = DogBankTheme.purple
        statusLabel.text = "Validando acesso seguro..."
        dogbankTrack("dogbank.native.login.started", attributes: ["cpf": formatCPFForDemoReplay(cpf)])

        Task {
            do {
                let session = try await api.login(cpf: cpf, password: password)
                Datadog.setUserInfo(
                    id: formatCPFForDemoReplay(session.cpf),
                    name: session.name,
                    email: session.pixKey.contains("@") ? session.pixKey : nil,
                    extraInfo: [
                        "account_id": session.accountID,
                        "pix_key": session.pixKey
                    ]
                )
                Datadog.setAccountInfo(
                    id: "\(session.accountID)",
                    name: "DogBank",
                    extraInfo: [
                        "account_number": "\(session.accountID)",
                        "customer_name": session.name
                    ]
                )
                dogbankTrack("dogbank.native.login.success", attributes: [
                    "cpf": formatCPFForDemoReplay(session.cpf),
                    "account_id": session.accountID
                ])

                await MainActor.run {
                    self.statusLabel.text = "Login confirmado."
                    self.setBusy(false)
                    let tabs = DogBankTabBarController(session: session, api: self.api)
                    tabs.modalPresentationStyle = .fullScreen
                    self.present(tabs, animated: true) {
                        if self.isDemoJourneyEnabled {
                            tabs.runDemoJourney()
                        }
                    }
                }
            } catch {
                dogbankError(error, attributes: ["flow": "login", "cpf": formatCPFForDemoReplay(cpf)])
                dogbankTrack("dogbank.native.login.failed", attributes: [
                    "cpf": formatCPFForDemoReplay(cpf),
                    "error": error.localizedDescription
                ])
                await MainActor.run {
                    self.setBusy(false)
                    self.passwordField.text = ""
                    self.statusLabel.textColor = DogBankTheme.red
                    self.statusLabel.text = error.localizedDescription
                }
            }
        }
    }
}

private final class DogBankTabBarController: UITabBarController, UITabBarControllerDelegate {
    private let session: DogBankSession
    private let api: DogBankAPI
    private var didRunDemoJourney = false
    private let demoPixKeys = [
        "pedro.silva@dogbank.com",
        "joao.santos@dogbank.com",
        "emiliano.costa@dogbank.com",
        "eliane.oliveira@dogbank.com",
        "patricia.souza@dogbank.com"
    ]

    init(session: DogBankSession, api: DogBankAPI) {
        self.session = session
        self.api = api
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        delegate = self
        tabBar.tintColor = DogBankTheme.purple
        tabBar.unselectedItemTintColor = DogBankTheme.muted
        tabBar.backgroundColor = .white

        let dashboard = DashboardViewController(session: session, api: api)
        dashboard.onPixTapped = { [weak self] in self?.selectedIndex = 1 }
        dashboard.onHistoryTapped = { [weak self] in self?.selectedIndex = 2 }

        viewControllers = [
            tab(dashboard, title: "Inicio", icon: "house.fill"),
            tab(PixViewController(session: session, api: api), title: "PIX", icon: "bolt.fill"),
            tab(HistoryViewController(session: session, api: api), title: "Extrato", icon: "list.bullet.rectangle"),
            tab(CardsViewController(session: session), title: "Cartoes", icon: "creditcard.fill"),
            tab(ProfileViewController(session: session, api: api), title: "Perfil", icon: "person.crop.circle")
        ]
    }

    func tabBarController(_ tabBarController: UITabBarController, didSelect viewController: UIViewController) {
        dogbankTrack("dogbank.native.tab.changed", attributes: [
            "tab_index": selectedIndex,
            "tab": viewController.tabBarItem.title ?? ""
        ])
    }

    func runDemoJourney() {
        guard !didRunDemoJourney else {
            return
        }
        didRunDemoJourney = true

        let isSpiFailureScenario = ProcessInfo.processInfo.arguments.contains("--dogbank-spi-failure")

        Task {
            dogbankTrack("dogbank.native.demo_journey.started", attributes: [
                "account_id": session.accountID,
                "source": "simctl",
                "scenario": isSpiFailureScenario ? "spi_failure" : "success"
            ])

            try? await Task.sleep(nanoseconds: 1_500_000_000)
            await MainActor.run {
                self.selectedIndex = 1
            }

            let pixKey = demoPixKeys.randomElement() ?? "pedro.silva@dogbank.com"
            let amount: Double = isSpiFailureScenario
                ? 100.0
                : Double(Int(Double.random(in: 7.0...48.0) * 100)) / 100

            do {
                let receipt = try await api.executePix(
                    session: session,
                    pixKey: pixKey,
                    amount: amount,
                    description: "Demo mobile auto PIX",
                    password: "123456"
                )
                dogbankTrack("dogbank.native.demo_journey.pix.success", attributes: [
                    "amount": amount,
                    "source_account_id": session.accountID,
                    "destination_pix_key": pixKey,
                    "transaction_id": receipt.id ?? 0
                ])
            } catch {
                let isSPITimeout = amount == 100.0
                dogbankError(error, attributes: [
                    "flow": "demo_journey_pix_failure",
                    "amount": amount,
                    "error_code": isSPITimeout ? "PIX-TIMEOUT" : "PIX_TRANSFER_ERROR",
                    "error_source": isSPITimeout ? "banco_central_spi" : "transaction_service",
                    "spi_error": isSPITimeout,
                    "spi_component": isSPITimeout ? "banco_central" : ""
                ])
                dogbankTrack("dogbank.native.demo_journey.pix.failure", attributes: [
                    "amount": amount,
                    "error": error.localizedDescription,
                    "error_code": isSPITimeout ? "PIX-TIMEOUT" : "PIX_TRANSFER_ERROR",
                    "spi_error": isSPITimeout,
                    "scenario": isSpiFailureScenario ? "spi_failure" : "unexpected_error"
                ])
            }

            try? await Task.sleep(nanoseconds: 1_000_000_000)
            let invalidPixKey = "chave.invalida.ios@dogbank.com"

            do {
                let validation = try await api.validatePixKey(invalidPixKey)
                if !validation.valid {
                    let expectedError = DogBankDemoError.expectedInvalidPixKey(invalidPixKey)
                    dogbankError(expectedError, attributes: [
                        "flow": "demo_journey_expected_error",
                        "scenario": "invalid_pix_key"
                    ])
                    dogbankTrack("dogbank.native.demo_journey.pix.expected_error", attributes: [
                        "scenario": "invalid_pix_key",
                        "pix_key_type": "email"
                    ])
                }
            } catch {
                dogbankError(error, attributes: [
                    "flow": "demo_journey_invalid_pix_validation",
                    "scenario": "invalid_pix_key"
                ])
            }

            try? await Task.sleep(nanoseconds: 800_000_000)
            await MainActor.run {
                self.selectedIndex = 0
            }

            dogbankTrack("dogbank.native.demo_journey.completed", attributes: [
                "account_id": session.accountID
            ])

            try? await Task.sleep(nanoseconds: 700_000_000)
            RUMMonitor.shared().stopSession()
            Datadog.clearUserInfo()
            Datadog.clearAccountInfo()
        }
    }

    private func tab(_ viewController: UIViewController, title: String, icon: String) -> UINavigationController {
        viewController.title = title
        let navigation = UINavigationController(rootViewController: viewController)
        navigation.navigationBar.prefersLargeTitles = false
        navigation.tabBarItem = UITabBarItem(title: title, image: UIImage(systemName: icon), selectedImage: nil)
        return navigation
    }
}

private final class DashboardViewController: UIViewController {
    var onPixTapped: (() -> Void)?
    var onHistoryTapped: (() -> Void)?

    private let session: DogBankSession
    private let api: DogBankAPI
    private let balanceLabel = label("R$ --", style: .largeTitle, weight: .bold, lines: 1)
    private let accountLabel = label("Conta --", style: .subheadline, color: DogBankTheme.muted)
    private let transactionsStack = UIStackView()
    private let statusLabel = label("", style: .footnote, color: DogBankTheme.muted, lines: 0)

    init(session: DogBankSession, api: DogBankAPI) {
        self.session = session
        self.api = api
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = DogBankTheme.background
        configureLayout()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        refresh()
    }

    private func configureLayout() {
        let (_, stack) = makeScrollStack(in: view)

        let eyebrow = dashboardLogoView()
        let greeting = label("Ola, \(firstName(session.name))", style: .title1, weight: .bold)
        let subtitle = label("Painel nativo conectado ao backend DogBank.", style: .subheadline, color: DogBankTheme.muted)

        stack.addArrangedSubview(eyebrow)
        stack.addArrangedSubview(greeting)
        stack.addArrangedSubview(subtitle)

        let pixButton = DogBankButton(title: "Fazer PIX", systemImage: "bolt.fill")
        pixButton.addTarget(self, action: #selector(pixTapped), for: .touchUpInside)
        let extractButton = DogBankButton(title: "Ver extrato", systemImage: "list.bullet.rectangle", filled: false)
        extractButton.addTarget(self, action: #selector(historyTapped), for: .touchUpInside)

        let actions = UIStackView(arrangedSubviews: [pixButton, extractButton])
        actions.axis = .horizontal
        actions.spacing = 10
        actions.distribution = .fillEqually

        let balanceCard = card([label("Saldo disponivel", style: .subheadline, color: DogBankTheme.muted), balanceLabel, accountLabel, actions])
        stack.addArrangedSubview(balanceCard)

        let quickTitle = label("Acoes rapidas", style: .headline, weight: .semibold)
        let quickGrid = UIStackView(arrangedSubviews: [
            quickAction(title: "PIX", icon: "bolt.fill", color: DogBankTheme.purple, selector: #selector(pixTapped)),
            quickAction(title: "Extrato", icon: "doc.text.fill", color: DogBankTheme.blue, selector: #selector(historyTapped)),
            quickAction(title: "Cartoes", icon: "creditcard.fill", color: DogBankTheme.green, selector: #selector(cardsTapped))
        ])
        quickGrid.axis = .horizontal
        quickGrid.spacing = 10
        quickGrid.distribution = .fillEqually
        stack.addArrangedSubview(card([quickTitle, quickGrid]))

        transactionsStack.axis = .vertical
        transactionsStack.spacing = 10
        stack.addArrangedSubview(card([label("Ultimas transacoes", style: .headline, weight: .semibold), transactionsStack, statusLabel]))
    }

    private func dashboardLogoView() -> UIView {
        makeDogBankLogoView(height: 36, fontSize: 22, centered: false)
    }

    private func quickAction(title: String, icon: String, color: UIColor, selector: Selector) -> UIButton {
        var configuration = UIButton.Configuration.tinted()
        configuration.title = title
        configuration.image = UIImage(systemName: icon)
        configuration.imagePlacement = .top
        configuration.imagePadding = 6
        configuration.baseForegroundColor = color
        configuration.baseBackgroundColor = color.withAlphaComponent(0.12)
        configuration.cornerStyle = .medium
        let button = UIButton(configuration: configuration)
        button.addTarget(self, action: selector, for: .touchUpInside)
        button.heightAnchor.constraint(equalToConstant: 82).isActive = true
        return button
    }

    private func refresh() {
        statusLabel.text = "Atualizando dados..."
        Task {
            do {
                let account = try await api.fetchAccount(cpf: session.cpf)
                let transactions = try await api.fetchTransactions(accountID: session.accountID)
                dogbankTrack("dogbank.native.dashboard.loaded", attributes: [
                    "account_id": session.accountID,
                    "transaction_count": transactions.count
                ])
                await MainActor.run {
                    self.balanceLabel.text = money(account.balance)
                    self.accountLabel.text = "Conta \(account.accountNumber) | \(account.bank)"
                    self.renderTransactions(Array(transactions.prefix(4)))
                    self.statusLabel.text = transactions.isEmpty ? "Nenhuma transacao encontrada." : ""
                }
            } catch {
                dogbankError(error, attributes: ["flow": "dashboard"])
                await MainActor.run {
                    self.statusLabel.text = error.localizedDescription
                }
            }
        }
    }

    private func renderTransactions(_ transactions: [DogBankTransaction]) {
        transactionsStack.arrangedSubviews.forEach { view in
            transactionsStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }

        for tx in transactions {
            transactionsStack.addArrangedSubview(TransactionRow(transaction: tx, accountID: session.accountID))
        }
    }

    @objc private func pixTapped() {
        onPixTapped?()
    }

    @objc private func historyTapped() {
        onHistoryTapped?()
    }

    @objc private func cardsTapped() {
        tabBarController?.selectedIndex = 3
    }
}

private final class PixViewController: UIViewController {
    private struct SavedPixKey {
        let name: String
        let key: String
        let bank: String
        let defaultAmount: Double
        let description: String
    }

    private let session: DogBankSession
    private let api: DogBankAPI
    private let balanceLabel = label("R$ --", style: .title1, color: .white, weight: .bold)
    private let accountLabel = label("Conta --", style: .caption1, color: UIColor.white.withAlphaComponent(0.84))
    private let keyField = DogBankTextField(placeholder: "CPF, e-mail, telefone ou chave aleatoria", systemImage: "key", keyboard: .emailAddress)
    private let amountField = DogBankTextField(placeholder: "0,00", systemImage: "brazilianrealsign", keyboard: .decimalPad)
    private let descriptionField = DogBankTextField(placeholder: "Descricao opcional", systemImage: "text.alignleft")
    private let submitButton = DogBankButton(title: "Continuar", systemImage: "arrow.right")
    private let statusLabel = label("", style: .footnote, color: DogBankTheme.muted, lines: 0)
    private let receiverLabel = label("Valide uma chave para ver o destinatario.", style: .subheadline, color: DogBankTheme.muted, lines: 0)
    private var validation: DogBankPixValidation?
    private var account: DogBankAccount?
    private weak var scrollView: UIScrollView?
    private let savedPixKeys = [
        SavedPixKey(name: "Pedro Silva", key: "pedro.silva@dogbank.com", bank: "DogBank", defaultAmount: 35.66, description: "PIX para Pedro Silva"),
        SavedPixKey(name: "Joao Santos", key: "joao.santos@dogbank.com", bank: "DogBank", defaultAmount: 18.90, description: "PIX para Joao Santos"),
        SavedPixKey(name: "Emiliano Costa", key: "emiliano.costa@dogbank.com", bank: "DogBank", defaultAmount: 50.26, description: "PIX para Emiliano Costa"),
        SavedPixKey(name: "Eliane Oliveira", key: "eliane.oliveira@dogbank.com", bank: "DogBank", defaultAmount: 46.46, description: "PIX para Eliane Oliveira"),
        SavedPixKey(name: "Patricia Souza", key: "patricia.souza@dogbank.com", bank: "DogBank", defaultAmount: 27.40, description: "PIX para Patricia Souza")
    ]

    init(session: DogBankSession, api: DogBankAPI) {
        self.session = session
        self.api = api
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = DogBankTheme.background
        configureLayout()
        submitButton.addTarget(self, action: #selector(submitTapped), for: .touchUpInside)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        refreshAccount()
    }

    func resetForm() {
        keyField.text = ""
        amountField.text = ""
        descriptionField.text = ""
        validation = nil
        receiverLabel.text = "Valide uma chave para ver o destinatario."
        receiverLabel.textColor = DogBankTheme.muted
        statusLabel.text = ""
        statusLabel.textColor = DogBankTheme.muted
    }

    private func configureLayout() {
        let (scroll, stack) = makeScrollStack(in: view)
        scrollView = scroll
        scroll.contentInset.bottom = 118
        if #available(iOS 13.0, *) {
            scroll.verticalScrollIndicatorInsets.bottom = 118
        } else {
            scroll.scrollIndicatorInsets.bottom = 118
        }

        stack.addArrangedSubview(label("PIX", style: .largeTitle, weight: .bold))
        stack.addArrangedSubview(label("Envie dinheiro de forma rapida e acompanhe a validacao em tempo real.", style: .body, color: DogBankTheme.muted, lines: 0))

        let balanceIcon = UIImageView(image: UIImage(systemName: "brazilianrealsign.circle.fill"))
        balanceIcon.tintColor = .white
        balanceIcon.contentMode = .center
        balanceIcon.backgroundColor = UIColor.white.withAlphaComponent(0.18)
        balanceIcon.layer.cornerRadius = 22
        balanceIcon.translatesAutoresizingMaskIntoConstraints = false

        let balanceText = UIStackView(arrangedSubviews: [
            label("Saldo disponivel", style: .caption1, color: UIColor.white.withAlphaComponent(0.82), weight: .medium),
            balanceLabel,
            accountLabel
        ])
        balanceText.axis = .vertical
        balanceText.spacing = 4

        let balanceRow = UIStackView(arrangedSubviews: [balanceText, balanceIcon])
        balanceRow.axis = .horizontal
        balanceRow.alignment = .center
        balanceRow.spacing = 16
        balanceRow.distribution = .equalSpacing

        let balanceCard = UIView()
        balanceCard.backgroundColor = DogBankTheme.purple
        balanceCard.layer.cornerRadius = 18
        balanceRow.translatesAutoresizingMaskIntoConstraints = false
        balanceCard.addSubview(balanceRow)
        NSLayoutConstraint.activate([
            balanceIcon.widthAnchor.constraint(equalToConstant: 44),
            balanceIcon.heightAnchor.constraint(equalToConstant: 44),
            balanceRow.topAnchor.constraint(equalTo: balanceCard.topAnchor, constant: 18),
            balanceRow.leadingAnchor.constraint(equalTo: balanceCard.leadingAnchor, constant: 18),
            balanceRow.trailingAnchor.constraint(equalTo: balanceCard.trailingAnchor, constant: -18),
            balanceRow.bottomAnchor.constraint(equalTo: balanceCard.bottomAnchor, constant: -18)
        ])
        stack.addArrangedSubview(balanceCard)

        let validateButton = DogBankButton(title: "Validar chave", systemImage: "magnifyingglass", filled: false)
        validateButton.addTarget(self, action: #selector(validateTapped), for: .touchUpInside)

        let quickTitle = label("Valores rapidos", style: .subheadline, color: DogBankTheme.muted, weight: .semibold)
        let quickGrid = UIStackView(arrangedSubviews: [10, 20, 50, 100].map { quickAmountButton($0) })
        quickGrid.axis = .horizontal
        quickGrid.spacing = 8
        quickGrid.distribution = .fillEqually

        let savedKeysCarousel = makeSavedPixKeysCarousel()

        stack.addArrangedSubview(card([
            label("Para quem voce quer enviar?", style: .headline, weight: .semibold),
            keyField,
            label("Chaves PIX salvas", style: .subheadline, color: DogBankTheme.muted, weight: .semibold),
            savedKeysCarousel,
            validateButton,
            receiverLabel,
            label("Quanto voce quer enviar?", style: .headline, weight: .semibold),
            amountField,
            quickTitle,
            quickGrid,
            label("Descricao", style: .headline, weight: .semibold),
            descriptionField,
            submitButton,
            statusLabel
        ], spacing: 14))

        stack.addArrangedSubview(card([
            InfoRowView(icon: "lock.shield", title: "Transferencia segura", value: "A senha sera solicitada na proxima etapa antes de concluir o PIX.", tint: DogBankTheme.amber)
        ]))
    }

    private func makeSavedPixKeysCarousel() -> UIView {
        let scroll = UIScrollView()
        scroll.showsHorizontalScrollIndicator = false
        scroll.alwaysBounceHorizontal = true
        scroll.delaysContentTouches = false
        scroll.translatesAutoresizingMaskIntoConstraints = false

        let row = UIStackView(arrangedSubviews: savedPixKeys.enumerated().map { index, contact in
            savedPixKeyButton(index: index, contact: contact)
        })
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 10
        row.translatesAutoresizingMaskIntoConstraints = false

        scroll.addSubview(row)

        NSLayoutConstraint.activate([
            scroll.heightAnchor.constraint(equalToConstant: 82),
            row.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            row.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            row.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            row.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            row.heightAnchor.constraint(equalTo: scroll.frameLayoutGuide.heightAnchor)
        ])

        return scroll
    }

    private func quickAmountButton(_ value: Int) -> UIButton {
        var configuration = UIButton.Configuration.tinted()
        configuration.title = "R$ \(value)"
        configuration.baseForegroundColor = DogBankTheme.purple
        configuration.baseBackgroundColor = DogBankTheme.purple.withAlphaComponent(0.10)
        configuration.cornerStyle = .medium
        let button = UIButton(configuration: configuration)
        button.tag = value
        button.addTarget(self, action: #selector(quickAmountTapped(_:)), for: .touchUpInside)
        button.heightAnchor.constraint(equalToConstant: 44).isActive = true
        return button
    }

    private func savedPixKeyButton(index: Int, contact: SavedPixKey) -> UIButton {
        var configuration = UIButton.Configuration.tinted()
        configuration.title = contact.name
        configuration.subtitle = contact.key
        configuration.image = UIImage(systemName: "person.crop.circle.badge.checkmark")
        configuration.imagePadding = 8
        configuration.titleAlignment = .leading
        configuration.baseForegroundColor = DogBankTheme.purple
        configuration.baseBackgroundColor = DogBankTheme.purple.withAlphaComponent(0.08)
        configuration.cornerStyle = .medium
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 10, leading: 10, bottom: 10, trailing: 10)

        let button = UIButton(configuration: configuration)
        button.tag = index
        button.contentHorizontalAlignment = .leading
        button.addTarget(self, action: #selector(savedPixKeyTapped(_:)), for: .touchUpInside)
        button.widthAnchor.constraint(equalToConstant: 224).isActive = true
        button.heightAnchor.constraint(equalToConstant: 72).isActive = true
        return button
    }

    private func refreshAccount() {
        Task {
            do {
                let account = try await api.fetchAccount(cpf: session.cpf)
                await MainActor.run {
                    self.account = account
                    self.balanceLabel.text = money(account.balance)
                    self.accountLabel.text = "Conta \(account.accountNumber) | \(account.bank)"
                }
            } catch {
                dogbankError(error, attributes: ["flow": "pix_account_load"])
            }
        }
    }

    @objc private func quickAmountTapped(_ sender: UIButton) {
        amountField.text = "\(sender.tag)"
        statusLabel.text = ""
        dogbankTrack("dogbank.native.pix.quick_amount_selected", attributes: ["amount": sender.tag])
    }

    @objc private func savedPixKeyTapped(_ sender: UIButton) {
        guard savedPixKeys.indices.contains(sender.tag) else {
            return
        }

        let contact = savedPixKeys[sender.tag]
        keyField.text = contact.key
        amountField.text = String(format: "%.2f", contact.defaultAmount).replacingOccurrences(of: ".", with: ",")
        descriptionField.text = contact.description
        validation = nil
        receiverLabel.text = "Chave salva selecionada. Validando \(contact.name)..."
        receiverLabel.textColor = DogBankTheme.muted
        statusLabel.text = ""

        dogbankTrack("dogbank.native.pix.saved_key_selected", attributes: [
            "receiver_name": contact.name,
            "pix_key": contact.key,
            "default_amount": contact.defaultAmount
        ])
        validatePixKey()
    }

    @objc private func validateTapped() {
        validatePixKey()
    }

    @objc private func submitTapped() {
        view.endEditing(true)
        guard validateAmount() else {
            return
        }
        validatePixKey(then: true)
    }

    private func parseAmount() -> Double {
        let raw = amountField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let normalized: String
        if raw.contains(",") {
            normalized = raw.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: ".")
        } else {
            normalized = raw
        }
        return Double(normalized) ?? 0
    }

    private func validateAmount() -> Bool {
        let amount = parseAmount()
        guard amount > 0 else {
            statusLabel.textColor = DogBankTheme.red
            statusLabel.text = "Digite um valor valido e maior que zero."
            return false
        }
        if let account, amount > account.balance {
            statusLabel.textColor = DogBankTheme.red
            statusLabel.text = "Saldo insuficiente para esta transferencia."
            return false
        }
        statusLabel.text = ""
        return true
    }

    private func validatePixKey(then continueAfterValidation: Bool = false) {
        let pixKey = keyField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !pixKey.isEmpty else {
            statusLabel.textColor = DogBankTheme.red
            statusLabel.text = "Informe uma chave PIX."
            return
        }

        submitButton.isEnabled = false
        statusLabel.textColor = DogBankTheme.purple
        statusLabel.text = "Validando chave PIX..."
        dogbankTrack("dogbank.native.pix.validation.started", attributes: ["pix_key_type": pixKey.contains("@") ? "email" : "other"])

        Task {
            do {
                let result = try await api.validatePixKey(pixKey)
                dogbankTrack("dogbank.native.pix.validation.completed", attributes: [
                    "valid": result.valid,
                    "receiver_name": result.receiverName ?? ""
                ])

                await MainActor.run {
                    self.submitButton.isEnabled = true
                    self.validation = result
                    if result.valid {
                        self.receiverLabel.text = "Destinatario: \(result.receiverName ?? "Cliente DogBank") | \(result.receiverBank ?? "DogBank")"
                        self.receiverLabel.textColor = DogBankTheme.green
                        self.statusLabel.textColor = DogBankTheme.green
                        self.statusLabel.text = "Chave PIX valida."
                        if continueAfterValidation {
                            self.openConfirmation(validation: result)
                        }
                    } else {
                        self.receiverLabel.text = result.message ?? "Chave PIX invalida."
                        self.receiverLabel.textColor = DogBankTheme.red
                        self.statusLabel.textColor = DogBankTheme.red
                        self.statusLabel.text = "Nao encontramos essa chave PIX."
                    }
                }
            } catch {
                dogbankError(error, attributes: ["flow": "pix_validation"])
                dogbankTrack("dogbank.native.pix.validation.failed", attributes: ["error": error.localizedDescription])
                await MainActor.run {
                    self.submitButton.isEnabled = true
                    self.receiverLabel.textColor = DogBankTheme.red
                    self.statusLabel.textColor = DogBankTheme.red
                    self.statusLabel.text = "Nao foi possivel validar a chave agora. Tente novamente mais tarde."
                }
            }
        }
    }

    private func openConfirmation(validation: DogBankPixValidation) {
        let draft = DogBankPixDraft(
            pixKey: keyField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
            amount: parseAmount(),
            description: descriptionField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
            receiverName: validation.receiverName,
            receiverBank: validation.receiverBank,
            sourceAccountID: session.accountID
        )
        dogbankTrack("dogbank.native.pix.confirmation_opened", attributes: [
            "amount": draft.amount,
            "source_account_id": draft.sourceAccountID,
            "receiver_name": draft.receiverName ?? ""
        ])
        navigationController?.pushViewController(PixConfirmationViewController(session: session, api: api, draft: draft), animated: true)
    }
}

private final class PixConfirmationViewController: UIViewController {
    private let session: DogBankSession
    private let api: DogBankAPI
    private let draft: DogBankPixDraft
    private let passwordField = DogBankTextField(placeholder: "Senha de 6 digitos", systemImage: "lock", secure: true, keyboard: .numberPad)
    private let submitButton = DogBankButton(title: "Confirmar PIX", systemImage: "checkmark.shield.fill")
    private let statusLabel = label("", style: .footnote, color: DogBankTheme.muted, lines: 0)
    private let scrollView = UIScrollView()
    private let contentStack = UIStackView()
    private let footerView = UIView()
    private let footerStack = UIStackView()
    private var overlay: PixProcessingOverlay?

    init(session: DogBankSession, api: DogBankAPI, draft: DogBankPixDraft) {
        self.session = session
        self.api = api
        self.draft = draft
        super.init(nibName: nil, bundle: nil)
        title = "Confirmar PIX"
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = DogBankTheme.background
        configureLayout()
        submitButton.addTarget(self, action: #selector(confirmTapped), for: .touchUpInside)
    }

    private func configureLayout() {
        scrollView.alwaysBounceVertical = true
        scrollView.keyboardDismissMode = .interactive
        scrollView.contentInset.bottom = 18
        scrollView.delaysContentTouches = false
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        contentStack.axis = .vertical
        contentStack.spacing = 14
        contentStack.translatesAutoresizingMaskIntoConstraints = false

        footerView.backgroundColor = DogBankTheme.background.withAlphaComponent(0.97)
        footerView.translatesAutoresizingMaskIntoConstraints = false

        footerStack.axis = .vertical
        footerStack.spacing = 8
        footerStack.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.textAlignment = .center

        view.addSubview(scrollView)
        view.addSubview(footerView)
        scrollView.addSubview(contentStack)
        footerView.addSubview(footerStack)

        footerStack.addArrangedSubview(label("A transferencia e irreversivel apos a confirmacao.", style: .footnote, color: DogBankTheme.muted, lines: 0))
        footerStack.addArrangedSubview(statusLabel)
        footerStack.addArrangedSubview(submitButton)

        let footerBottomConstraint: NSLayoutConstraint
        if #available(iOS 15.0, *) {
            footerBottomConstraint = footerView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor)
        } else {
            footerBottomConstraint = footerView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        }

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: footerView.topAnchor),

            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 14),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 20),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -20),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -18),

            footerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            footerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            footerBottomConstraint,

            footerStack.topAnchor.constraint(equalTo: footerView.topAnchor, constant: 10),
            footerStack.leadingAnchor.constraint(equalTo: footerView.leadingAnchor, constant: 20),
            footerStack.trailingAnchor.constraint(equalTo: footerView.trailingAnchor, constant: -20),
            footerStack.bottomAnchor.constraint(equalTo: footerView.safeAreaLayoutGuide.bottomAnchor, constant: -10)
        ])

        contentStack.addArrangedSubview(label("Confirmar PIX", style: .title1, weight: .bold))
        contentStack.addArrangedSubview(label("Revise os dados e confirme com sua senha bancaria.", style: .subheadline, color: DogBankTheme.muted, lines: 0))
        contentStack.addArrangedSubview(makeCompactSummaryCard())
        contentStack.addArrangedSubview(card([
            label("Senha bancaria", style: .headline, weight: .semibold),
            passwordField
        ], spacing: 10))
    }

    private func makeCompactSummaryCard() -> UIView {
        let receiver = draft.receiverName ?? draft.pixKey
        let bank = draft.receiverBank ?? "DogBank"
        let description = draft.description.isEmpty ? "PIX DogBank" : draft.description
        let rows = [
            compactSummaryRow(title: "Valor", value: money(draft.amount), tint: DogBankTheme.purple, weight: .bold),
            compactSummaryRow(title: "Para", value: receiver, tint: DogBankTheme.green),
            compactSummaryRow(title: "Banco", value: bank, tint: DogBankTheme.blue),
            compactSummaryRow(title: "Chave", value: draft.pixKey, tint: DogBankTheme.amber),
            compactSummaryRow(title: "Descricao", value: description, tint: DogBankTheme.muted)
        ]

        return card(rows, spacing: 10)
    }

    private func compactSummaryRow(title: String, value: String, tint: UIColor, weight: UIFont.Weight = .semibold) -> UIView {
        let dot = UIView()
        dot.backgroundColor = tint.withAlphaComponent(0.18)
        dot.layer.cornerRadius = 6
        dot.translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = label(title, style: .caption1, color: DogBankTheme.muted, weight: .semibold, lines: 1)
        let valueLabel = label(value, style: .subheadline, color: DogBankTheme.ink, weight: weight, lines: 1)
        valueLabel.adjustsFontSizeToFitWidth = true
        valueLabel.minimumScaleFactor = 0.78
        valueLabel.textAlignment = .right

        let row = UIStackView(arrangedSubviews: [dot, titleLabel, valueLabel])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 8

        titleLabel.setContentHuggingPriority(.required, for: .horizontal)
        valueLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        NSLayoutConstraint.activate([
            dot.widthAnchor.constraint(equalToConstant: 12),
            dot.heightAnchor.constraint(equalToConstant: 12)
        ])

        return row
    }

    @objc private func confirmTapped() {
        let password = passwordField.text ?? ""
        guard password.count >= 6 else {
            statusLabel.textColor = DogBankTheme.red
            statusLabel.text = "Informe sua senha de 6 digitos."
            return
        }

        view.endEditing(true)
        submitButton.isEnabled = false
        statusLabel.text = ""
        dogbankTrack("dogbank.native.pix.transfer.started", attributes: [
            "amount": draft.amount,
            "source_account_id": draft.sourceAccountID,
            "pix_key_type": draft.pixKey.contains("@") ? "email" : "other"
        ])

        let overlay = PixProcessingOverlay()
        self.overlay = overlay
        overlay.show(on: view)

        Task {
            for second in stride(from: 3, through: 1, by: -1) {
                await MainActor.run {
                    overlay.update(
                        message: second == 3 ? "Validando senha e chave PIX..." : (second == 2 ? "Consultando Banco Central..." : "Finalizando transferencia..."),
                        counter: second,
                        activeStep: 3 - second
                    )
                }
                try? await Task.sleep(nanoseconds: 850_000_000)
            }

            do {
                let receipt = try await api.executePix(
                    session: session,
                    pixKey: draft.pixKey,
                    amount: draft.amount,
                    description: draft.description.isEmpty ? "PIX DogBank" : draft.description,
                    password: password
                )
                dogbankTrack("dogbank.native.pix.transfer.completed", attributes: [
                    "amount": draft.amount,
                    "source_account_id": draft.sourceAccountID,
                    "transaction_id": receipt.id ?? 0
                ])
                await MainActor.run {
                    overlay.update(message: "PIX concluido. Gerando comprovante...", counter: nil, activeStep: 2)
                }
                try? await Task.sleep(nanoseconds: 350_000_000)
                await MainActor.run {
                    overlay.dismiss()
                    self.submitButton.isEnabled = true
                    self.navigationController?.pushViewController(ReceiptViewController(receipt: receipt, session: self.session), animated: true)
                }
            } catch {
                let isSPITimeout = draft.amount == 100.0
                dogbankError(error, attributes: [
                    "flow": "pix_transfer",
                    "amount": draft.amount,
                    "error_code": isSPITimeout ? "PIX-TIMEOUT" : "PIX_TRANSFER_ERROR",
                    "error_source": isSPITimeout ? "banco_central_spi" : "transaction_service",
                    "spi_error": isSPITimeout,
                    "spi_component": isSPITimeout ? "banco_central" : ""
                ])
                dogbankTrack("dogbank.native.pix.transfer.failed", attributes: [
                    "amount": draft.amount,
                    "error": error.localizedDescription,
                    "error_code": isSPITimeout ? "PIX-TIMEOUT" : "PIX_TRANSFER_ERROR",
                    "spi_error": isSPITimeout
                ])
                await MainActor.run {
                    overlay.dismiss()
                    self.submitButton.isEnabled = true
                    self.presentPixError(error, isSPITimeout: isSPITimeout)
                }
            }
        }
    }

    private func presentPixError(_ error: Error, isSPITimeout: Bool = false) {
        let modal = PixErrorViewController(
            title: "PIX nao realizado",
            message: "Nao foi possivel concluir a transferencia. Tente novamente mais tarde."
        )
        modal.onRetry = { [weak self] in
            self?.passwordField.text = ""
            self?.statusLabel.textColor = DogBankTheme.muted
            self?.statusLabel.text = "Digite a senha novamente para tentar."
        }
        modal.onDashboard = { [weak self] in
            self?.goToDashboard()
        }
        present(modal, animated: true)
    }

    private func goToDashboard() {
        let tabBar = tabBarController
        navigationController?.popToRootViewController(animated: false)
        tabBar?.selectedIndex = 0
    }
}

private final class ReceiptViewController: UIViewController {
    private let receipt: DogBankPixReceipt
    private let session: DogBankSession
    private let successIcon = UIImageView(image: UIImage(systemName: "checkmark.circle.fill"))

    init(receipt: DogBankPixReceipt, session: DogBankSession) {
        self.receipt = receipt
        self.session = session
        super.init(nibName: nil, bundle: nil)
        title = "Comprovante"
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = DogBankTheme.background
        configureLayout()
        dogbankTrack("dogbank.native.pix.receipt.viewed", attributes: [
            "amount": receipt.amount,
            "transaction_id": receipt.id ?? 0
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        animateSuccess()
        emitConfetti()
    }

    private func configureLayout() {
        let (_, stack) = makeScrollStack(in: view)
        stack.addArrangedSubview(makeSuccessHeader())
        stack.addArrangedSubview(makeReceiptCard())

        let another = DogBankButton(title: "Fazer outro PIX", systemImage: "bolt.fill")
        another.addTarget(self, action: #selector(newPixTapped), for: .touchUpInside)
        let share = DogBankButton(title: "Compartilhar", systemImage: "square.and.arrow.up", filled: false)
        share.addTarget(self, action: #selector(shareTapped), for: .touchUpInside)
        let home = DogBankButton(title: "Voltar ao inicio", systemImage: "house.fill", filled: false)
        home.addTarget(self, action: #selector(homeTapped), for: .touchUpInside)

        stack.addArrangedSubview(card([another, share, home], spacing: 10))
    }

    private func makeSuccessHeader() -> UIView {
        successIcon.tintColor = .white
        successIcon.contentMode = .center
        successIcon.translatesAutoresizingMaskIntoConstraints = false

        let iconHost = UIView()
        iconHost.backgroundColor = UIColor.white.withAlphaComponent(0.20)
        iconHost.layer.cornerRadius = 32
        iconHost.translatesAutoresizingMaskIntoConstraints = false
        iconHost.addSubview(successIcon)

        let title = label("PIX Concluido!", style: .title1, color: .white, weight: .bold)
        let subtitle = label("Sua transferencia foi realizada com sucesso.", style: .subheadline, color: UIColor.white.withAlphaComponent(0.86), lines: 0)
        let amount = label(money(receipt.amount), style: .title2, color: .white, weight: .bold)

        let textStack = UIStackView(arrangedSubviews: [title, subtitle, amount])
        textStack.axis = .vertical
        textStack.spacing = 5

        let row = UIStackView(arrangedSubviews: [iconHost, textStack])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 14
        row.translatesAutoresizingMaskIntoConstraints = false

        let header = UIView()
        header.backgroundColor = DogBankTheme.green
        header.layer.cornerRadius = 20
        header.addSubview(row)

        NSLayoutConstraint.activate([
            iconHost.widthAnchor.constraint(equalToConstant: 64),
            iconHost.heightAnchor.constraint(equalToConstant: 64),
            successIcon.centerXAnchor.constraint(equalTo: iconHost.centerXAnchor),
            successIcon.centerYAnchor.constraint(equalTo: iconHost.centerYAnchor),
            successIcon.widthAnchor.constraint(equalToConstant: 38),
            successIcon.heightAnchor.constraint(equalToConstant: 38),
            row.topAnchor.constraint(equalTo: header.topAnchor, constant: 20),
            row.leadingAnchor.constraint(equalTo: header.leadingAnchor, constant: 18),
            row.trailingAnchor.constraint(equalTo: header.trailingAnchor, constant: -18),
            row.bottomAnchor.constraint(equalTo: header.bottomAnchor, constant: -20)
        ])
        return header
    }

    private func makeReceiptCard() -> UIView {
        let completedAt = receipt.completedAt ?? Date()
        let authCode = "DB-\(receipt.id ?? 0)-\(Int(completedAt.timeIntervalSince1970))"
        let destination = receipt.receiverName ?? receipt.pixKeyDestination
        let bank = receipt.receiverBank ?? "DogBank"

        let header = UIStackView(arrangedSubviews: [
            label("DogBank", style: .title2, color: .white, weight: .bold),
            label("Comprovante PIX", style: .subheadline, color: UIColor.white.withAlphaComponent(0.82), weight: .semibold)
        ])
        header.axis = .vertical
        header.spacing = 4
        header.translatesAutoresizingMaskIntoConstraints = false

        let purpleHeader = UIView()
        purpleHeader.backgroundColor = DogBankTheme.purple
        purpleHeader.layer.cornerRadius = 16
        purpleHeader.addSubview(header)
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: purpleHeader.topAnchor, constant: 18),
            header.leadingAnchor.constraint(equalTo: purpleHeader.leadingAnchor, constant: 18),
            header.trailingAnchor.constraint(equalTo: purpleHeader.trailingAnchor, constant: -18),
            header.bottomAnchor.constraint(equalTo: purpleHeader.bottomAnchor, constant: -18)
        ])

        let valueCard = UIView()
        valueCard.backgroundColor = DogBankTheme.green.withAlphaComponent(0.10)
        valueCard.layer.cornerRadius = 14
        let valueStack = UIStackView(arrangedSubviews: [
            label("Valor da transferencia", style: .caption1, color: DogBankTheme.green, weight: .semibold),
            label(money(receipt.amount), style: .largeTitle, color: DogBankTheme.green, weight: .bold)
        ])
        valueStack.axis = .vertical
        valueStack.spacing = 4
        valueStack.translatesAutoresizingMaskIntoConstraints = false
        valueCard.addSubview(valueStack)
        NSLayoutConstraint.activate([
            valueStack.topAnchor.constraint(equalTo: valueCard.topAnchor, constant: 16),
            valueStack.leadingAnchor.constraint(equalTo: valueCard.leadingAnchor, constant: 16),
            valueStack.trailingAnchor.constraint(equalTo: valueCard.trailingAnchor, constant: -16),
            valueStack.bottomAnchor.constraint(equalTo: valueCard.bottomAnchor, constant: -16)
        ])

        let rows = [
            makeKeyValueRow(title: "De", value: session.name),
            makeKeyValueRow(title: "Conta origem", value: "\(session.accountID) | DOG BANK"),
            makeKeyValueRow(title: "Para", value: destination),
            makeKeyValueRow(title: "Banco destino", value: bank),
            makeKeyValueRow(title: "Chave PIX", value: receipt.pixKeyDestination, mono: true),
            makeKeyValueRow(title: "Autenticacao", value: authCode, valueColor: DogBankTheme.purple, mono: true),
            makeKeyValueRow(title: "Transacao", value: "\(receipt.id ?? 0)", mono: true),
            makeKeyValueRow(title: "Data", value: dateFormatter.string(from: completedAt)),
            makeKeyValueRow(title: "Descricao", value: receipt.description)
        ]

        return card([purpleHeader, valueCard] + rows, spacing: 14)
    }

    private func animateSuccess() {
        successIcon.transform = CGAffineTransform(scaleX: 0.6, y: 0.6)
        successIcon.alpha = 0.2
        UIView.animate(withDuration: 0.45, delay: 0, usingSpringWithDamping: 0.58, initialSpringVelocity: 0.8, options: [], animations: {
            self.successIcon.transform = .identity
            self.successIcon.alpha = 1
        }, completion: nil)
    }

    private func emitConfetti() {
        guard view.subviews.filter({ $0.tag == 9191 }).isEmpty else {
            return
        }
        let colors = [DogBankTheme.green, DogBankTheme.purple, DogBankTheme.amber, DogBankTheme.blue]
        let maxX = max(21, view.bounds.width - 30)
        for index in 0..<24 {
            let piece = UIView(frame: CGRect(x: CGFloat.random(in: 20...maxX), y: -12, width: 7, height: 11))
            piece.tag = 9191
            piece.backgroundColor = colors[index % colors.count]
            piece.layer.cornerRadius = 2
            view.addSubview(piece)
            UIView.animate(withDuration: Double.random(in: 1.6...2.5), delay: Double(index) * 0.025, options: [.curveEaseIn], animations: {
                piece.frame.origin.y = self.view.bounds.height + 20
                piece.transform = CGAffineTransform(rotationAngle: CGFloat.random(in: 1...7))
                piece.alpha = 0.2
            }, completion: { _ in
                piece.removeFromSuperview()
            })
        }
    }

    private func shareText() -> String {
        let completedAt = receipt.completedAt ?? Date()
        return """
        Comprovante PIX DogBank
        Valor: \(money(receipt.amount))
        Para: \(receipt.receiverName ?? receipt.pixKeyDestination)
        Data: \(dateFormatter.string(from: completedAt))
        Transacao: \(receipt.id ?? 0)
        """
    }

    @objc private func newPixTapped() {
        if let root = navigationController?.viewControllers.first as? PixViewController {
            root.resetForm()
        }
        navigationController?.popToRootViewController(animated: true)
    }

    @objc private func homeTapped() {
        let tabBar = tabBarController
        navigationController?.popToRootViewController(animated: false)
        tabBar?.selectedIndex = 0
    }

    @objc private func shareTapped() {
        dogbankTrack("dogbank.native.pix.receipt.share_clicked", attributes: [
            "amount": receipt.amount,
            "transaction_id": receipt.id ?? 0
        ])
        let activity = UIActivityViewController(activityItems: [shareText()], applicationActivities: nil)
        present(activity, animated: true)
    }
}

private final class HistoryViewController: UIViewController {
    private let session: DogBankSession
    private let api: DogBankAPI
    private let transactionsStack = UIStackView()
    private let statusLabel = label("", style: .footnote, color: DogBankTheme.muted, lines: 0)

    init(session: DogBankSession, api: DogBankAPI) {
        self.session = session
        self.api = api
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = DogBankTheme.background
        let (_, stack) = makeScrollStack(in: view)
        stack.addArrangedSubview(label("Extrato", style: .largeTitle, weight: .bold))
        stack.addArrangedSubview(label("Historico carregado direto de /api/transactions.", style: .body, color: DogBankTheme.muted, lines: 0))
        transactionsStack.axis = .vertical
        transactionsStack.spacing = 10
        stack.addArrangedSubview(card([transactionsStack, statusLabel]))
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        refresh()
    }

    private func refresh() {
        statusLabel.text = "Atualizando extrato..."
        Task {
            do {
                let transactions = try await api.fetchTransactions(accountID: session.accountID)
                dogbankTrack("dogbank.native.history.loaded", attributes: ["transaction_count": transactions.count])
                await MainActor.run {
                    self.transactionsStack.arrangedSubviews.forEach { view in
                        self.transactionsStack.removeArrangedSubview(view)
                        view.removeFromSuperview()
                    }
                    for tx in transactions.prefix(20) {
                        self.transactionsStack.addArrangedSubview(TransactionRow(transaction: tx, accountID: self.session.accountID))
                    }
                    self.statusLabel.text = transactions.isEmpty ? "Nenhuma transacao encontrada." : ""
                }
            } catch {
                dogbankError(error, attributes: ["flow": "history"])
                await MainActor.run {
                    self.statusLabel.text = error.localizedDescription
                }
            }
        }
    }
}

private final class CreditCardFaceView: UIView {
    private let gradient = CAGradientLayer()
    private let numberLabel = label("**** **** **** 1234", style: .title2, color: .white, weight: .semibold)
    private let holder: String

    var showsDetails = false {
        didSet {
            updateDetails()
        }
    }

    init(holder: String) {
        self.holder = holder
        super.init(frame: .zero)
        configure()
        updateDetails()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        gradient.frame = bounds
    }

    private func configure() {
        layer.cornerRadius = 22
        layer.masksToBounds = true
        heightAnchor.constraint(equalToConstant: 218).isActive = true

        gradient.colors = [
            UIColor(red: 0.40, green: 0.49, blue: 0.92, alpha: 1).cgColor,
            DogBankTheme.purple.cgColor,
            DogBankTheme.purpleDark.cgColor
        ]
        gradient.startPoint = CGPoint(x: 0, y: 0)
        gradient.endPoint = CGPoint(x: 1, y: 1)
        layer.insertSublayer(gradient, at: 0)

        let bank = label("DogBank", style: .title3, color: .white, weight: .bold)
        let brand = label("Mastercard", style: .subheadline, color: UIColor.white.withAlphaComponent(0.82), weight: .semibold)
        brand.textAlignment = .right

        let top = UIStackView(arrangedSubviews: [bank, UIView(), brand])
        top.axis = .horizontal
        top.alignment = .center
        top.spacing = 10

        let chip = UIView()
        chip.backgroundColor = UIColor(red: 0.96, green: 0.78, blue: 0.34, alpha: 1)
        chip.layer.cornerRadius = 8
        chip.widthAnchor.constraint(equalToConstant: 54).isActive = true
        chip.heightAnchor.constraint(equalToConstant: 36).isActive = true

        numberLabel.font = .monospacedSystemFont(ofSize: numberLabel.font.pointSize, weight: .semibold)
        numberLabel.adjustsFontSizeToFitWidth = true
        numberLabel.minimumScaleFactor = 0.76

        let holderTitle = label("PORTADOR", style: .caption2, color: UIColor.white.withAlphaComponent(0.68), weight: .semibold)
        let holderValue = label(holder, style: .caption1, color: .white, weight: .semibold, lines: 1)
        holderValue.adjustsFontSizeToFitWidth = true
        holderValue.minimumScaleFactor = 0.72
        let holderStack = UIStackView(arrangedSubviews: [holderTitle, holderValue])
        holderStack.axis = .vertical
        holderStack.spacing = 3

        let expiryTitle = label("VALIDO ATE", style: .caption2, color: UIColor.white.withAlphaComponent(0.68), weight: .semibold)
        let expiryValue = label("12/28", style: .caption1, color: .white, weight: .semibold)
        expiryValue.textAlignment = .right
        let expiryStack = UIStackView(arrangedSubviews: [expiryTitle, expiryValue])
        expiryStack.axis = .vertical
        expiryStack.spacing = 3

        let bottom = UIStackView(arrangedSubviews: [holderStack, expiryStack])
        bottom.axis = .horizontal
        bottom.alignment = .bottom
        bottom.distribution = .equalSpacing

        let content = UIStackView(arrangedSubviews: [top, chip, numberLabel, bottom])
        content.axis = .vertical
        content.spacing = 18
        content.translatesAutoresizingMaskIntoConstraints = false
        addSubview(content)

        NSLayoutConstraint.activate([
            content.topAnchor.constraint(equalTo: topAnchor, constant: 22),
            content.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 22),
            content.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -22),
            content.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -22)
        ])
    }

    private func updateDetails() {
        numberLabel.text = showsDetails ? "5555 1234 5678 1234" : "**** **** **** 1234"
    }
}

private final class CardsViewController: UIViewController {
    private struct CardPurchase {
        let description: String
        let amount: Double
        let date: String
        let category: String
        let installments: String
    }

    private let session: DogBankSession
    private let detailsButton = DogBankButton(title: "Ver dados do cartao", systemImage: "eye", filled: false)
    private let cvvInfo = InfoRowView(icon: "number", title: "CVV", value: "123", tint: DogBankTheme.purple)
    private let actionStatusLabel = label("", style: .footnote, color: DogBankTheme.muted, lines: 0)
    private lazy var cardFace = CreditCardFaceView(holder: session.name.uppercased())
    private var showCardDetails = false

    private let limit = 5000.00
    private let availableLimit = 3250.00
    private let usedLimit = 1750.00
    private let invoiceAmount = 1750.00
    private let purchases = [
        CardPurchase(description: "Amazon.com", amount: 89.90, date: "20/05/2025", category: "Compras Online", installments: "1x"),
        CardPurchase(description: "Uber", amount: 25.50, date: "19/05/2025", category: "Transporte", installments: "1x"),
        CardPurchase(description: "Mercado Livre", amount: 156.70, date: "18/05/2025", category: "Compras Online", installments: "3x"),
        CardPurchase(description: "Netflix", amount: 45.90, date: "15/05/2025", category: "Streaming", installments: "1x")
    ]

    init(session: DogBankSession) {
        self.session = session
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = DogBankTheme.background
        configureLayout()
        detailsButton.addTarget(self, action: #selector(toggleDetails), for: .touchUpInside)
        cvvInfo.isHidden = true
        dogbankTrack("dogbank.native.cards.viewed", attributes: [
            "available_limit": availableLimit,
            "used_limit": usedLimit,
            "invoice_amount": invoiceAmount
        ])
    }

    private func configureLayout() {
        let (_, stack) = makeScrollStack(in: view)
        stack.addArrangedSubview(label("Meus Cartoes", style: .largeTitle, weight: .bold))
        stack.addArrangedSubview(label("Gerencie seus cartoes de credito com os mesmos controles da demo web.", style: .body, color: DogBankTheme.muted, lines: 0))

        stack.addArrangedSubview(card([cardFace, detailsButton, cvvInfo], spacing: 14))
        stack.addArrangedSubview(makeLimitCard())
        stack.addArrangedSubview(makeInvoiceCard())
        stack.addArrangedSubview(makeQuickActionsCard())
        stack.addArrangedSubview(makeTransactionsCard())
    }

    private func makeLimitCard() -> UIView {
        let usage = usedLimit / limit
        let title = label("Limite Disponivel", style: .headline, weight: .semibold)
        let available = label(money(availableLimit), style: .title1, color: DogBankTheme.purple, weight: .bold)
        let total = label("de \(money(limit)) total", style: .subheadline, color: DogBankTheme.muted)

        let usageLabel = label("Usado: \(money(usedLimit))", style: .caption1, color: DogBankTheme.muted, weight: .semibold)
        let percentText = String(format: "%.1f%%", usage * 100).replacingOccurrences(of: ".", with: ",")
        let percent = label(percentText, style: .caption1, color: DogBankTheme.muted, weight: .semibold)
        percent.textAlignment = .right

        let footer = UIStackView(arrangedSubviews: [usageLabel, percent])
        footer.axis = .horizontal
        footer.distribution = .equalSpacing

        return card([title, available, total, ProgressBarView(progress: CGFloat(usage), tint: DogBankTheme.purple), footer], spacing: 12)
    }

    private func makeInvoiceCard() -> UIView {
        let title = label("Fatura Atual", style: .headline, weight: .semibold)
        let amount = label(money(invoiceAmount), style: .title1, color: DogBankTheme.red, weight: .bold)
        let dueDate = label("Vencimento: 15/06/2025", style: .subheadline, color: DogBankTheme.muted)
        let status = makePill(text: "Aberta", tint: DogBankTheme.amber)

        let pay = DogBankButton(title: "Pagar Fatura", systemImage: "checkmark.circle.fill")
        pay.accessibilityIdentifier = "pay_invoice"
        pay.addTarget(self, action: #selector(cardActionTapped(_:)), for: .touchUpInside)
        let details = DogBankButton(title: "Ver fatura completa", systemImage: "doc.text", filled: false)
        details.accessibilityIdentifier = "invoice_details"
        details.addTarget(self, action: #selector(cardActionTapped(_:)), for: .touchUpInside)

        return card([title, amount, dueDate, status, pay, details], spacing: 12)
    }

    private func makeQuickActionsCard() -> UIView {
        let row1 = UIStackView(arrangedSubviews: [
            quickAction(title: "Bloquear", icon: "lock.fill", action: "block_card"),
            quickAction(title: "2a Via", icon: "iphone.gen2", action: "second_copy")
        ])
        row1.axis = .horizontal
        row1.spacing = 10
        row1.distribution = .fillEqually

        let row2 = UIStackView(arrangedSubviews: [
            quickAction(title: "Limite", icon: "chart.bar.fill", action: "limit_settings"),
            quickAction(title: "Configurar", icon: "gearshape.fill", action: "card_settings")
        ])
        row2.axis = .horizontal
        row2.spacing = 10
        row2.distribution = .fillEqually

        return card([label("Acoes Rapidas", style: .headline, weight: .semibold), row1, row2, actionStatusLabel], spacing: 12)
    }

    private func makeTransactionsCard() -> UIView {
        let title = label("Ultimas Compras", style: .headline, weight: .semibold)
        let viewAll = DogBankButton(title: "Ver todas", systemImage: "list.bullet", filled: false)
        viewAll.accessibilityIdentifier = "view_all_card_transactions"
        viewAll.addTarget(self, action: #selector(cardActionTapped(_:)), for: .touchUpInside)

        let header = UIStackView(arrangedSubviews: [title, viewAll])
        header.axis = .horizontal
        header.spacing = 12
        header.alignment = .center
        title.setContentHuggingPriority(.defaultLow, for: .horizontal)
        viewAll.setContentHuggingPriority(.defaultHigh, for: .horizontal)

        let rows = purchases.map(transactionRow)
        return card([header] + rows, spacing: 12)
    }

    private func quickAction(title: String, icon: String, action: String) -> UIButton {
        var configuration = UIButton.Configuration.tinted()
        configuration.title = title
        configuration.image = UIImage(systemName: icon)
        configuration.imagePlacement = .top
        configuration.imagePadding = 6
        configuration.baseForegroundColor = DogBankTheme.purple
        configuration.baseBackgroundColor = DogBankTheme.purple.withAlphaComponent(0.10)
        configuration.cornerStyle = .medium

        let button = UIButton(configuration: configuration)
        button.accessibilityIdentifier = action
        button.addTarget(self, action: #selector(cardActionTapped(_:)), for: .touchUpInside)
        button.heightAnchor.constraint(equalToConstant: 76).isActive = true
        return button
    }

    private func transactionRow(_ purchase: CardPurchase) -> UIView {
        let initial = label(String(purchase.description.prefix(1)), style: .headline, color: DogBankTheme.purple, weight: .bold)
        initial.textAlignment = .center
        initial.backgroundColor = DogBankTheme.purple.withAlphaComponent(0.12)
        initial.layer.cornerRadius = 20
        initial.clipsToBounds = true
        initial.translatesAutoresizingMaskIntoConstraints = false

        let title = label(purchase.description, style: .subheadline, weight: .semibold, lines: 1)
        title.lineBreakMode = .byTruncatingTail
        let subtitle = label("\(purchase.date) | \(purchase.category)", style: .caption1, color: DogBankTheme.muted, lines: 1)
        subtitle.lineBreakMode = .byTruncatingTail
        let texts = UIStackView(arrangedSubviews: [title, subtitle])
        texts.axis = .vertical
        texts.spacing = 3
        texts.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        let amount = label("- \(money(purchase.amount))", style: .subheadline, color: DogBankTheme.red, weight: .bold)
        amount.textAlignment = .right
        amount.adjustsFontSizeToFitWidth = true
        amount.minimumScaleFactor = 0.78
        let installments = label(purchase.installments, style: .caption2, color: DogBankTheme.muted, weight: .semibold)
        installments.textAlignment = .right
        let right = UIStackView(arrangedSubviews: [amount, installments])
        right.axis = .vertical
        right.spacing = 3
        right.alignment = .trailing

        let rowStack = UIStackView(arrangedSubviews: [initial, texts, right])
        rowStack.axis = .horizontal
        rowStack.alignment = .center
        rowStack.spacing = 12
        rowStack.translatesAutoresizingMaskIntoConstraints = false

        let view = UIView()
        view.backgroundColor = UIColor(red: 0.97, green: 0.98, blue: 1.00, alpha: 1)
        view.layer.cornerRadius = 14
        view.addSubview(rowStack)

        NSLayoutConstraint.activate([
            initial.widthAnchor.constraint(equalToConstant: 40),
            initial.heightAnchor.constraint(equalToConstant: 40),
            right.widthAnchor.constraint(greaterThanOrEqualToConstant: 96),
            rowStack.topAnchor.constraint(equalTo: view.topAnchor, constant: 12),
            rowStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            rowStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            rowStack.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -12)
        ])

        return view
    }

    private func makePill(text: String, tint: UIColor) -> UIView {
        let pillLabel = label(text, style: .caption1, color: tint, weight: .bold)
        pillLabel.translatesAutoresizingMaskIntoConstraints = false

        let view = UIView()
        view.backgroundColor = tint.withAlphaComponent(0.16)
        view.layer.cornerRadius = 14
        view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(pillLabel)

        NSLayoutConstraint.activate([
            pillLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 7),
            pillLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            pillLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            pillLabel.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -7)
        ])
        return view
    }

    @objc private func toggleDetails() {
        showCardDetails.toggle()
        cardFace.showsDetails = showCardDetails
        cvvInfo.isHidden = !showCardDetails

        var configuration = detailsButton.configuration
        configuration?.title = showCardDetails ? "Ocultar dados" : "Ver dados do cartao"
        configuration?.image = UIImage(systemName: showCardDetails ? "eye.slash" : "eye")
        detailsButton.configuration = configuration

        dogbankTrack("dogbank.native.cards.details_toggled", attributes: ["visible": showCardDetails])
    }

    @objc private func cardActionTapped(_ sender: UIButton) {
        let action = sender.accessibilityIdentifier ?? "unknown"
        actionStatusLabel.textColor = DogBankTheme.purple
        actionStatusLabel.text = "Acao registrada para a demo: \(sender.configuration?.title ?? "Cartao")."
        dogbankTrack("dogbank.native.cards.action_tapped", attributes: ["action": action])
    }
}

private final class ProfileViewController: UIViewController {
    private let session: DogBankSession
    private let api: DogBankAPI
    private let accountStack = UIStackView()

    init(session: DogBankSession, api: DogBankAPI) {
        self.session = session
        self.api = api
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = DogBankTheme.background
        configureLayout()
        refresh()
    }

    private func configureLayout() {
        let (_, stack) = makeScrollStack(in: view)
        stack.addArrangedSubview(label("Meu Perfil", style: .largeTitle, weight: .bold))

        let avatar = label(String(session.name.prefix(1)), style: .largeTitle, color: DogBankTheme.purple, weight: .bold)
        avatar.textAlignment = .center
        avatar.backgroundColor = .white
        avatar.layer.cornerRadius = 36
        avatar.clipsToBounds = true
        avatar.widthAnchor.constraint(equalToConstant: 72).isActive = true
        avatar.heightAnchor.constraint(equalToConstant: 72).isActive = true

        let name = label(session.name, style: .title2, color: .white, weight: .bold)
        let cpf = label("CPF \(formatCPFForDemoReplay(session.cpf))", style: .subheadline, color: UIColor.white.withAlphaComponent(0.82))
        let identityStack = UIStackView(arrangedSubviews: [name, cpf])
        identityStack.axis = .vertical
        identityStack.spacing = 4

        let header = UIStackView(arrangedSubviews: [avatar, identityStack])
        header.axis = .horizontal
        header.alignment = .center
        header.spacing = 16

        let purpleCard = UIView()
        purpleCard.backgroundColor = DogBankTheme.purple
        purpleCard.layer.cornerRadius = 18
        header.translatesAutoresizingMaskIntoConstraints = false
        purpleCard.addSubview(header)
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: purpleCard.topAnchor, constant: 22),
            header.leadingAnchor.constraint(equalTo: purpleCard.leadingAnchor, constant: 22),
            header.trailingAnchor.constraint(equalTo: purpleCard.trailingAnchor, constant: -22),
            header.bottomAnchor.constraint(equalTo: purpleCard.bottomAnchor, constant: -22)
        ])

        accountStack.axis = .vertical
        accountStack.spacing = 12
        stack.addArrangedSubview(purpleCard)
        stack.addArrangedSubview(card([accountStack]))
    }

    private func refresh() {
        accountStack.arrangedSubviews.forEach { view in
            accountStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
        accountStack.addArrangedSubview(InfoRowView(icon: "key", title: "Chave PIX", value: session.pixKey, tint: DogBankTheme.purple))

        Task {
            do {
                let account = try await api.fetchAccount(cpf: session.cpf)
                await MainActor.run {
                    self.accountStack.addArrangedSubview(InfoRowView(icon: "creditcard", title: "Conta", value: account.accountNumber, tint: DogBankTheme.blue))
                    self.accountStack.addArrangedSubview(InfoRowView(icon: "building.columns", title: "Banco", value: account.bank, tint: DogBankTheme.green))
                    self.accountStack.addArrangedSubview(InfoRowView(icon: "brazilianrealsign.circle", title: "Saldo", value: money(account.balance), tint: DogBankTheme.amber))
                }
            } catch {
                dogbankError(error, attributes: ["flow": "profile"])
            }
        }
    }
}

private final class TransactionRow: UIView {
    init(transaction: DogBankTransaction, accountID: Int) {
        super.init(frame: .zero)
        let outgoing = transaction.isOutgoing(from: accountID)
        backgroundColor = UIColor(red: 0.97, green: 0.98, blue: 1.00, alpha: 1)
        layer.cornerRadius = 12

        let iconName = outgoing ? "arrow.up.right" : "arrow.down.left"
        let tint = outgoing ? DogBankTheme.red : DogBankTheme.green
        let icon = UIImageView(image: UIImage(systemName: iconName))
        icon.tintColor = tint
        icon.backgroundColor = tint.withAlphaComponent(0.12)
        icon.contentMode = .center
        icon.layer.cornerRadius = 18
        icon.translatesAutoresizingMaskIntoConstraints = false

        let titleText = outgoing ? (transaction.receiverName ?? "PIX enviado") : (transaction.senderName ?? "PIX recebido")
        let title = label(titleText, style: .subheadline, weight: .semibold, lines: 1)
        let subtitle = label(transaction.description, style: .caption1, color: DogBankTheme.muted, lines: 1)
        let labels = UIStackView(arrangedSubviews: [title, subtitle])
        labels.axis = .vertical
        labels.spacing = 3

        let value = label("\(outgoing ? "-" : "+") \(money(transaction.amount))", style: .subheadline, color: tint, weight: .bold)
        value.textAlignment = .right

        let stack = UIStackView(arrangedSubviews: [icon, labels, value])
        stack.axis = .horizontal
        stack.alignment = .center
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            icon.widthAnchor.constraint(equalToConstant: 36),
            icon.heightAnchor.constraint(equalToConstant: 36),
            value.widthAnchor.constraint(greaterThanOrEqualToConstant: 96),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

private func firstName(_ name: String) -> String {
    name.split(separator: " ").first.map(String.init) ?? name
}

private extension UILabel {
    func letterSpacing(_ spacing: CGFloat) {
        guard let text else {
            return
        }
        attributedText = NSAttributedString(
            string: text,
            attributes: [.kern: spacing]
        )
    }
}
