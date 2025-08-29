DogBank — Frontend

Frontend do DogBank (simulador de banco focado em PIX).
Build em React (SPA), servido como estático por Nginx e publicado em Kubernetes/EKS atrás do Traefik (Ingress + API Gateway).

🚀 Tech stack

React + React Router

Tailwind CSS

Axios

Nginx (serve o build estático)

Kubernetes (EKS) + Traefik (Ingress/Gateway)

(Opcional) Datadog para métricas/logs

🏗️ Arquitetura (prod)
Browser ──► AWS NLB/ALB (Service LB do Traefik)
          └► Traefik (IngressClass: traefik)
                ├── "/"                  → dogbank-frontend-service:80 (Nginx + build React)
                ├── "/api/auth"          → auth-service:8088
                ├── "/api/accounts"      → account-service:8089
                ├── "/api/transactions"  → transaction-service:8084
                ├── "/api/bancocentral"  → bancocentral-service:8085
                ├── "/api/integration"   → integration-service:8082
                └── "/api/notifications" → notification-service:8083


Observação: existe compatibilidade opcional com rotas legadas iniciando em /auth/api/* usando um Middleware stripPrefix. Em produção, prefira sempre /api/....

🎨 Design (guia rápido)

Inspiração: C6 Bank

Paleta: roxos da Datadog (roxo principal), neutros para textos/fundos, verde para sucesso e vermelho para erro

Mobile-first, interface limpa e direta

🔧 Desenvolvimento local
Pré-requisitos

Node.js 18+

npm ou yarn

(Opcional) Kubernetes com contexto apontando para cluster de dev (para testar via port-forward)

1) Clonar e instalar
git clone https://github.com/seu-usuario/dogbank-frontend.git
cd dogbank-frontend
npm install
# ou
yarn

2) Variáveis de ambiente

Use rotas relativas (recomendado) para funcionar igual em local e produção:

Crie .env na raiz:

# sempre que possível, use caminhos relativos:
REACT_APP_AUTH_API=/api/auth
REACT_APP_ACCOUNT_API=/api/accounts
REACT_APP_TRANSACTION_API=/api/transactions
REACT_APP_INTEGRATION_API=/api/integration
REACT_APP_NOTIFICATION_API=/api/notifications


Caso precise apontar para outro host (não recomendado), use URLs absolutas, por ex. http://localhost:8081/api/auth.

3) Subir o dev server
npm start
# ou
yarn start


Abra: http://localhost:3000

Dica: testando contra o cluster via Traefik (sem CORS)

Faça port-forward do Traefik para sua máquina e continue usando /api/... no front:

kubectl -n traefik port-forward svc/traefik 8081:80
# agora as APIs estão em http://localhost:8081/api/...


Se o código usa caminhos relativos, não precisa mudar .env; o navegador fala com localhost:3000 e o dev-server faz proxy.
Se quiser proxy explícito (CRA), adicione em package.json:

{
  "proxy": "http://localhost:8081"
}

🐳 Build & container

Build:

npm run build


A imagem de produção (já usada nos manifests) serve o build com Nginx.
Exemplo de execução local da imagem publicada:

docker run --rm -p 8080:8080 schawirin/dogbank-frontend:v1.3
# http://localhost:8080

☸️ Deploy em Kubernetes (EKS) com Traefik
1) Publicar/atualizar frontend

Os manifests incluem:

ConfigMap do Nginx (SPA + redirect de / → /password)

Deployment do frontend (Nginx servindo React)

Service ClusterIP do frontend

Traefik (IngressClass, RBAC, Deployment, Service LoadBalancer)

Ingress padrão k8s roteando / e /api/*

Aplicar:

kubectl apply -f k8s/dogbank-frontend-complete.yaml
# atenção: esse arquivo cria/atualiza recursos em dois namespaces:
# - production (app)
# - traefik (gateway)


Pegar o DNS do LoadBalancer do Traefik:

LB=$(kubectl -n traefik get svc traefik -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "http://$LB/password"

2) Health checks rápidos
curl -I "http://$LB/health"              # 200 (Nginx do front)
curl -I "http://$LB/api/auth/health"     # 200 (se exposto no backend)

3) Rollout
kubectl -n production rollout restart deploy/dogbank-frontend
kubectl -n production rollout status  deploy/dogbank-frontend

🧪 Dados de teste

CPF: 12345678915

Senha: 123456

Nome: Julia Medina

Chave PIX: julia.medina@gmail.com

🐛 Cenários simulados de erro (PIX)

Limite excedido: valor R$ 1.000,00

Saldo insuficiente: valor R$ 5.000,00

Erro interno: valor R$ 666,66

Chave inválida: chave sem @

Conta bloqueada: chave ex171@gmail.com

CPF/CNPJ bloqueado: 66447697119

Destinatário inválido: containexistente@example.com

Horário não permitido: transações entre 22h–6h

📂 Estrutura
dogbank-frontend/
├─ public/
├─ src/
│  ├─ components/
│  │  ├─ common/       # Button, Input, Card, Alert...
│  │  ├─ layout/       # Header, Footer, Sidebar...
│  │  ├─ auth/         # Login/Password UI
│  │  ├─ dashboard/
│  │  └─ pix/
│  ├─ pages/
│  ├─ services/        # chamadas Axios (usar /api/...)
│  ├─ utils/
│  ├─ context/
│  ├─ hooks/
│  ├─ styles/
│  ├─ App.jsx
│  └─ index.jsx
├─ tailwind.config.js
├─ package.json
└─ README.md

🔌 Integração com o backend (portas & rotas)
Serviço	Porta	Caminho público (via Traefik)
auth	8088	/api/auth
account	8089	/api/accounts
transaction	8084	/api/transactions
bancocentral	8085	/api/bancocentral
integration	8082	/api/integration
notification	8083	/api/notifications

Importante: no frontend, sempre consumir via /api/... (caminho relativo).
Em produção, o Traefik resolve e envia para o serviço correto. Em dev, use proxy ou port-forward.

🧭 Fluxos principais

Autenticação

Digita CPF → /password

Digita senha → login (POST /api/auth/login)

Redireciona para Dashboard

PIX

Abre PIX → preenche chave/valor

Confirmação → confirmação final

Comprovante

🛠️ Troubleshooting

Tela branca na raiz
Certifique-se que o Nginx tem:

redirect location = / { return 302 /password; }

SPA fallback try_files $uri $uri/ /index.html;

405 / Method Not Allowed
Verifique se o front chama POST nos endpoints corretos em /api/....
Se ainda estiver usando /auth/api/..., habilite o middleware de compat.

404 no DNS do ALB
DNS de LoadBalancer pode demorar alguns segundos para propagar.
Garanta que o Ingress tem ingressClassName: traefik e que o Service LB do Traefik está EXTERNAL-IP populado.

Quero debugar sem ALB
kubectl -n traefik port-forward svc/traefik 8081:80 e acesse http://localhost:8081/.

🤝 Contribuição

Issues e PRs são bem-vindos.
Este projeto é para demonstração/educação.