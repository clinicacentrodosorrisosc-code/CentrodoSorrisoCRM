const fs = require('fs');
const path = require('path');

const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../messages/en.json'), 'utf8'));

// High quality Portuguese translations dictionary
const ptTranslations = {
  LoginPage: {
    titleAccept: "Entrar para aceitar",
    titleWelcome: "Bem-vindo de volta",
    descAccept: "Faça login e levaremos você ao convite.",
    descWelcome: "Faça login na sua conta",
    emailLabel: "E-mail",
    emailPlaceholder: "voce@exemplo.com",
    passwordLabel: "Senha",
    forgotPassword: "Esqueceu a senha?",
    passwordPlaceholder: "Digite sua senha",
    signingIn: "Entrando...",
    signIn: "Entrar",
    noAccount: "Não tem uma conta?",
    createAccount: "Criar conta"
  },
  Sidebar: {
    title: "Centro do Sorriso",
    dashboard: "Painel",
    inbox: "Caixa de Entrada",
    notifications: "Notificações",
    contacts: "Contatos",
    pipelines: "Funis de Vendas",
    broadcasts: "Transmissões",
    automations: "Automações",
    flows: "Fluxos",
    aiAgents: "Agentes de IA",
    settings: "Configurações",
    beta: "Beta",
    unreadConversations: "{count} conversa não lida {count, plural, =1 {} other {conversas não lidas}}",
    unreadNotifications: "{count} notificação não lida {count, plural, =1 {} other {notificações não lidas}}",
    roleOwner: "Proprietário",
    roleAdmin: "Admin",
    roleAgent: "Agente",
    roleViewer: "Visualizador",
    closeMenu: "Fechar menu",
    defaultUser: "Usuário",
    defaultAvatar: "Avatar",
    menuProfile: "Perfil",
    menuSettings: "Configurações",
    menuSignOut: "Sair"
  },
  Header: {
    dashboard: "Painel",
    inbox: "Caixa de Entrada",
    notifications: "Notificações",
    contacts: "Contatos",
    pipelines: "Funis de Vendas",
    broadcasts: "Transmissões",
    automations: "Automações",
    settings: "Configurações",
    openMenu: "Abrir menu",
    openAccountMenu: "Abrir menu da conta",
    defaultUser: "Usuário",
    defaultAvatar: "Avatar",
    menuProfile: "Perfil",
    menuSettings: "Configurações",
    menuSignOut: "Sair"
  },
  ModeToggle: {
    switchMode: "Alternar tema"
  },
  LanguageToggle: {
    switchLanguage: "Alterar idioma",
    pt: "Português",
    en: "English",
    ko: "한국어"
  }
};

// Translate function with recursive dictionary mapping
function translateValue(val, keyPath = "") {
  if (typeof val === 'string') {
    return translateText(val, keyPath);
  }
  if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
    const res = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = translateValue(v, keyPath ? `${keyPath}.${k}` : k);
    }
    return res;
  }
  return val;
}

// Get override or translate text
function getOverride(pathStr) {
  const parts = pathStr.split('.');
  let curr = ptTranslations;
  for (const p of parts) {
    if (curr && curr[p] !== undefined) {
      curr = curr[p];
    } else {
      return undefined;
    }
  }
  return typeof curr === 'string' ? curr : undefined;
}

function translateText(text, pathStr) {
  const override = getOverride(pathStr);
  if (override !== undefined) return override;

  let s = text;

  // Common vocabulary replacements
  const map = [
    [/Dashboard/g, "Painel"],
    [/Inbox/g, "Caixa de Entrada"],
    [/Notifications/g, "Notificações"],
    [/Contacts/g, "Contatos"],
    [/Contact/g, "Contato"],
    [/Pipelines/g, "Funis de Vendas"],
    [/Pipeline/g, "Funil de Vendas"],
    [/Broadcasts/g, "Transmissões"],
    [/Broadcast/g, "Transmissão"],
    [/Automations/g, "Automações"],
    [/Automation/g, "Automação"],
    [/Flows/g, "Fluxos"],
    [/Flow/g, "Fluxo"],
    [/Settings/g, "Configurações"],
    [/AI Agents/g, "Agentes de IA"],
    [/Save Changes/g, "Salvar Alterações"],
    [/Save changes/g, "Salvar alterações"],
    [/Save/g, "Salvar"],
    [/Cancel/g, "Cancelar"],
    [/Delete/g, "Excluir"],
    [/Edit/g, "Editar"],
    [/Create/g, "Criar"],
    [/Add/g, "Adicionar"],
    [/Search/g, "Pesquisar"],
    [/Filter/g, "Filtrar"],
    [/Name/g, "Nome"],
    [/Phone Number/g, "Número de Telefone"],
    [/Phone/g, "Telefone"],
    [/Email/g, "E-mail"],
    [/Status/g, "Status"],
    [/Actions/g, "Ações"],
    [/Close/g, "Fechar"],
    [/Loading\.\.\./g, "Carregando..."],
    [/No data/g, "Nenhum dado encontrado"],
    [/No contacts/g, "Nenhum contato encontrado"],
    [/CRM Template for WhatsApp/g, "Centro do Sorriso"],
    [/wacrm/g, "Centro do Sorriso"]
  ];

  for (const [regex, replacement] of map) {
    s = s.replace(regex, replacement);
  }

  return s;
}

const ptResult = translateValue(en);
fs.writeFileSync(path.join(__dirname, '../messages/pt.json'), JSON.stringify(ptResult, null, 2), 'utf8');
console.log('pt.json full generation completed!');
