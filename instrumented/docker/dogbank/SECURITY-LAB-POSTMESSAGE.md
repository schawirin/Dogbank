# DogBank Security Lab — `postMessage("*")` + framing

Este laboratório contém uma vulnerabilidade **intencional e didática**. Ele usa
somente dados fictícios, mantém as mensagens na memória do navegador e não envia
o conteúdo capturado para qualquer servidor externo.

No ambiente real analisado no Challenge, o que foi comprovado foi apenas:

- uso de `postMessage` com `"*"`;
- possibilidade de framing;
- uma página de outra origem recebeu mensagens da aplicação;
- as mensagens observadas não continham dados pessoais ou financeiros.

Os dados PIX desta PoC simulam **impacto potencial**. Eles não representam dados
PIX obtidos do sistema analisado.

## Arquitetura

- `http://localhost:3000/security-lab/pix-demo?mode=vulnerable`: tela DogBank
  sintética. Permite framing e envia `PIX_COMPLETED` usando target origin `"*"`.
- `https://lab.dogbank.dog:3001`: Attacker Simulator de outra origem. Incorpora
  a tela, recebe a mensagem e mantém um histórico somente em memória.
- `http://localhost:3000/security-lab/trusted-receiver`: receptor legítimo que
  valida `event.origin` e `event.source`.

Na interface principal, SQL Injection e Browser Trust aparecem como módulos
independentes no catálogo do EvilDog. O Browser Trust é incorporado ao console
por um iframe HTTPS de outra origem (porta `3001`) e pode ser expandido sem sair
do DogBank.

Pipeline visual independente:

`LOAD → FRAME → PIX → POSTMESSAGE → CAPTURE → REPORT`

O botão **RODAR PIPELINE** executa a cadeia completa. A etapa PIX usa apenas o
modo `autoplay=1` da rota sintética para representar a ação do usuário durante a
demonstração; nenhuma API bancária é chamada. Cada nó da pipeline é clicável e
mostra a evidência realmente observada naquele take.

## Iniciar

Na pasta `instrumented/docker/dogbank`:

```bash
podman compose -f docker-compose.full.yml -f docker-compose.local-demo.yml up -d --build frontend security-lab-attacker
```

Abra `https://lab.dogbank.dog:8443/dashboard/evildog`, entre em **EvilDog** e
selecione o módulo **postMessage + Framing**.

O simulador também pode ser aberto diretamente em:

- HTTPS: `https://lab.dogbank.dog:3001`
- HTTP local: `http://localhost:3002`

## Reproduzir — vulnerable mode

1. No catálogo do EvilDog, abra **postMessage + Framing**.
2. Selecione **VULNERABLE MODE**.
3. Clique em **RODAR PIPELINE**.
4. Aguarde o estado **COMPLETO (6/6)**.
5. Observe `PIX_COMPLETED`, `event.origin`, transaction ID, nomes, CPFs e valor
   fictícios no painel **Captured Messages**.
6. Clique nos nós para abrir os detalhes de URL, CSP, payload e relatório.

## Reproduzir — fixed mode

1. Selecione **FIXED MODE**.
2. Clique em **RODAR PIPELINE**. A resposta do DogBank usa CSP
   `frame-ancestors 'self'`, então o iframe do
   simulador não completa o handshake.
3. A pipeline mostra **Attack blocked** e zero mensagens não autorizadas.
4. Opcionalmente abra `/security-lab/trusted-receiver`: o receptor legítimo é da
   mesma origem e valida origem e janela emissora antes de aceitar a mensagem.

## Pontos de código

- `postMessage("*")` intencional e target origin corrigido:
  `dogbank-frontend/src/securityLab/postMessageLab.js`.
- Emissão após o PIX fictício: `dogbank-frontend/src/pages/SecurityLabPixDemoPage.jsx`.
- Listener do simulador: `security-lab-attacker/app.js`.
- Integração e expansão dentro do EvilDog:
  `dogbank-frontend/src/components/EvilDog/BrowserAttackLab.jsx`.
- Catálogo dos módulos: `dogbank-frontend/src/pages/EvilDogPage.jsx`.
- Validação `event.origin`/`event.source`:
  `dogbank-frontend/src/pages/SecurityLabTrustedReceiverPage.jsx`.
- CSP `frame-ancestors`: `dogbank-frontend/nginx/nginx.conf`.

Não habilite a rota vulnerável em um ambiente real. Ela existe exclusivamente
para o laboratório acadêmico local.
