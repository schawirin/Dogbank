import React, { createContext, useContext, useState } from 'react';
import { Globe } from 'lucide-react';

/**
 * Lightweight i18n (no external dependency). PT/EN dictionary + t() helper +
 * a LanguageProvider/useT() hook, with the choice persisted in localStorage.
 * Strings are added batch by batch as pages are translated; missing keys fall
 * back to Portuguese, then to the key itself.
 */
const DICT = {
  pt: {
    // nav / sidebar / header
    'nav.home': 'Início', 'nav.pix': 'PIX', 'nav.extrato': 'Extrato',
    'nav.investimentos': 'Investimentos', 'nav.perfil': 'Perfil', 'nav.evildog': 'EvilDog',
    'sidebar.help_title': 'Precisa de ajuda?',
    'sidebar.help_text': 'Nossa equipe está sempre disponível.',
    'sidebar.talk_support': 'Falar com suporte',
    'header.premium': 'Conta Premium', 'header.my_profile': 'Meu perfil', 'header.logout': 'Sair',
    'header.user': 'Usuário',
    'title.dashboard': 'Painel Geral', 'title.pix': 'PIX', 'title.pix_confirm': 'PIX • Confirmar',
    'title.pix_receipt': 'PIX • Comprovante', 'title.extrato': 'Extrato',
    'title.investimentos': 'Investimentos', 'title.cartoes': 'Cartões', 'title.perfil': 'Perfil',
    'title.evildog': 'EvilDog • Attack Console', 'title.default': 'Painel',
    // greetings / dashboard
    'greeting.morning': 'Bom dia', 'greeting.afternoon': 'Boa tarde', 'greeting.evening': 'Boa noite',
    'dash.welcome': 'Bem-vindo ao seu painel do DogBank',
    'dash.available_balance': 'Saldo disponível', 'dash.account': 'Conta {n}',
    'dash.make_pix': 'Fazer PIX', 'dash.view_statement': 'Ver extrato',
    'dash.invest': 'Invest', 'dash.demo_wallet': 'Carteira demo', 'dash.cdi_btc': 'CDI 100% e Bitcoin',
    'dash.wallet_desc': 'Carteira com renda fixa e ativos digitais.',
    'dash.latest_tx': 'Últimas transações', 'dash.view_all': 'Ver todas',
    'dash.no_tx': 'Nenhuma transação encontrada ainda.',
    'dash.invest_wallet': 'Carteira de investimentos', 'dash.active_products': 'Produtos ativos',
    'dash.summary': 'Resumo', 'dash.contributions': 'Aportes e rendimento diário',
    'dash.view_investments': 'Ver investimentos', 'dash.loading': 'Carregando seus dados...',
    'dash.load_error': 'Não foi possível carregar os dados. Tente novamente mais tarde.',
    'tx.received': 'Recebimento', 'tx.transfer': 'Transferência',
    'common.client': 'Cliente',
    // EvilDog — shell
    'evd.subtitle': 'RECON_SUITE · só lab · dados sintéticos',
    'evd.internet': 'internet', 'evd.internal': 'interno',
    'evd.telemetry_live': 'telemetria ao vivo', 'evd.offline': 'offline',
    'evd.tab_control': 'Painel', 'evd.tab_orchestrator': 'Orquestrador', 'evd.tab_postexploit': 'Pós-Exploração',
    'evd.maximize': 'Maximizar', 'evd.restore': 'Restaurar (Esc)',
    'evd.footer': 'EvilDog opera apenas contra os serviços do laboratório DogBank · uso educacional / EBC',
    'evd.rotate_ip': 'Rotacionar IP', 'evd.source_ip': 'IP de origem',
    'evd.rotate_hint': 'Gera um novo IP de origem (X-Forwarded-For) para evadir bloqueios da AAP',
    'evd.targets': 'Alvos', 'evd.target_ph': 'host / IP (ex: 10.0.0.5)', 'evd.lab_only': 'Somente alvos do lab (allowlist).',
    'evd.scope_err': 'target fora do escopo',
    // EvilDog — orchestrator
    'evd.orch_subtitle': 'Fluxo ativo: pipeline de SQL Injection (emulação de ataque ao vivo)',
    'evd.run_pipeline': 'RODAR PIPELINE', 'evd.running': 'RODANDO…',
    'evd.new_take': 'NOVO TAKE', 'evd.preparing_take': 'PREPARANDO…',
    'evd.st_completed': 'COMPLETO', 'evd.st_running': 'EXECUTANDO', 'evd.st_idle': 'OCIOSO', 'evd.st_blocked': 'PIPELINE FAIL',
    'evd.legend_title': 'Legenda de cores do fluxo',
    'evd.legend_recon': 'Recon & Descoberta', 'evd.legend_vuln': 'Verificação de Vuln', 'evd.legend_payload': 'Montagem de Payload',
    'evd.legend_exploit': 'Exploração Ativa', 'evd.legend_final': 'Exfil & Final',
    'evd.feed_title': 'Feed de telemetria ao vivo', 'evd.feed_empty': '// sem eventos — clique em RODAR PIPELINE',
    'evd.records_exfil': 'registros exfiltrados', 'evd.secrets': 'segredos',
    'evd.see_postexploit': 'ver a aba Post-Exploit para o loot completo',
    // EvilDog — post-exploit
    'evd.pe_inside': 'Você está dentro.',
    'evd.pe_desc': 'Escolha as ações de pós-exploração — elas executam de verdade contra o lab (PIX real, dump de dados, extração de segredos).',
    'evd.pe_console': 'Post-Exploit Console · sessão ativa', 'evd.pe_inside_tag': 'dentro do sistema',
    'evd.pe_report_title': 'Relatório do que foi roubado',
    'evd.col_name': 'Nome', 'evd.col_cpf': 'CPF', 'evd.col_pass': 'Senha', 'evd.col_balance': 'Saldo', 'evd.col_bank': 'Banco', 'evd.col_pixkey': 'Chave PIX',
    'evd.col_mfa': 'MFA', 'evd.mfa_on': 'protegida', 'evd.mfa_off': 'sem MFA',
    'evd.reveal': 'revelar', 'evd.mask': 'mascarar', 'evd.refresh': 'atualizar',
    // EvilDog — escalação
    'evd.esc_fail_title': 'PIPELINE FAIL',
    'evd.esc_blocked_msg': 'a pipeline falhou no início. Escale os agentes para outros IPs:',
    'evd.esc_change_ip': 'Trocar IP', 'evd.esc_escalate': 'Escalar agentes',
    'evd.esc_blocked': 'BLOQUEADO', 'evd.esc_ok': 'OK',
    'evd.esc_contained': '🛡️ CONTIDO',
    'evd.agent_attack_failed': 'FAIL · ATAQUE CONTIDO',
    'evd.swarm_title': 'Enxame de agentes reais · Jobs no Kubernetes',
    // Variante para o stack local, onde cada agente é um container efêmero real
    // (afirmar "Kubernetes" ali seria falso na frente do cliente).
    'evd.swarm_title_docker': 'Enxame de agentes reais · containers efêmeros',
    'evd.pods': 'pods',
    'evd.agents': 'agentes',
    'evd.esc_real_hint': 'cada agente escalado é um Pod Kubernetes real (Job efêmero) — não é uma animação',
    'evd.esc_swarm_size': 'Tamanho do enxame',
    'evd.pod_ticker_title': 'Eventos do cluster (ao vivo)',
    'evd.pod_stat_pending': 'Pendentes',
    'evd.pod_stat_running': 'Em execução',
    'evd.pod_stat_succeeded': 'Concluídos',
    'evd.pod_stat_failed': 'Falharam',
    'evd.pod_stopped_at': 'travou em',
    'evd.pod_reached': 'chegou até',
    'evd.pod_reaped': 'pod recolhido',
    'evd.pod_no_outcome': 'sem desfecho',
    'evd.pod_no_stage': 'não iniciou nenhum estágio',
    'evd.swarm_report_title': 'Relatório da rodada',
    'evd.swarm_rerun': 'Rodar enxame',
    'evd.swarm_close': 'Fechar painel',
    'evd.esc_err_cooldown': 'Aguarde o cooldown do backend:',
    'evd.esc_err_capacity': 'Limite de agentes simultâneos atingido — aguarde a rodada atual terminar.',
    'evd.esc_err_forbidden': 'Sessão ou token do operador inválido — escalação recusada.',
    'evd.esc_err_unavailable': 'Orquestração de agentes indisponível (sem Kubernetes nem Docker).',
    'evd.esc_err_generic': 'Falha ao escalar:',
  },
  en: {
    'nav.home': 'Home', 'nav.pix': 'PIX', 'nav.extrato': 'Statement',
    'nav.investimentos': 'Investments', 'nav.perfil': 'Profile', 'nav.evildog': 'EvilDog',
    'sidebar.help_title': 'Need help?',
    'sidebar.help_text': 'Our team is always available.',
    'sidebar.talk_support': 'Contact support',
    'header.premium': 'Premium Account', 'header.my_profile': 'My profile', 'header.logout': 'Log out',
    'header.user': 'User',
    'title.dashboard': 'Overview', 'title.pix': 'PIX', 'title.pix_confirm': 'PIX • Confirm',
    'title.pix_receipt': 'PIX • Receipt', 'title.extrato': 'Statement',
    'title.investimentos': 'Investments', 'title.cartoes': 'Cards', 'title.perfil': 'Profile',
    'title.evildog': 'EvilDog • Attack Console', 'title.default': 'Dashboard',
    'greeting.morning': 'Good morning', 'greeting.afternoon': 'Good afternoon', 'greeting.evening': 'Good evening',
    'dash.welcome': 'Welcome to your DogBank dashboard',
    'dash.available_balance': 'Available balance', 'dash.account': 'Account {n}',
    'dash.make_pix': 'Send PIX', 'dash.view_statement': 'View statement',
    'dash.invest': 'Invest', 'dash.demo_wallet': 'Demo wallet', 'dash.cdi_btc': '100% CDI & Bitcoin',
    'dash.wallet_desc': 'Fixed income and digital assets portfolio.',
    'dash.latest_tx': 'Latest transactions', 'dash.view_all': 'View all',
    'dash.no_tx': 'No transactions yet.',
    'dash.invest_wallet': 'Investment portfolio', 'dash.active_products': 'Active products',
    'dash.summary': 'Summary', 'dash.contributions': 'Contributions & daily yield',
    'dash.view_investments': 'View investments', 'dash.loading': 'Loading your data...',
    'dash.load_error': 'Could not load your data. Please try again later.',
    'tx.received': 'Incoming', 'tx.transfer': 'Transfer',
    'common.client': 'Customer',
    // EvilDog — shell
    'evd.subtitle': 'RECON_SUITE · lab only · synthetic data',
    'evd.internet': 'internet', 'evd.internal': 'internal',
    'evd.telemetry_live': 'telemetry live', 'evd.offline': 'offline',
    'evd.tab_control': 'Control Panel', 'evd.tab_orchestrator': 'Attack Orchestrator', 'evd.tab_postexploit': 'Post-Exploit',
    'evd.maximize': 'Maximize', 'evd.restore': 'Restore (Esc)',
    'evd.footer': 'EvilDog runs only against the DogBank lab services · educational / EBC use',
    'evd.rotate_ip': 'Rotate IP', 'evd.source_ip': 'Source IP',
    'evd.rotate_hint': 'Generates a new source IP (X-Forwarded-For) to evade AAP IP blocks',
    'evd.targets': 'Targets', 'evd.target_ph': 'host / IP (e.g. 10.0.0.5)', 'evd.lab_only': 'Lab targets only (allowlist).',
    'evd.scope_err': 'target out of scope',
    // EvilDog — orchestrator
    'evd.orch_subtitle': 'Active Flow: SQL Injection pipeline (live attack emulation)',
    'evd.run_pipeline': 'RUN PIPELINE', 'evd.running': 'RUNNING…',
    'evd.new_take': 'NEW TAKE', 'evd.preparing_take': 'PREPARING…',
    'evd.st_completed': 'COMPLETED', 'evd.st_running': 'RUNNING', 'evd.st_idle': 'IDLE', 'evd.st_blocked': 'PIPELINE FAIL',
    'evd.legend_title': 'Flow Color Legend',
    'evd.legend_recon': 'Recon & Discovery', 'evd.legend_vuln': 'Vulnerability Check', 'evd.legend_payload': 'Payload Structuring',
    'evd.legend_exploit': 'Active Exploit', 'evd.legend_final': 'Exfil & Final',
    'evd.feed_title': 'Live Telemetry Feed', 'evd.feed_empty': '// no events — click RUN PIPELINE',
    'evd.records_exfil': 'records exfiltrated', 'evd.secrets': 'secrets',
    'evd.see_postexploit': 'see the Post-Exploit tab for full loot',
    // EvilDog — post-exploit
    'evd.pe_inside': "You're in.",
    'evd.pe_desc': 'Pick post-exploitation actions — they really run against the lab (real PIX, data dump, secret extraction).',
    'evd.pe_console': 'Post-Exploit Console · active session', 'evd.pe_inside_tag': 'inside the system',
    'evd.pe_report_title': 'Report of what was stolen',
    'evd.col_name': 'Name', 'evd.col_cpf': 'CPF', 'evd.col_pass': 'Password', 'evd.col_balance': 'Balance', 'evd.col_bank': 'Bank', 'evd.col_pixkey': 'PIX key',
    'evd.col_mfa': 'MFA', 'evd.mfa_on': 'protected', 'evd.mfa_off': 'no MFA',
    'evd.reveal': 'reveal', 'evd.mask': 'mask', 'evd.refresh': 'refresh',
    // EvilDog — escalation
    'evd.esc_fail_title': 'PIPELINE FAIL',
    'evd.esc_blocked_msg': 'the pipeline failed at the start. Escalate agents to other IPs:',
    'evd.esc_change_ip': 'Change IP', 'evd.esc_escalate': 'Escalate agents',
    'evd.esc_blocked': 'BLOCKED', 'evd.esc_ok': 'OK',
    'evd.esc_contained': '🛡️ CONTAINED',
    'evd.agent_attack_failed': 'FAIL · ATTACK CONTAINED',
    'evd.swarm_title': 'Real agent swarm · Kubernetes Jobs',
    'evd.swarm_title_docker': 'Real agent swarm · ephemeral containers',
    'evd.pods': 'pods',
    'evd.agents': 'agents',
    'evd.esc_real_hint': 'each escalated agent is a real Kubernetes Pod (ephemeral Job) — not an animation',
    'evd.esc_swarm_size': 'Swarm size',
    'evd.pod_ticker_title': 'Cluster events (live)',
    'evd.pod_stat_pending': 'Pending',
    'evd.pod_stat_running': 'Running',
    'evd.pod_stat_succeeded': 'Succeeded',
    'evd.pod_stat_failed': 'Failed',
    'evd.pod_stopped_at': 'stopped at',
    'evd.pod_reached': 'reached',
    'evd.pod_reaped': 'pod reaped',
    'evd.pod_no_outcome': 'no outcome',
    'evd.pod_no_stage': 'no stage started',
    'evd.swarm_report_title': 'Round report',
    'evd.swarm_rerun': 'Run swarm',
    'evd.swarm_close': 'Close panel',
    'evd.esc_err_cooldown': 'Wait for the backend cooldown:',
    'evd.esc_err_capacity': 'Max concurrent agents reached — wait for the current round to finish.',
    'evd.esc_err_forbidden': 'Invalid operator session or token — escalation refused.',
    'evd.esc_err_unavailable': 'Agent orchestration unavailable (no Kubernetes, no Docker).',
    'evd.esc_err_generic': 'Escalate failed:',
  },
};

const LangContext = createContext({ lang: 'pt', setLang: () => {}, t: (k) => k });

const readLang = () => {
  try { return localStorage.getItem('dogbank_lang') || 'pt'; } catch { return 'pt'; }
};

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readLang);
  const setLang = (l) => {
    try { localStorage.setItem('dogbank_lang', l); } catch { /* ignore */ }
    setLangState(l);
  };
  const t = (key, vars) => {
    let s = (DICT[lang] && DICT[lang][key]) ?? (DICT.pt && DICT.pt[key]) ?? key;
    if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.split(`{${k}}`).join(v); });
    return s;
  };
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export const useT = () => useContext(LangContext);

export function LanguageToggle({ className = '' }) {
  const { lang, setLang } = useT();
  return (
    <button
      onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
      title={lang === 'pt' ? 'Switch to English' : 'Mudar para Português'}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border border-slate-200 bg-white/70 text-slate-600 hover:text-purple-600 hover:border-purple-200 transition-colors ${className}`}
    >
      <Globe className="w-3.5 h-3.5" />
      {lang === 'pt' ? 'PT' : 'EN'}
    </button>
  );
}
