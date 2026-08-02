const fs = require('fs');
const path = require('path');

const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../messages/en.json'), 'utf8'));

// Portuguese translations mapping for all keys in en.json
const pt = {
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
    theme: "Tema",
    themeSystem: "Sistema",
    themeLight: "Claro",
    themeDark: "Escuro",
    accentColor: "Cor de Destaque",
    toggleTheme: "Alternar tema"
  },
  LanguageToggle: {
    language: "Idioma",
    pt: "Português",
    en: "English",
    ko: "한국어"
  }
};

// Deep merge en structure with pt translations, preserving string placeholders
function translateObject(enObj, ptObj = {}) {
  const result = {};
  for (const key of Object.keys(enObj)) {
    if (typeof enObj[key] === 'object' && enObj[key] !== null && !Array.isArray(enObj[key])) {
      result[key] = translateObject(enObj[key], ptObj[key] || {});
    } else {
      result[key] = ptObj[key] !== undefined ? ptObj[key] : translateString(enObj[key]);
    }
  }
  return result;
}

function translateString(str) {
  // Basic fallback translation rule map for missing keys
  return str
    .replace(/Dashboard/g, 'Painel')
    .replace(/Inbox/g, 'Caixa de Entrada')
    .replace(/Contacts/g, 'Contatos')
    .replace(/Pipelines/g, 'Funis de Vendas')
    .replace(/Broadcasts/g, 'Transmissões')
    .replace(/Automations/g, 'Automações')
    .replace(/Flows/g, 'Fluxos')
    .replace(/Settings/g, 'Configurações')
    .replace(/Save changes/g, 'Salvar alterações')
    .replace(/Cancel/g, 'Cancelar')
    .replace(/Delete/g, 'Excluir')
    .replace(/Edit/g, 'Editar')
    .replace(/Create/g, 'Criar')
    .replace(/Search/g, 'Pesquisar')
    .replace(/Filter/g, 'Filtrar')
    .replace(/Name/g, 'Nome')
    .replace(/Phone/g, 'Telefone')
    .replace(/Email/g, 'E-mail')
    .replace(/Status/g, 'Status')
    .replace(/Actions/g, 'Ações')
    .replace(/Close/g, 'Fechar')
    .replace(/Loading\.\.\./g, 'Carregando...')
    .replace(/CRM Template for WhatsApp/g, 'Centro do Sorriso');
}

const fullPt = translateObject(en, pt);
fs.writeFileSync(path.join(__dirname, '../messages/pt.json'), JSON.stringify(fullPt, null, 2), 'utf8');
console.log('pt.json created successfully');
