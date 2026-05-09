import { defaultSettings } from "./settingsMock.js";
import { getContractTemplates, saveContractTemplatesBackup } from "./contractTemplatesStore.js";
import {
  clearAllData as clearAllSystemData,
  getClients,
  getContracts,
  getFinance,
  getReservations,
  getSettings,
  saveClients,
  saveContracts,
  saveFinance,
  saveReservations,
  saveSettings,
} from "../../services/dataService.js";
import {
  getMessageAutomationHistory,
  getMessageAutomationSettings,
  getReservasForMessageAutomation,
  saveMessageAutomationSettings,
  sendReservationMessage,
} from "../../services/messageAutomationService.js";
import { testSupabaseConnection } from "../../services/supabaseClient.js";

const OWNER_SIGNATURE_STORAGE_KEY = "assinatura_proprietario";
const ADMIN_USER_KEY = "usuario_admin";
const ADMIN_PASSWORD_KEY = "senha_admin";

const settingsGroups = [
  {
    title: "Dados do local",
    description: "Informações principais usadas como referência padrão do sítio.",
    fields: [
      { key: "venueName", label: "Nome do local", type: "text" },
      { key: "ownerName", label: "Nome do responsável/locador", type: "text" },
      { key: "ownerDocument", label: "CPF/CNPJ do responsável", type: "text" },
      { key: "phone", label: "Telefone/WhatsApp", type: "tel" },
      { key: "cityState", label: "Cidade/Estado", type: "text" },
      { key: "address", label: "Endereço do sítio", type: "text", wide: true },
    ],
  },
  {
    title: "Regras padrão da locação",
    description: "Valores de referência para regras, multas e horários da locação.",
    fields: [
      { key: "maxCapacity", label: "Capacidade máxima de pessoas", type: "number" },
      { key: "additionalPersonValue", label: "Valor por pessoa adicional", type: "number" },
      { key: "soundLimitTime", label: "Horário limite de som", type: "time" },
      { key: "indoorSmokingFine", label: "Valor da multa por fumar dentro da casa", type: "number" },
      { key: "cigaretteButtFine", label: "Valor da multa por bitucas descartadas incorretamente", type: "number" },
      { key: "lostKeyFine", label: "Valor da multa por perda de chave", type: "number" },
      { key: "lateCheckoutFine", label: "Valor da multa por atraso na saída", type: "number" },
      { key: "extraHourValue", label: "Valor da hora excedente", type: "number" },
    ],
  },
  {
    title: "Mensagem padrão do WhatsApp",
    description: "Modelo visual com variáveis para mensagens futuras.",
    fields: [
      { key: "whatsappMessage", label: "Mensagem padrão", type: "textarea", wide: true },
    ],
  },
];

const whatsappVariables = [
  "{{nome_cliente}}",
  "{{data_entrada}}",
  "{{hora_entrada}}",
  "{{data_saida}}",
  "{{hora_saida}}",
  "{{valor_total}}",
  "{{link_contrato}}",
];

export function createSettingsPage() {
  let settings = getStoredSettings();
  const fields = new Map();
  const page = document.createElement("section");
  const form = document.createElement("form");
  const onlineDatabaseSection = createOnlineDatabaseSection({
    onTest: testOnlineDatabase,
  });
  const backupSection = createBackupSection({
    onExport: exportBackup,
    onImport: importBackup,
    onClear: clearAllData,
  });
  const messageAutomationSection = createMessageAutomationSection({
    onSendMessage: sendAutomationMessage,
    onSaveSettings: saveAutomationSettings,
  });
  const actions = document.createElement("div");
  const saveButton = document.createElement("button");
  const restoreButton = document.createElement("button");
  const feedback = document.createElement("p");

  page.className = "settings-page";
  page.setAttribute("aria-labelledby", "settings-title");

  form.className = "settings-form";
  form.noValidate = true;

  settingsGroups.forEach((group) => {
    form.append(createSettingsGroup(group, fields));
  });

  form.append(createAdminAccessSection(feedback));

  actions.className = "settings-actions";

  restoreButton.className = "button button--secondary";
  restoreButton.type = "button";
  restoreButton.textContent = "Restaurar padrão";
  restoreButton.addEventListener("click", () => {
    settings = { ...defaultSettings };
    saveStoredSettings(settings);
    fillFields(fields, settings);
    showFeedback(feedback, "Configurações padrão restauradas.");
  });

  saveButton.className = "button button--primary";
  saveButton.type = "submit";
  saveButton.textContent = "Salvar configurações";

  feedback.className = "settings-feedback";
  feedback.hidden = true;

  actions.append(restoreButton, saveButton);
  form.append(onlineDatabaseSection, messageAutomationSection, backupSection, actions, feedback);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    settings = readSettings(fields);
    saveStoredSettings(settings);
    showFeedback(feedback, "Configurações salvas localmente.");
  });

  page.append(createHeader(), form);
  fillFields(fields, settings);

  return page;

  async function exportBackup() {
    settings = readSettings(fields);
    saveStoredSettings(settings);
    downloadBackup(await createBackupData(settings));
    showFeedback(feedback, "Backup exportado com sucesso.");
  }

  function importBackup(file) {
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const backup = JSON.parse(reader.result);
        const validationMessage = validateBackupDataStrict(backup);

        if (validationMessage) {
          showFeedback(feedback, validationMessage);
          return;
        }

        const shouldImport = window.confirm("Isso irá substituir os dados atuais do sistema. Deseja continuar?");

        if (!shouldImport) {
          showFeedback(feedback, "Importação cancelada.");
          return;
        }

        await applyBackupData(backup);
        settings = { ...defaultSettings, ...backup.configuracoes };
        fillFields(fields, settings);
        showFeedback(feedback, "Backup importado com sucesso.");
        window.location.reload();
      } catch {
        showFeedback(feedback, "Arquivo de backup inválido");
      }
    };

    reader.onerror = () => showFeedback(feedback, "Não foi possível ler o arquivo de backup.");
    reader.readAsText(file);
  }

  async function clearAllData() {
    const shouldClear = window.confirm(
      "Isso irá apagar TODOS os dados do sistema (clientes, reservas, financeiro e contratos). Deseja continuar?",
    );

    if (!shouldClear) {
      showFeedback(feedback, "Limpeza cancelada.");
      return;
    }

    const shouldKeepOwnerSignature = window.confirm("Deseja manter a assinatura do proprietário?");

    showFeedback(feedback, "Limpando dados do sistema...");

    try {
      await clearAllSystemData({ keepOwnerSignature: shouldKeepOwnerSignature });
      showFeedback(feedback, "Todos os dados foram apagados com sucesso.");
      window.location.reload();
    } catch (error) {
      console.error("Erro ao limpar todos os dados:", error);
      showFeedback(feedback, "Não foi possível apagar todos os dados. Verifique a conexão com o Supabase.");
    }
  }

  async function testOnlineDatabase() {
    showFeedback(feedback, "Testando conexão com Supabase...");

    try {
      const { error } = await testSupabaseConnection();

      if (error) {
        showFeedback(feedback, `Erro ao conectar com Supabase. Detalhe: ${error.message || "erro não informado"}`);
        return;
      }

      showFeedback(feedback, "Conexão com Supabase funcionando.");
    } catch (error) {
      showFeedback(feedback, `Erro ao conectar com Supabase. Detalhe: ${error.message || "erro não informado"}`);
    }
  }

  function saveAutomationSettings(settings) {
    saveMessageAutomationSettings(settings);
    showFeedback(feedback, "Configurações de automação salvas.");
  }

  function sendAutomationMessage({ reservationId, type }) {
    const result = sendReservationMessage({ reservationId, type, mode: "manual" });

    showFeedback(feedback, result.message);
  }
}

function createHeader() {
  const header = document.createElement("div");
  const kicker = document.createElement("p");
  const title = document.createElement("h2");
  const intro = document.createElement("p");

  header.className = "settings-page__header";
  kicker.className = "page-panel__kicker";
  kicker.textContent = "Sítio São Jorge";

  title.className = "settings-page__title";
  title.id = "settings-title";
  title.textContent = "Configurações";

  intro.className = "settings-page__intro";
  intro.textContent = "Informações padrão do local e regras da locação.";

  header.append(kicker, title, intro);

  return header;
}

function createSettingsGroup(group, fields) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const description = document.createElement("p");
  const grid = document.createElement("div");

  section.className = "settings-card";
  header.className = "settings-card__header";
  title.className = "settings-card__title";
  title.textContent = group.title;
  description.className = "settings-card__description";
  description.textContent = group.description;
  grid.className = "settings-card__grid";

  group.fields.forEach((fieldConfig) => {
    const field = createField(fieldConfig);

    fields.set(fieldConfig.key, field.input);
    grid.append(field.wrapper);
  });

  header.append(title, description);
  section.append(header, grid);

  if (group.title === "Mensagem padrão do WhatsApp") {
    section.append(createVariablesList());
  }

  return section;
}

function createField({ key, label, type, wide }) {
  const wrapper = document.createElement("label");
  const labelText = document.createElement("span");
  const input = type === "textarea"
    ? document.createElement("textarea")
    : document.createElement("input");

  wrapper.className = `settings-field${wide ? " settings-field--wide" : ""}`;
  labelText.textContent = label;
  input.name = key;

  if (type === "textarea") {
    input.rows = 6;
  } else {
    input.type = type;

    if (type === "number") {
      input.min = "0";
      input.step = "0.01";
    }
  }

  wrapper.append(labelText, input);

  return { wrapper, input };
}

function createVariablesList() {
  const wrapper = document.createElement("div");
  const title = document.createElement("p");
  const list = document.createElement("div");

  wrapper.className = "settings-variables";
  title.className = "settings-variables__title";
  title.textContent = "Variáveis disponíveis";
  list.className = "settings-variables__list";

  whatsappVariables.forEach((variable) => {
    const item = document.createElement("code");
    item.textContent = variable;
    list.append(item);
  });

  wrapper.append(title, list);

  return wrapper;
}

function createBackupSection({ onExport, onImport, onClear }) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const description = document.createElement("p");
  const actions = document.createElement("div");
  const exportButton = document.createElement("button");
  const importButton = document.createElement("button");
  const clearButton = document.createElement("button");
  const fileInput = document.createElement("input");

  section.className = "settings-card settings-backup";
  header.className = "settings-card__header";
  title.className = "settings-card__title";
  title.textContent = "Backup e segurança";
  description.className = "settings-card__description";
  description.textContent = "Exporte seus dados para evitar perdas ou restaure um backup salvo.";

  actions.className = "settings-backup__actions";

  exportButton.className = "button button--primary";
  exportButton.type = "button";
  exportButton.textContent = "Exportar backup";
  exportButton.addEventListener("click", onExport);

  importButton.className = "button button--secondary";
  importButton.type = "button";
  importButton.textContent = "Importar backup";
  importButton.addEventListener("click", () => fileInput.click());

  clearButton.className = "button button--danger";
  clearButton.type = "button";
  clearButton.textContent = "Limpar todos os dados";
  clearButton.addEventListener("click", onClear);

  fileInput.type = "file";
  fileInput.accept = "application/json,.json";
  fileInput.hidden = true;
  fileInput.addEventListener("change", () => {
    const [file] = fileInput.files;

    if (file) {
      onImport(file);
      fileInput.value = "";
    }
  });

  header.append(title, description);
  actions.append(exportButton, importButton, clearButton, fileInput);
  section.append(header, actions);

  return section;
}

function createOnlineDatabaseSection({ onTest }) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const description = document.createElement("p");
  const actions = document.createElement("div");
  const testButton = document.createElement("button");

  section.className = "settings-card";
  header.className = "settings-card__header";
  title.className = "settings-card__title";
  title.textContent = "Banco online";
  description.className = "settings-card__description";
  description.textContent = "Teste a conexão com o Supabase antes de ativar a sincronização.";

  actions.className = "settings-actions";

  testButton.className = "button button--secondary";
  testButton.type = "button";
  testButton.textContent = "Testar conexão Supabase";
  testButton.addEventListener("click", onTest);

  header.append(title, description);
  actions.append(testButton);
  section.append(header, actions);

  return section;
}

function createMessageAutomationSection({ onSendMessage, onSaveSettings }) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const description = document.createElement("p");
  const settings = getMessageAutomationSettings();
  const reservations = getReservasForMessageAutomation();
  const history = getMessageAutomationHistory();
  const controls = document.createElement("div");
  const checkInToggle = createAutomationToggle({
    name: "checkInEnabled",
    label: "Ativar mensagem automática de check-in",
    checked: settings.checkInEnabled,
  });
  const checkOutToggle = createAutomationToggle({
    name: "checkOutEnabled",
    label: "Ativar mensagem automática de check-out",
    checked: settings.checkOutEnabled,
  });
  const reservationField = document.createElement("label");
  const reservationLabel = document.createElement("span");
  const reservationSelect = document.createElement("select");
  const actions = document.createElement("div");
  const saveButton = document.createElement("button");
  const checkInButton = document.createElement("button");
  const checkOutButton = document.createElement("button");
  const historyWrapper = document.createElement("div");
  const historyTitle = document.createElement("h4");
  const historyList = document.createElement("div");

  section.className = "settings-card message-automation";
  header.className = "settings-card__header";
  title.className = "settings-card__title";
  title.textContent = "Automação de Mensagens";
  description.className = "settings-card__description";
  description.textContent = "Configure lembretes de check-in e check-out e envie mensagens manuais pelo WhatsApp.";
  controls.className = "message-automation__controls";

  reservationField.className = "settings-field settings-field--wide";
  reservationLabel.textContent = "Reserva para envio manual";
  reservationSelect.name = "messageAutomationReservation";

  if (reservations.length) {
    reservations.forEach((reservation) => {
      const option = document.createElement("option");
      option.value = reservation.id;
      option.textContent = `${formatDate(reservation.dataEntrada)} ${reservation.horaEntrada || ""} - ${reservation.clientName}`;
      reservationSelect.append(option);
    });
  } else {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Nenhuma reserva cadastrada";
    reservationSelect.append(option);
  }

  actions.className = "message-automation__actions";
  saveButton.className = "button button--primary";
  saveButton.type = "button";
  saveButton.textContent = "Salvar automação";
  saveButton.addEventListener("click", () => {
    onSaveSettings({
      checkInEnabled: checkInToggle.input.checked,
      checkOutEnabled: checkOutToggle.input.checked,
    });
  });

  checkInButton.className = "button button--secondary";
  checkInButton.type = "button";
  checkInButton.textContent = "Enviar boas-vindas";
  checkInButton.disabled = !reservations.length;
  checkInButton.addEventListener("click", () => {
    onSendMessage({ reservationId: reservationSelect.value, type: "checkin" });
  });

  checkOutButton.className = "button button--secondary";
  checkOutButton.type = "button";
  checkOutButton.textContent = "Enviar mensagem de saída";
  checkOutButton.disabled = !reservations.length;
  checkOutButton.addEventListener("click", () => {
    onSendMessage({ reservationId: reservationSelect.value, type: "checkout" });
  });

  historyWrapper.className = "message-automation__history";
  historyTitle.textContent = "Histórico de envios";
  historyList.className = "message-automation__history-list";

  if (history.length) {
    history.slice(0, 8).forEach((entry) => {
      const item = document.createElement("div");
      const label = document.createElement("strong");
      const meta = document.createElement("span");

      item.className = "message-automation__history-item";
      label.textContent = `${entry.type === "checkout" ? "Check-out" : "Check-in"} enviado`;
      meta.textContent = `${entry.clientName} - ${formatDateTime(entry.sentAt)} (${entry.mode || "manual"})`;
      item.append(label, meta);
      historyList.append(item);
    });
  } else {
    const empty = document.createElement("p");
    empty.className = "message-automation__empty";
    empty.textContent = "Nenhuma mensagem enviada ainda.";
    historyList.append(empty);
  }

  header.append(title, description);
  controls.append(checkInToggle.wrapper, checkOutToggle.wrapper);
  reservationField.append(reservationLabel, reservationSelect);
  actions.append(saveButton, checkInButton, checkOutButton);
  historyWrapper.append(historyTitle, historyList);
  section.append(header, controls, reservationField, actions, historyWrapper);

  return section;
}

function createAutomationToggle({ name, label, checked }) {
  const wrapper = document.createElement("label");
  const input = document.createElement("input");
  const visual = document.createElement("span");
  const text = document.createElement("span");

  wrapper.className = "message-automation__toggle";
  input.type = "checkbox";
  input.name = name;
  input.checked = checked;
  visual.className = "message-automation__switch";
  text.textContent = label;
  wrapper.append(input, visual, text);

  return { wrapper, input };
}

function createAdminAccessSection(feedback) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const description = document.createElement("p");
  const grid = document.createElement("div");
  const currentUserField = createField({
    key: "currentAdminUser",
    label: "Usuário atual",
    type: "text",
  });
  const currentPasswordField = createField({
    key: "currentAdminPassword",
    label: "Senha atual",
    type: "password",
  });
  const newUserField = createField({
    key: "newAdminUser",
    label: "Novo usuário",
    type: "text",
  });
  const newPasswordField = createField({
    key: "newAdminPassword",
    label: "Nova senha",
    type: "password",
  });
  const confirmPasswordField = createField({
    key: "confirmAdminPassword",
    label: "Confirmar nova senha",
    type: "password",
  });
  const actions = document.createElement("div");
  const saveButton = document.createElement("button");

  section.className = "settings-card";
  header.className = "settings-card__header";
  title.className = "settings-card__title";
  title.textContent = "Acesso do administrador";
  description.className = "settings-card__description";
  description.textContent = "Atualize o usuário e a senha usados para entrar no sistema.";

  grid.className = "settings-card__grid";
  grid.append(
    currentUserField.wrapper,
    currentPasswordField.wrapper,
    newUserField.wrapper,
    newPasswordField.wrapper,
    confirmPasswordField.wrapper,
  );

  actions.className = "settings-actions";
  saveButton.className = "button button--primary";
  saveButton.type = "button";
  saveButton.textContent = "Salvar novo acesso";
  saveButton.addEventListener("click", () => {
    const currentUser = currentUserField.input.value.trim();
    const currentPassword = currentPasswordField.input.value;
    const newUser = newUserField.input.value.trim();
    const newPassword = newPasswordField.input.value;
    const confirmPassword = confirmPasswordField.input.value;
    const storedUser = window.localStorage.getItem(ADMIN_USER_KEY);
    const storedPassword = window.localStorage.getItem(ADMIN_PASSWORD_KEY);

    if (currentUser !== storedUser || currentPassword !== storedPassword) {
      showFeedback(feedback, "Usuário atual ou senha atual incorretos.");
      return;
    }

    if (!newUser || !newPassword || !confirmPassword) {
      showFeedback(feedback, "Novo usuário e nova senha são obrigatórios.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showFeedback(feedback, "A nova senha e a confirmação devem ser iguais.");
      return;
    }

    window.localStorage.setItem(ADMIN_USER_KEY, newUser);
    window.localStorage.setItem(ADMIN_PASSWORD_KEY, newPassword);
    [
      currentUserField.input,
      currentPasswordField.input,
      newUserField.input,
      newPasswordField.input,
      confirmPasswordField.input,
    ].forEach((input) => {
      input.value = "";
    });
    showFeedback(feedback, "Acesso atualizado com sucesso.");
  });

  actions.append(saveButton);
  section.append(header, grid, actions);

  return section;
}

function fillFields(fields, settings) {
  fields.forEach((input, key) => {
    input.value = settings[key] ?? "";
  });
}

function readSettings(fields) {
  return Object.fromEntries(
    Array.from(fields.entries()).map(([key, input]) => [key, input.value.trim()]),
  );
}

function showFeedback(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function getStoredSettings() {
  return { ...defaultSettings, ...getSettings() };
}

function saveStoredSettings(settings) {
  saveSettings(settings);
}

async function createBackupData(settings) {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    clientes: getClients(),
    reservas: getReservations(),
    financeiro: getFinance(),
    contratosGerados: getContracts(),
    modelosContrato: (await getContractTemplates()).map((template) => ({ ...template })),
    configuracoes: { ...settings },
    assinaturaProprietario: readStoredValue(OWNER_SIGNATURE_STORAGE_KEY, null),
  };
}

function downloadBackup(backup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `backup-sitio-sao-jorge-${getTodayKey()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function applyBackupData(backup) {
  saveClients(backup.clientes);
  saveReservations(backup.reservas);
  saveFinance(backup.financeiro);
  saveContracts(backup.contratosGerados);
  saveSettings(backup.configuracoes);
  await saveContractTemplatesBackup(backup.modelosContrato);

  if (backup.assinaturaProprietario) {
    window.localStorage.setItem(OWNER_SIGNATURE_STORAGE_KEY, JSON.stringify(backup.assinaturaProprietario));
  } else {
    window.localStorage.removeItem(OWNER_SIGNATURE_STORAGE_KEY);
  }
}

function validateBackupDataStrict(backup) {
  const isValid = backup
    && typeof backup === "object"
    && !Array.isArray(backup)
    && Array.isArray(backup.clientes)
    && Array.isArray(backup.reservas)
    && backup.financeiro
    && typeof backup.financeiro === "object"
    && !Array.isArray(backup.financeiro)
    && Array.isArray(backup.contratosGerados)
    && Array.isArray(backup.modelosContrato)
    && backup.configuracoes
    && typeof backup.configuracoes === "object"
    && !Array.isArray(backup.configuracoes);

  return isValid ? "" : "Arquivo de backup inválido";
}

function validateBackupData(backup) {
  if (!backup || typeof backup !== "object" || Array.isArray(backup)) {
    return "Arquivo de backup inválido.";
  }

  if (!Array.isArray(backup.clientes)) {
    return "Arquivo inválido: clientes não encontrados.";
  }

  if (!Array.isArray(backup.reservas)) {
    return "Arquivo inválido: reservas não encontradas.";
  }

  if (!backup.financeiro || typeof backup.financeiro !== "object" || Array.isArray(backup.financeiro)) {
    return "Arquivo inválido: financeiro não encontrado.";
  }

  if (!Array.isArray(backup.contratosGerados)) {
    return "Arquivo inválido: contratos gerados não encontrados.";
  }

  if (!Array.isArray(backup.modelosContrato)) {
    return "Arquivo inválido: modelos de contrato não encontrados.";
  }

  if (!backup.configuracoes || typeof backup.configuracoes !== "object" || Array.isArray(backup.configuracoes)) {
    return "Arquivo inválido: configurações não encontradas.";
  }

  return "";
}

function readStoredList(key) {
  const value = readStoredValue(key, []);

  return Array.isArray(value) ? value : [];
}

function readStoredValue(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key);

    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) {
    return "Data não informada";
  }

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  if (!value) {
    return "Data não informada";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
