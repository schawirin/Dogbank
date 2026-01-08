# DogBank Frontend

Este é o frontend do projeto DogBank, um sistema bancário moderno para simulação de transações PIX.

## 🚀 Tecnologias Utilizadas

- **React** - Biblioteca JavaScript para construção de interfaces
- **React Router** - Navegação e roteamento
- **Tailwind CSS** - Framework de CSS utilitário
- **Axios** - Cliente HTTP para requisições à API

## 🎨 Design

O design do DogBank segue as seguintes características:
- Inspirado no layout do C6 Bank
- Cores da Datadog (tons de roxo como cor principal)
- Interface limpa e moderna
- Foco na experiência mobile-first

## 🔨 Instalação e Configuração

### Pré-requisitos
- Node.js (v14 ou superior)
- npm ou yarn
- Backend do DogBank rodando (Java Spring Boot)

### Passos para instalação

1. **Clone o repositório**
```bash
git clone https://github.com/seu-usuario/dogbank-frontend.git
cd dogbank-frontend
```

2. **Instale as dependências**
```bash
npm install
# ou
yarn install
```

3. **Configure as variáveis de ambiente**
- Crie um arquivo `.env` na raiz do projeto:
```
REACT_APP_AUTH_API_URL=http://localhost:8088
REACT_APP_ACCOUNT_API_URL=http://localhost:8082
REACT_APP_TRANSACTION_API_URL=http://localhost:8083
REACT_APP_INTEGRATION_API_URL=http://localhost:8084
REACT_APP_NOTIFICATION_API_URL=http://localhost:8085
```

4. **Inicie o servidor de desenvolvimento**

npm install -D @tailwindcss/postcss

```bash
npm start
# ou
yarn start

```

5. **Acesse a aplicação**
- Abra seu navegador em [http://localhost:3000](http://localhost:3000)

## 📁 Estrutura de Diretórios

```
dogbank-frontend/
├── public/
│   ├── favicon.ico
│   ├── index.html
│   └── logo.svg
├── src/
│   ├── components/
│   │   ├── common/       # Componentes reutilizáveis
│   │   ├── layout/       # Componentes de layout
│   │   ├── auth/         # Componentes de autenticação
│   │   ├── dashboard/    # Componentes do dashboard
│   │   └── pix/          # Componentes do PIX
│   ├── pages/            # Páginas da aplicação
│   ├── services/         # Serviços e chamadas de API
│   ├── utils/            # Utilitários e formatadores
│   ├── context/          # Contextos React
│   ├── hooks/            # Hooks personalizados
│   ├── styles/           # Estilos globais
│   ├── App.jsx           # Componente principal
│   └── index.jsx         # Ponto de entrada da aplicação
├── tailwind.config.js    # Configuração do Tailwind CSS
├── package.json
└── README.md
```

## 📊 Fluxos Principais

### Fluxo de Autenticação
1. Usuário digita CPF na primeira tela
2. Usuário é redirecionado para a tela de senha
3. Após autenticação bem-sucedida, é redirecionado para o Dashboard

### Fluxo de Transferência PIX
1. Usuário acessa a tela de PIX
2. Preenche os dados da transferência (chave PIX, valor)
3. Visualiza a tela de confirmação
4. Confirma a transação
5. Recebe o comprovante da transferência

## 🧪 Dados para Teste

- **CPF**: 12345678915
- **Senha**: 123456
- **Nome**: Julia Medina
- **Chave PIX**: julia.medina@gmail.com

## 🐛 Erros Simulados para Teste do PIX

Para testar diferentes cenários de erro, você pode usar os seguintes valores:

- **Limite Excedido**: Valor exatamente R$ 1.000,00
- **Chave Inválida**: Chave sem @ (não é um e-mail)
- **Saldo Insuficiente**: Valor exatamente R$ 5.000,00
- **Conta Bloqueada**: Chave PIX "ex171@gmail.com"
- **Horário Não Permitido**: Transações entre 22h e 6h
- **CPF/CNPJ Bloqueado**: Chave PIX "66447697119"
- **Destinatário Inválido**: Chave PIX "containexistente@example.com"
- **Erro Interno**: Valor exatamente R$ 666,66

## 📱 Capturas de Tela

_[Adicionar capturas de tela quando o projeto estiver concluído]_

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

## 📄 Licença

Este projeto é apenas para fins de demonstração e aprendizado.


# Guia de Implementação - DogBank Frontend

Este guia descreve os principais componentes e suas funções para ajudar na implementação do frontend do DogBank.

## 1. Configuração Inicial

Após criar a estrutura de diretórios e arquivos, inicie com:

1. Configure o Tailwind CSS para usar a paleta de cores da Datadog (tons de roxo)
2. Crie os componentes comuns reutilizáveis (Button, Input, Card, Alert)
3. Implemente o contexto de autenticação e seus hooks

## 2. Componentes Principais

### Componentes Comuns
- **Button**: Botão personalizado com variantes (primary, secondary, outline, etc.)
- **Input**: Campo de entrada com suporte para validação e mensagens de erro
- **Card**: Container com cabeçalho opcional e conteúdo
- **Alert**: Exibir mensagens de sucesso, erro, aviso ou informação

### Layout
- **Header**: Barra superior com logo e menu de navegação
- **Footer**: Rodapé com informações da aplicação
- **Sidebar**: Menu lateral para navegação dentro da aplicação
- **MainLayout**: Componente que envolve todas as páginas autenticadas

### Autenticação
- **LoginForm**: Formulário para entrada do CPF
- **PasswordForm**: Formulário para entrada da senha

### Dashboard
- **AccountSummary**: Resumo da conta com saldo e botões de ação rápida
- **TransactionHistory**: Lista das últimas transações
- **QuickActions**: Grid de ações rápidas para navegação

### PIX
- **PixTransferForm**: Formulário para transferência PIX
- **PixConfirmation**: Tela de confirmação da transferência
- **PixReceipt**: Comprovante da transferência realizada

## 3. Fluxo de Desenvolvimento Recomendado

1. **Primeiro MVP (Mínimo Produto Viável):**
   - Implementar autenticação básica
   - Criar a página de Dashboard com dados mockados
   - Implementar o fluxo básico de PIX

2. **Refinamento:**
   - Conectar com as APIs reais
   - Melhorar validações e tratamento de erros
   - Implementar funcionalidades adicionais

3. **Aprimoramento:**
   - Adicionar animações e transições
   - Melhorar responsividade e experiência mobile
   - Testes e otimizações de performance

## 4. Integração com o Backend

### Módulos e Portas
- **auth-module**: Porta 8088 - Login e validação de chave PIX
- **account-module**: Porta 8082 - Informações da conta e saldo
- **transaction-module**: Porta 8083 - Transferências e histórico
- **bancocentral-module**: Porta 8085 - Validação de transações PIX

### Considerações sobre API Mock
Durante o desenvolvimento, você pode usar as funções de mock nos serviços para trabalhar sem depender do backend. 
- Os serviços já incluem simulações para testes
- Ative o modo de desenvolvimento para usar dados simulados

## 5. Testes e Simulação de Erros

Para testar os cenários de erro do PIX, utilize os seguintes valores:
- **Valor R$ 1.000,00**: Simula limite excedido
- **Valor R$ 5.000,00**: Simula saldo insuficiente
- **Valor R$ 666,66**: Simula erro interno
- **Chave sem @**: Simula chave PIX inválida
- **Chave "ex171@gmail.com"**: Simula conta bloqueada

## 6. Dicas Visuais

- **Cores Principais:**
  - Roxo primário: #774af4 (Datadog)
  - Tons de cinza neutro para textos e fundos
  - Verde para sucesso: #00b42a
  - Vermelho para erro: #ff0022

- **Tipografia:**
  - Fonte principal: Inter (sans-serif)
  - Fonte para títulos: Poppins (sans-serif)

- **Espaçamento e Layout:**
  - Use o sistema de grid do Tailwind (grid-cols-*)
  - Mantenha espaçamento consistente com classes do Tailwind
  - Design mobile-first com responsividade

## 7. Considerações Finais

- O login é simulado com CPF: 12345678915 e senha: 123456
- Todas as operações são apenas simulações, não são transações reais
- Foco na experiência do usuário e usabilidade