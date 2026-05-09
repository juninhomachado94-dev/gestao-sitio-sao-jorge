import {
  deleteClient as deleteStoredClient,
  getClients,
  getContracts,
  getFinance,
  getReservations,
  saveClients,
} from "../../services/dataService.js";
import { getCheckoutChecklists, getCheckoutOccurrences } from "../../services/checkoutService.js";
import { formatCurrency } from "../../services/privacyService.js";

const emptyClient = {
  name: "",
  phone: "",
  document: "",
  address: "",
  city: "",
  notes: "",
};

export function createClientsPage() {
  let clients = getStoredClients();
  let editingClientId = null;

  const page = document.createElement("section");
  const header = createHeader();
  const tableHost = document.createElement("div");
  const modal = createClientModal({
    onSubmit: saveClient,
    onClose: closeModal,
  });
  const historyModal = createClientHistoryModal({
    onClose: closeHistoryModal,
  });

  page.className = "clients-page";
  page.setAttribute("aria-labelledby", "clients-title");
  tableHost.className = "clients-page__table-host";

  page.append(header.element, tableHost, modal.element, historyModal.element);

  renderClients();

  return page;

  function renderClients() {
    tableHost.replaceChildren(createClientsTable({
      clients,
      onEdit: openEditModal,
      onDelete: deleteClient,
      onHistory: openHistoryModal,
    }));
  }

  function openCreateModal() {
    editingClientId = null;
    modal.open({
      title: "Novo cliente",
      client: emptyClient,
    });
  }

  function openEditModal(clientId) {
    const client = clients.find((item) => item.id === clientId);

    if (!client) {
      return;
    }

    editingClientId = clientId;
    modal.open({
      title: "Editar cliente",
      client,
    });
  }

  function closeModal() {
    editingClientId = null;
    modal.close();
  }

  function openHistoryModal(clientId) {
    const client = clients.find((item) => item.id === clientId);

    if (!client) {
      return;
    }

    historyModal.open({
      client,
      history: buildClientHistory(client, {
        reservations: getReservations(),
        finance: getFinance(),
        contracts: getContracts(),
        checklists: getCheckoutChecklists(),
        occurrences: getCheckoutOccurrences(),
      }),
    });
  }

  function closeHistoryModal() {
    historyModal.close();
  }

  function saveClient(formData) {
    if (editingClientId) {
      clients = clients.map((client) => (
        client.id === editingClientId ? { ...client, ...formData } : client
      ));
    } else {
      clients = [
        {
          id: crypto.randomUUID(),
          ...formData,
        },
        ...clients,
      ];
    }

    saveStoredClients(clients);
    closeModal();
    renderClients();
  }

  function deleteClient(clientId) {
    const shouldDelete = window.confirm("Tem certeza que deseja excluir este cliente?");

    if (!shouldDelete) {
      return;
    }

    clients = clients.filter((client) => client.id !== clientId);
    deleteStoredClient(clientId);
    renderClients();
  }

  function createHeader() {
    const wrapper = document.createElement("div");
    const textGroup = document.createElement("div");
    const kicker = document.createElement("p");
    const title = document.createElement("h2");
    const intro = document.createElement("p");
    const button = document.createElement("button");

    wrapper.className = "clients-page__header";
    textGroup.className = "clients-page__header-text";

    kicker.className = "page-panel__kicker";
    kicker.textContent = "Sítio São Jorge";

    title.className = "clients-page__title";
    title.id = "clients-title";
    title.textContent = "Clientes";

    intro.className = "clients-page__intro";
    intro.textContent = "Cadastro de clientes e informações de contato.";

    button.className = "button button--primary";
    button.type = "button";
    button.textContent = "Novo cliente";
    button.addEventListener("click", openCreateModal);

    textGroup.append(kicker, title, intro);
    wrapper.append(textGroup, button);

    return { element: wrapper };
  }
}

function getStoredClients() {
  return getClients();
}

function saveStoredClients(clients) {
  saveClients(clients);
}

function createClientsTable({ clients, onEdit, onDelete, onHistory }) {
  const section = document.createElement("section");
  const wrapper = document.createElement("div");
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  const headers = ["Nome", "Telefone/WhatsApp", "CPF/CNPJ", "Cidade", "Observações", "Ações"];

  section.className = "clients-table";
  wrapper.className = "clients-table__wrapper";

  const headerRow = document.createElement("tr");
  headers.forEach((label) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headerRow.append(th);
  });

  thead.append(headerRow);

  if (!clients.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = headers.length;
    cell.textContent = "Nenhum cliente cadastrado";
    row.append(cell);
    tbody.append(row);
  }

  clients.forEach((client) => {
    const row = document.createElement("tr");
    const values = [
      client.name,
      client.phone,
      client.document || "Não informado",
      client.city,
      client.notes,
    ];

    values.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      row.append(td);
    });

    const actions = document.createElement("td");
    const actionsGroup = document.createElement("div");
    const historyButton = document.createElement("button");
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    actionsGroup.className = "clients-table__actions";

    historyButton.className = "button button--secondary";
    historyButton.type = "button";
    historyButton.textContent = "Histórico";
    historyButton.addEventListener("click", () => onHistory(client.id));

    editButton.className = "button button--secondary";
    editButton.type = "button";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", () => onEdit(client.id));

    deleteButton.className = "button button--danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Excluir";
    deleteButton.addEventListener("click", () => onDelete(client.id));

    actionsGroup.append(historyButton, editButton, deleteButton);
    actions.append(actionsGroup);
    row.append(actions);
    tbody.append(row);
  });

  table.append(thead, tbody);
  wrapper.append(table);
  section.append(wrapper);

  return section;
}

function createClientModal({ onSubmit, onClose }) {
  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const closeButton = document.createElement("button");
  const form = document.createElement("form");
  const error = document.createElement("p");
  const fields = {
    name: createField("Nome", "name", "text"),
    phone: createField("Telefone/WhatsApp", "phone", "tel"),
    document: createField("CPF/CNPJ", "document", "text"),
    address: createField("Endereço", "address", "text"),
    city: createField("Cidade", "city", "text"),
    notes: createField("Observações", "notes", "textarea"),
  };
  const actions = document.createElement("div");
  const cancelButton = document.createElement("button");
  const submitButton = document.createElement("button");

  overlay.className = "client-modal";
  overlay.hidden = true;

  dialog.className = "client-modal__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "client-modal-title");

  header.className = "client-modal__header";
  title.className = "client-modal__title";
  title.id = "client-modal-title";

  closeButton.className = "client-modal__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Fechar formulário");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);

  form.className = "client-form";
  form.noValidate = true;

  error.className = "client-form__error";
  error.hidden = true;

  Object.values(fields).forEach((field) => form.append(field.wrapper));

  actions.className = "client-form__actions";

  cancelButton.className = "button button--secondary";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", onClose);

  submitButton.className = "button button--primary";
  submitButton.type = "submit";
  submitButton.textContent = "Salvar cliente";

  actions.append(cancelButton, submitButton);
  form.append(error, actions);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = readFormData(fields);
    const validationMessage = validateClient(formData);

    if (validationMessage) {
      error.textContent = validationMessage;
      error.hidden = false;
      return;
    }

    error.hidden = true;
    onSubmit(formData);
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      onClose();
    }
  });

  header.append(title, closeButton);
  dialog.append(header, form);
  overlay.append(dialog);

  return {
    element: overlay,
    open({ title: nextTitle, client }) {
      title.textContent = nextTitle;
      error.hidden = true;
      fillForm(fields, client);
      overlay.hidden = false;
      fields.name.input.focus();
    },
    close() {
      overlay.hidden = true;
      form.reset();
    },
  };
}

function createClientHistoryModal({ onClose }) {
  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const closeButton = document.createElement("button");
  const body = document.createElement("div");

  overlay.className = "client-history-modal";
  overlay.hidden = true;
  dialog.className = "client-history-modal__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "client-history-title");
  header.className = "client-history-modal__header";
  title.className = "client-history-modal__title";
  title.id = "client-history-title";
  closeButton.className = "client-history-modal__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Fechar histórico");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);
  body.className = "client-history-modal__body";

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      onClose();
    }
  });

  header.append(title, closeButton);
  dialog.append(header, body);
  overlay.append(dialog);

  return {
    element: overlay,
    open({ client, history }) {
      title.textContent = `Histórico - ${client.name}`;
      body.replaceChildren(createClientHistoryContent(client, history));
      overlay.hidden = false;
    },
    close() {
      overlay.hidden = true;
      body.replaceChildren();
    },
  };
}

function createClientHistoryContent(client, history) {
  const fragment = document.createDocumentFragment();
  const profile = document.createElement("section");
  const profileGrid = document.createElement("div");
  const summaryGrid = document.createElement("div");

  profile.className = "client-history-profile";
  profileGrid.className = "client-history-profile__grid";
  profileGrid.append(
    createInfoItem("Nome", client.name || "Não informado"),
    createInfoItem("Telefone/WhatsApp", client.phone || "Não informado"),
    createInfoItem("CPF/CNPJ", client.document || "Não informado"),
    createInfoItem("Cidade", client.city || "Não informado"),
    createInfoItem("Endereço", client.address || "Não informado"),
    createInfoItem("Observações", client.notes || "Sem observações"),
  );
  profile.append(createSectionTitle("Dados do cliente"), profileGrid);

  summaryGrid.className = "client-history-summary";
  summaryGrid.append(
    createHistoryMetric("Total de reservas", String(history.summary.totalReservations)),
    createHistoryMetric("Total gasto", formatCurrency(history.summary.totalSpent)),
    createHistoryMetric("Total pendente", formatCurrency(history.summary.totalPending), history.summary.totalPending > 0 ? "warning" : "success"),
    createHistoryMetric("Ocorrências", String(history.summary.occurrencesCount), history.summary.occurrencesCount > 0 ? "danger" : "success"),
    createHistoryMetric("Prejuízo total", formatCurrency(history.summary.totalDamage), history.summary.totalDamage > 0 ? "danger" : "success"),
    createHistoryMetric("Última reserva", history.summary.lastReservation || "Nenhuma"),
  );

  fragment.append(profile, summaryGrid);

  if (history.occurrences.length) {
    const alert = document.createElement("div");
    alert.className = "client-history-alert";
    alert.textContent = "Cliente possui ocorrências anteriores";
    fragment.append(alert);
  }

  fragment.append(
    createHistoryListSection("Reservas vinculadas", history.reservations, renderReservationHistoryItem, "Nenhuma reserva vinculada"),
    createHistoryListSection("Contratos gerados", history.contracts, renderContractHistoryItem, "Nenhum contrato gerado"),
    createHistoryListSection("Pagamentos recebidos", history.receivedPayments, renderFinanceHistoryItem, "Nenhum pagamento recebido"),
    createHistoryListSection("Valores pendentes", history.pendingPayments, renderFinanceHistoryItem, "Nenhum valor pendente"),
    createHistoryListSection("Ocorrências registradas", history.occurrences, renderOccurrenceHistoryItem, "Nenhuma ocorrência registrada"),
    createHistoryListSection("Checklists de saída", history.checklists, renderChecklistHistoryItem, "Nenhum checklist registrado"),
    createHistoryListSection("Mensagens enviadas", history.messages, renderMessageHistoryItem, "Nenhum histórico de mensagens encontrado"),
  );

  return fragment;
}

function buildClientHistory(client, { reservations, finance, contracts, checklists, occurrences }) {
  const clientReservations = normalizeList(reservations)
    .filter((reservation) => isSameClient(client, reservation))
    .sort((first, second) => buildDate(second.dataEntrada) - buildDate(first.dataEntrada));
  const reservationIds = new Set(clientReservations.map((reservation) => reservation.id));
  const allFinanceEntries = [
    ...normalizeFinance(finance).revenues,
    ...normalizeFinance(finance).fixedExpenses,
    ...normalizeFinance(finance).variableExpenses,
  ];
  const clientFinanceEntries = allFinanceEntries.filter((entry) => (
    entry.clientId === client.id
    || reservationIds.has(entry.reservationId)
    || normalizeText(entry.clientName) === normalizeText(client.name)
  ));
  const receivedPayments = clientFinanceEntries.filter((entry) => (
    ["recebido", "pago"].includes(entry.status)
    && getFinanceEntryValue(entry) > 0
  ));
  const pendingPayments = clientFinanceEntries.filter((entry) => (
    entry.status === "pendente"
    && getFinanceEntryValue(entry) > 0
  ));
  const clientContracts = normalizeList(contracts).filter((contract) => (
    contract.clientId === client.id
    || reservationIds.has(contract.reservationId)
    || normalizeText(contract.clientName || contract.client) === normalizeText(client.name)
  ));
  const clientOccurrences = normalizeList(occurrences).filter((occurrence) => (
    occurrence.clientId === client.id
    || reservationIds.has(occurrence.reservationId)
  ));
  const clientChecklists = normalizeList(checklists).filter((checklist) => (
    checklist.clientId === client.id
    || reservationIds.has(checklist.reservationId)
  ));
  const totalSpent = receivedPayments.reduce((sum, entry) => sum + getFinanceEntryValue(entry), 0);
  const totalPending = pendingPayments.reduce((sum, entry) => sum + getFinanceEntryValue(entry), 0);
  const totalDamage = clientOccurrences.reduce((sum, occurrence) => sum + Number(occurrence.damageValue || 0), 0);
  const lastReservation = clientReservations[0];

  return {
    reservations: clientReservations,
    contracts: clientContracts,
    receivedPayments,
    pendingPayments,
    occurrences: clientOccurrences,
    checklists: clientChecklists,
    messages: [],
    summary: {
      totalReservations: clientReservations.length,
      totalSpent,
      totalPending,
      occurrencesCount: clientOccurrences.length,
      totalDamage,
      lastReservation: lastReservation ? formatDate(lastReservation.dataEntrada) : "",
    },
  };
}

function createSectionTitle(text) {
  const title = document.createElement("h4");
  title.className = "client-history-section__title";
  title.textContent = text;
  return title;
}

function createInfoItem(label, value) {
  const item = document.createElement("article");
  const labelElement = document.createElement("span");
  const valueElement = document.createElement("strong");

  item.className = "client-history-info";
  labelElement.textContent = label;
  valueElement.textContent = value;
  item.append(labelElement, valueElement);
  return item;
}

function createHistoryMetric(label, value, tone = "neutral") {
  const card = document.createElement("article");
  const labelElement = document.createElement("span");
  const valueElement = document.createElement("strong");

  card.className = `client-history-metric client-history-metric--${tone}`;
  labelElement.textContent = label;
  valueElement.textContent = value;
  card.append(labelElement, valueElement);
  return card;
}

function createHistoryListSection(title, items, renderItem, emptyMessage) {
  const section = document.createElement("section");
  const list = document.createElement("div");

  section.className = "client-history-section";
  list.className = "client-history-list";
  section.append(createSectionTitle(title));

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "client-history-empty";
    empty.textContent = emptyMessage;
    section.append(empty);
    return section;
  }

  items.forEach((item) => list.append(renderItem(item)));
  section.append(list);
  return section;
}

function renderReservationHistoryItem(reservation) {
  return createHistoryListItem({
    title: `${formatDate(reservation.dataEntrada)} - ${reservation.eventType || "Evento não informado"}`,
    meta: `${formatDateTime(reservation.dataEntrada, reservation.horaEntrada)} até ${formatDateTime(reservation.dataSaida, reservation.horaSaida)}`,
    value: formatCurrency(reservation.totalValue),
    status: reservation.reservationStatus || "Não informado",
  });
}

function renderContractHistoryItem(contract) {
  return createHistoryListItem({
    title: contract.clientName || contract.client || "Contrato",
    meta: contract.generatedAt ? `Gerado em ${formatDateFromIso(contract.generatedAt)}` : "Data não informada",
    value: contract.status || "gerado",
    status: contract.clientSignature ? "Assinado" : "Assinatura pendente",
  });
}

function renderFinanceHistoryItem(entry) {
  return createHistoryListItem({
    title: entry.description || entry.reference || "Lançamento financeiro",
    meta: formatDate(getFinanceEntryDate(entry)),
    value: formatCurrency(getFinanceEntryValue(entry)),
    status: entry.status || "Não informado",
  });
}

function renderOccurrenceHistoryItem(occurrence) {
  return createHistoryListItem({
    title: occurrence.title || "Ocorrência",
    meta: `${formatOccurrenceType(occurrence.type)} - ${formatDate(occurrence.occurrenceDate)}`,
    value: formatCurrency(occurrence.damageValue),
    status: occurrence.responsibleUser || "Responsável não informado",
  });
}

function renderChecklistHistoryItem(checklist) {
  return createHistoryListItem({
    title: `Checklist ${checklist.status || "pendente"}`,
    meta: checklist.finalizedAt ? `Finalizado em ${formatDateFromIso(checklist.finalizedAt)}` : "Ainda não finalizado",
    value: countCheckedItems(checklist.items),
    status: checklist.responsibleUser || "Responsável não informado",
  });
}

function renderMessageHistoryItem(message) {
  return createHistoryListItem({
    title: message.title || "Mensagem",
    meta: message.sentAt ? formatDateFromIso(message.sentAt) : "Data não informada",
    value: message.channel || "WhatsApp",
    status: message.status || "Enviada",
  });
}

function createHistoryListItem({ title, meta, value, status }) {
  const item = document.createElement("article");
  const text = document.createElement("div");
  const titleElement = document.createElement("strong");
  const metaElement = document.createElement("span");
  const side = document.createElement("div");
  const valueElement = document.createElement("strong");
  const statusElement = document.createElement("small");

  item.className = "client-history-item";
  text.className = "client-history-item__text";
  side.className = "client-history-item__side";
  titleElement.textContent = title;
  metaElement.textContent = meta;
  valueElement.textContent = value;
  statusElement.textContent = status;

  text.append(titleElement, metaElement);
  side.append(valueElement, statusElement);
  item.append(text, side);
  return item;
}

function createField(label, name, type, options = []) {
  const wrapper = document.createElement("label");
  const labelText = document.createElement("span");
  const input = createFieldControl(type, options);

  wrapper.className = "client-form__field";
  labelText.textContent = label;
  input.name = name;

  if (type === "textarea") {
    input.rows = 4;
  } else if (type !== "select") {
    input.type = type;
  }

  wrapper.append(labelText, input);

  return { wrapper, input };
}

function createFieldControl(type, options) {
  if (type === "textarea") {
    return document.createElement("textarea");
  }

  if (type === "select") {
    const select = document.createElement("select");
    const emptyOption = document.createElement("option");

    emptyOption.value = "";
    emptyOption.textContent = "Selecione uma opção";
    select.append(emptyOption);

    options.forEach((option) => {
      const optionElement = document.createElement("option");

      optionElement.value = option;
      optionElement.textContent = option;
      select.append(optionElement);
    });

    return select;
  }

  return document.createElement("input");
}

function fillForm(fields, client) {
  Object.entries(fields).forEach(([key, field]) => {
    field.input.value = client[key] ?? "";
  });
}

function readFormData(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [key, field.input.value.trim()]),
  );
}

function validateClient(client) {
  if (!client.name) {
    return "Nome é obrigatório.";
  }

  if (!client.phone) {
    return "Telefone/WhatsApp é obrigatório.";
  }

  return "";
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeFinance(finance = {}) {
  return {
    revenues: Array.isArray(finance.revenues) ? finance.revenues : [],
    fixedExpenses: Array.isArray(finance.fixedExpenses) ? finance.fixedExpenses : [],
    variableExpenses: Array.isArray(finance.variableExpenses) ? finance.variableExpenses : [],
  };
}

function isSameClient(client, item) {
  return item.clientId === client.id
    || item.client_id === client.id
    || normalizeText(item.clientName || item.client || item.nomeCliente) === normalizeText(client.name);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getFinanceEntryValue(entry) {
  return Number(entry.value ?? entry.amount ?? 0);
}

function getFinanceEntryDate(entry) {
  return entry.paymentDate
    || entry.payment_date
    || entry.dueDate
    || entry.due_date
    || entry.date
    || entry.dataEntrada
    || entry.createdAt
    || entry.created_at
    || "";
}

function countCheckedItems(items = {}) {
  const total = Object.values(items).filter(Boolean).length;
  return `${total}/9 concluídos`;
}

function formatOccurrenceType(type) {
  return String(type || "outros").replace(/^./, (char) => char.toUpperCase());
}

function formatDateTime(date, time) {
  if (!date || !time) {
    return "Não informado";
  }

  return `${formatDate(date)} ${time}`;
}

function formatDate(value) {
  if (!value) {
    return "Não informado";
  }

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return "Não informado";
  }

  return `${day}/${month}/${year}`;
}

function formatDateFromIso(value) {
  if (!value) {
    return "Não informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildDate(value) {
  return value ? new Date(`${value}T00:00:00`) : new Date(0);
}
