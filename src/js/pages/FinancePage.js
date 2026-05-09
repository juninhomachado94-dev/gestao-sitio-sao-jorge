import { createStatusBadge, getStatusClass } from "../components/StatusBadge.js";
import { getFinanceData, saveFinanceData } from "./financeStore.js";
import { formatCurrency } from "../../services/privacyService.js";
import {
  calculateFixedExpensesSummary,
  deleteFixedExpense,
  getFixedExpenses,
  markFixedExpenseAsPaid,
  saveFixedExpense,
} from "../../services/fixedExpensesService.js";

const fixedCategories = ["Energia", "Água", "Internet", "Funcionário", "Manutenção mensal", "Outros"];
const recurringFixedCategories = ["energia", "água", "internet", "funcionário", "manutenção", "assinatura", "imposto", "limpeza", "outros"];
const recurrenceOptions = ["semanal", "mensal", "anual"];
const variableCategories = [
  "Limpeza",
  "Produtos de limpeza",
  "Gás",
  "Piscina",
  "Manutenção específica",
  "Danos/quebras",
  "Compra para evento",
  "Outros",
];
const paymentMethods = ["Pix", "Dinheiro", "Cartão", "Transferência", "Outro"];
const revenueStatuses = ["recebido", "pendente"];
const expenseStatuses = ["pago", "pendente"];
const yesNoOptions = ["sim", "não"];

const financeSections = {
  recurringFixedExpenses: {
    title: "Contas Fixas",
    buttonLabel: "Nova conta fixa",
    confirmMessage: "Tem certeza que deseja excluir esta conta fixa?",
    columns: ["Nome da conta", "Categoria", "Valor", "Vencimento", "Recorrência", "Status", "Ações"],
    fields: [
      { key: "name", label: "Nome da conta", type: "text" },
      { key: "category", label: "Categoria", type: "select", options: recurringFixedCategories },
      { key: "amount", label: "Valor", type: "number" },
      { key: "dueDate", label: "Vencimento", type: "date" },
      { key: "recurrence", label: "Recorrência", type: "select", options: recurrenceOptions },
      { key: "notes", label: "Observação", type: "text" },
      { key: "status", label: "Status", type: "select", options: expenseStatuses },
    ],
    emptyItem: {
      name: "",
      category: "",
      amount: "",
      dueDate: "",
      recurrence: "mensal",
      notes: "",
      status: "pendente",
    },
  },
  revenues: {
    title: "Receitas",
    buttonLabel: "Nova receita",
    confirmMessage: "Tem certeza que deseja excluir esta receita?",
    columns: ["Descrição", "Cliente/reserva", "Data", "Valor", "Forma de pagamento", "Status", "Ações"],
    fields: [
      { key: "description", label: "Descrição", type: "text" },
      { key: "reference", label: "Cliente/reserva", type: "text" },
      { key: "date", label: "Data", type: "date" },
      { key: "value", label: "Valor", type: "number" },
      { key: "paymentMethod", label: "Forma de pagamento", type: "select", options: paymentMethods },
      { key: "status", label: "Status", type: "select", options: revenueStatuses },
    ],
    emptyItem: {
      description: "",
      reference: "",
      date: "",
      value: "",
      paymentMethod: "",
      status: "pendente",
    },
  },
  fixedExpenses: {
    title: "Gastos fixos",
    buttonLabel: "Novo gasto fixo",
    confirmMessage: "Tem certeza que deseja excluir este gasto fixo?",
    columns: ["Descrição", "Categoria", "Vencimento", "Valor", "Status", "Ações"],
    fields: [
      { key: "description", label: "Descrição", type: "text" },
      { key: "category", label: "Categoria", type: "select", options: fixedCategories },
      { key: "dueDate", label: "Vencimento", type: "date" },
      { key: "value", label: "Valor", type: "number" },
      { key: "status", label: "Status", type: "select", options: expenseStatuses },
    ],
    emptyItem: {
      description: "",
      category: "",
      dueDate: "",
      value: "",
      status: "pendente",
    },
  },
  variableExpenses: {
    title: "Gastos variáveis",
    buttonLabel: "Novo gasto variável",
    confirmMessage: "Tem certeza que deseja excluir este gasto variável?",
    columns: ["Descrição", "Categoria", "Data", "Valor", "Vinculado à reserva?", "Status", "Ações"],
    fields: [
      { key: "description", label: "Descrição", type: "text" },
      { key: "category", label: "Categoria", type: "select", options: variableCategories },
      { key: "date", label: "Data", type: "date" },
      { key: "value", label: "Valor", type: "number" },
      { key: "linkedToReservation", label: "Vinculado à reserva?", type: "select", options: yesNoOptions },
      { key: "status", label: "Status", type: "select", options: expenseStatuses },
    ],
    emptyItem: {
      description: "",
      category: "",
      date: "",
      value: "",
      linkedToReservation: "não",
      status: "pendente",
    },
  },
};

export function createFinancePage() {
  let finance = getFinanceData();
  let fixedAccounts = getFixedExpenses();
  let activeSection = "revenues";
  let editing = null;
  let selectedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let fixedAccountFilters = { status: "", category: "" };

  const page = document.createElement("section");
  const headerHost = document.createElement("div");
  const summaryHost = document.createElement("div");
  const tabsHost = document.createElement("div");
  const sectionHost = document.createElement("div");
  const modal = createFinanceModal({
    onSubmit: saveItem,
    onClose: closeModal,
  });

  page.className = "finance-page";
  page.setAttribute("aria-labelledby", "finance-title");
  page.append(headerHost, summaryHost, tabsHost, sectionHost, modal.element);

  render();

  return page;

  function render() {
    const visibleFinance = filterFinanceByMonth(finance, selectedMonth);
    const monthFixedAccounts = fixedAccounts.filter((item) => isEntryInMonth({ dueDate: item.dueDate }, selectedMonth));
    const visibleFixedAccounts = filterFixedAccounts(monthFixedAccounts, fixedAccountFilters);

    headerHost.replaceChildren(createHeader({
      selectedMonth,
      onPreviousMonth() {
        selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
        render();
      },
      onCurrentMonth() {
        const today = new Date();
        selectedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        render();
      },
      onNextMonth() {
        selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
        render();
      },
    }));
    summaryHost.replaceChildren(createSummary(visibleFinance, monthFixedAccounts, selectedMonth));
    tabsHost.replaceChildren(createTabs(activeSection, (sectionKey) => {
      activeSection = sectionKey;
      render();
    }));
    sectionHost.replaceChildren(createFinanceSection({
      sectionKey: activeSection,
      items: activeSection === "recurringFixedExpenses" ? visibleFixedAccounts : visibleFinance[activeSection],
      onCreate: openCreateModal,
      onEdit: openEditModal,
      onDelete: deleteItem,
      onMarkPaid: markAsPaid,
      fixedAccountFilters,
      onFixedAccountFilterChange(nextFilters) {
        fixedAccountFilters = nextFilters;
        render();
      },
    }));
  }

  function openCreateModal(sectionKey) {
    editing = { sectionKey, itemId: null };
    modal.open({
      title: financeSections[sectionKey].buttonLabel,
      sectionKey,
      item: financeSections[sectionKey].emptyItem,
    });
  }

  function openEditModal(sectionKey, itemId) {
    const item = sectionKey === "recurringFixedExpenses"
      ? fixedAccounts.find((entry) => entry.id === itemId)
      : finance[sectionKey].find((entry) => entry.id === itemId);

    if (!item) {
      return;
    }

    editing = { sectionKey, itemId };
    modal.open({
      title: `Editar ${financeSections[sectionKey].title.toLowerCase()}`,
      sectionKey,
      item,
    });
  }

  function closeModal() {
    editing = null;
    modal.close();
  }

  function saveItem(formData) {
    const { sectionKey, itemId } = editing;
    const itemData = {
      ...formData,
      value: Number(formData.value || 0),
      amount: Number(formData.amount || formData.value || 0),
    };

    if (sectionKey === "recurringFixedExpenses") {
      const savedAccount = itemId
        ? { ...fixedAccounts.find((item) => item.id === itemId), ...itemData }
        : { id: `conta-fixa-${Date.now()}`, ...itemData };

      fixedAccounts = itemId
        ? fixedAccounts.map((item) => (item.id === itemId ? savedAccount : item))
        : [savedAccount, ...fixedAccounts];
      saveFixedExpense(savedAccount);
      closeModal();
      render();
      return;
    }

    if (itemId) {
      setFinance({
        ...finance,
        [sectionKey]: finance[sectionKey].map((item) => (
          item.id === itemId ? { ...item, ...itemData } : item
        )),
      });
    } else {
      setFinance({
        ...finance,
        [sectionKey]: [
          {
            id: `${sectionKey}-${Date.now()}`,
            ...itemData,
          },
          ...finance[sectionKey],
        ],
      });
    }

    closeModal();
    render();
  }

  function deleteItem(sectionKey, itemId) {
    const shouldDelete = window.confirm(financeSections[sectionKey].confirmMessage);

    if (!shouldDelete) {
      return;
    }

    if (sectionKey === "recurringFixedExpenses") {
      fixedAccounts = fixedAccounts.filter((item) => item.id !== itemId);
      deleteFixedExpense(itemId);
      render();
      return;
    }

    setFinance({
      ...finance,
      [sectionKey]: finance[sectionKey].filter((item) => item.id !== itemId),
    });
    render();
  }

  function setFinance(nextFinance) {
    finance = nextFinance;
    saveFinanceData(finance);
  }

  async function markAsPaid(sectionKey, itemId) {
    if (sectionKey !== "recurringFixedExpenses") {
      return;
    }

    const account = fixedAccounts.find((item) => item.id === itemId);

    if (!account) {
      return;
    }

    const { paidExpense, nextExpense } = await markFixedExpenseAsPaid(account);
    fixedAccounts = [
      nextExpense,
      ...fixedAccounts.map((item) => (item.id === itemId ? paidExpense : item)),
    ].filter(Boolean);
    syncPaidFixedAccountToFinance(paidExpense);
    render();
  }

  function syncPaidFixedAccountToFinance(account) {
    const entryId = `fixed-expense-${account.id}`;
    const exists = finance.fixedExpenses.some((item) => item.id === entryId);
    const financeEntry = {
      id: entryId,
      description: account.name,
      category: account.category,
      dueDate: account.dueDate,
      value: Number(account.amount || 0),
      status: "pago",
      origin: "conta_fixa",
      fixedExpenseId: account.id,
    };

    setFinance({
      ...finance,
      fixedExpenses: exists
        ? finance.fixedExpenses.map((item) => (item.id === entryId ? { ...item, ...financeEntry } : item))
        : [financeEntry, ...finance.fixedExpenses],
    });
  }
}

function createHeader({ selectedMonth, onPreviousMonth, onCurrentMonth, onNextMonth }) {
  const header = document.createElement("div");
  const textGroup = document.createElement("div");
  const kicker = document.createElement("p");
  const title = document.createElement("h2");
  const intro = document.createElement("p");
  const controls = document.createElement("div");
  const previousButton = document.createElement("button");
  const currentButton = document.createElement("button");
  const nextButton = document.createElement("button");

  header.className = "finance-page__header";
  textGroup.className = "finance-page__header-text";
  kicker.className = "page-panel__kicker";
  kicker.textContent = "Sítio São Jorge";
  title.className = "finance-page__title";
  title.id = "finance-title";
  title.textContent = `Financeiro de ${formatMonthLabel(selectedMonth)}`;
  intro.className = "finance-page__intro";
  intro.textContent = "Controle mensal de receitas, gastos e lucro com dados do sistema.";
  controls.className = "finance-month-controls";

  previousButton.className = "button button--secondary";
  previousButton.type = "button";
  previousButton.textContent = "Mês anterior";
  previousButton.addEventListener("click", onPreviousMonth);

  currentButton.className = "button button--secondary";
  currentButton.type = "button";
  currentButton.textContent = "Mês atual";
  currentButton.addEventListener("click", onCurrentMonth);

  nextButton.className = "button button--secondary";
  nextButton.type = "button";
  nextButton.textContent = "Próximo mês";
  nextButton.addEventListener("click", onNextMonth);

  textGroup.append(kicker, title, intro);
  controls.append(previousButton, currentButton, nextButton);
  header.append(textGroup, controls);

  return header;
}

function createSummary(finance, fixedAccounts, selectedMonth) {
  const summary = calculateSummary(finance);
  const fixedSummary = calculateFixedExpensesSummary(fixedAccounts, selectedMonth);
  const totalExpenses = fixedSummary.paid + summary.paidVariable;
  const netProfit = summary.receivedRevenue - totalExpenses;
  const grid = document.createElement("div");
  const cards = [
    ["Receitas do mês", summary.receivedRevenue],
    ["Contas Fixas", fixedSummary.paid],
    ["Gastos variáveis", summary.paidVariable],
    ["Total de gastos", totalExpenses],
    ["Lucro líquido", netProfit],
    ["Valores pendentes a receber", summary.pendingRevenue],
    ["Total de contas fixas do mês", fixedSummary.total],
    ["Contas fixas pagas", fixedSummary.paid],
    ["Contas fixas pendentes", fixedSummary.pending],
    ["Contas vencidas", fixedSummary.overdue],
  ];

  grid.className = "finance-summary";
  cards.forEach(([label, value]) => {
    const card = document.createElement("article");
    const labelElement = document.createElement("p");
    const valueElement = document.createElement("strong");

    card.className = "finance-summary__card";
    labelElement.className = "finance-summary__label";
    labelElement.textContent = label;
    valueElement.className = "finance-summary__value";
    valueElement.textContent = label === "Contas vencidas" ? String(value) : formatCurrency(value);

    card.append(labelElement, valueElement);
    grid.append(card);
  });

  return grid;
}

function createTabs(activeSection, onChange) {
  const tabs = document.createElement("div");

  tabs.className = "finance-tabs";

  Object.entries(financeSections)
    .filter(([key]) => key !== "fixedExpenses")
    .forEach(([key, section]) => {
    const button = document.createElement("button");

    button.className = `finance-tabs__button${key === activeSection ? " is-active" : ""}`;
    button.type = "button";
    button.textContent = section.title;
    button.addEventListener("click", () => onChange(key));
    tabs.append(button);
  });

  return tabs;
}

function createFinanceSection({
  sectionKey,
  items,
  onCreate,
  onEdit,
  onDelete,
  onMarkPaid,
  fixedAccountFilters,
  onFixedAccountFilterChange,
}) {
  const sectionConfig = financeSections[sectionKey];
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const createButton = document.createElement("button");
  const tableWrapper = document.createElement("div");
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  section.className = "finance-section";
  header.className = "finance-section__header";
  title.className = "finance-section__title";
  title.textContent = sectionConfig.title;

  createButton.className = "button button--primary";
  createButton.type = "button";
  createButton.textContent = sectionConfig.buttonLabel;
  createButton.addEventListener("click", () => onCreate(sectionKey));

  tableWrapper.className = "finance-table__wrapper";

  const headerRow = document.createElement("tr");
  sectionConfig.columns.forEach((column) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = column;
    headerRow.append(th);
  });
  thead.append(headerRow);

  if (!items.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = sectionConfig.columns.length;
    cell.textContent = "Nenhum lançamento financeiro cadastrado";
    row.append(cell);
    tbody.append(row);
  }

  items.forEach((item) => {
    const row = document.createElement("tr");
    getRowValues(sectionKey, item).forEach((value) => {
      const td = document.createElement("td");

      if (getStatusClass(item.status) && value === formatStatus(item.status)) {
        td.append(createStatusBadge(value, item.status));
      } else {
        td.textContent = value;
      }

      row.append(td);
    });

    const actions = document.createElement("td");
    const actionsGroup = document.createElement("div");
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");
    const payButton = document.createElement("button");

    actionsGroup.className = "finance-table__actions";
    editButton.className = "button button--secondary";
    editButton.type = "button";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", () => onEdit(sectionKey, item.id));

    deleteButton.className = "button button--danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Excluir";
    deleteButton.addEventListener("click", () => onDelete(sectionKey, item.id));

    if (sectionKey === "recurringFixedExpenses" && item.status !== "pago") {
      payButton.className = "button button--primary";
      payButton.type = "button";
      payButton.textContent = "Marcar como pago";
      payButton.addEventListener("click", () => onMarkPaid(sectionKey, item.id));
      actionsGroup.append(payButton);
    }

    actionsGroup.append(editButton, deleteButton);
    actions.append(actionsGroup);
    row.append(actions);
    tbody.append(row);
  });

  table.append(thead, tbody);
  tableWrapper.append(table);
  header.append(title, createButton);
  section.append(header);

  if (sectionKey === "recurringFixedExpenses") {
    section.append(createFixedAccountFilters({
      filters: fixedAccountFilters,
      onChange: onFixedAccountFilterChange,
    }));
  }

  section.append(tableWrapper);

  return section;
}

function createFixedAccountFilters({ filters, onChange }) {
  const wrapper = document.createElement("div");
  const statusSelect = document.createElement("select");
  const categorySelect = document.createElement("select");

  wrapper.className = "finance-filters";
  appendOption(statusSelect, "", "Todos os status");
  appendOption(statusSelect, "vencidas", "Vencidas");
  appendOption(statusSelect, "pago", "Pagas");
  appendOption(statusSelect, "pendente", "Pendentes");
  statusSelect.value = filters.status;
  statusSelect.addEventListener("change", () => onChange({
    ...filters,
    status: statusSelect.value,
  }));

  appendOption(categorySelect, "", "Todas as categorias");
  recurringFixedCategories.forEach((category) => appendOption(categorySelect, category, formatCategory(category)));
  categorySelect.value = filters.category;
  categorySelect.addEventListener("change", () => onChange({
    ...filters,
    category: categorySelect.value,
  }));

  wrapper.append(statusSelect, categorySelect);
  return wrapper;
}

function appendOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function createFinanceModal({ onSubmit, onClose }) {
  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const closeButton = document.createElement("button");
  const form = document.createElement("form");
  const actions = document.createElement("div");
  const cancelButton = document.createElement("button");
  const submitButton = document.createElement("button");
  let currentFields = {};

  overlay.className = "finance-modal";
  overlay.hidden = true;
  dialog.className = "finance-modal__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "finance-modal-title");

  header.className = "finance-modal__header";
  title.className = "finance-modal__title";
  title.id = "finance-modal-title";

  closeButton.className = "finance-modal__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Fechar formulário");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);

  form.className = "finance-form";
  form.noValidate = true;

  actions.className = "finance-form__actions";
  cancelButton.className = "button button--secondary";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancelar";
  cancelButton.addEventListener("click", onClose);

  submitButton.className = "button button--primary";
  submitButton.type = "submit";
  submitButton.textContent = "Salvar";

  actions.append(cancelButton, submitButton);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit(readFormData(currentFields));
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
    open({ title: nextTitle, sectionKey, item }) {
      currentFields = {};
      title.textContent = nextTitle;
      form.replaceChildren();

      financeSections[sectionKey].fields.forEach((fieldConfig) => {
        const field = createField(fieldConfig);
        field.input.value = item[fieldConfig.key] ?? "";
        currentFields[fieldConfig.key] = field;
        form.append(field.wrapper);
      });

      form.append(actions);
      overlay.hidden = false;
      Object.values(currentFields)[0]?.input.focus();
    },
    close() {
      overlay.hidden = true;
      form.reset();
    },
  };
}

function createField({ key, label, type, options = [] }) {
  const wrapper = document.createElement("label");
  const labelText = document.createElement("span");
  const input = type === "select" ? document.createElement("select") : document.createElement("input");

  wrapper.className = "finance-form__field";
  labelText.textContent = label;
  input.name = key;

  if (type === "select") {
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "Selecione uma opção";
    input.append(emptyOption);

    options.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option;
      optionElement.textContent = option;
      input.append(optionElement);
    });
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

function readFormData(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [key, field.input.value.trim()]),
  );
}

function getRowValues(sectionKey, item) {
  if (sectionKey === "recurringFixedExpenses") {
    return [
      item.name,
      formatCategory(item.category),
      formatCurrency(item.amount),
      formatDate(item.dueDate),
      formatStatus(item.recurrence),
      formatStatus(item.status),
    ];
  }

  if (sectionKey === "revenues") {
    return [
      item.description,
      item.reference,
      formatDate(getFinanceEntryDate(item)),
      formatCurrency(item.value),
      item.paymentMethod,
      formatStatus(item.status),
    ];
  }

  if (sectionKey === "fixedExpenses") {
    return [
      item.description,
      item.category,
      formatDate(getFinanceEntryDate(item)),
      formatCurrency(item.value),
      formatStatus(item.status),
    ];
  }

  return [
    item.description,
    item.category,
    formatDate(getFinanceEntryDate(item)),
    formatCurrency(item.value),
    formatYesNo(item.linkedToReservation),
    formatStatus(item.status),
  ];
}

function filterFinanceByMonth(finance, selectedMonth) {
  return {
    revenues: finance.revenues.filter((item) => isEntryInMonth(item, selectedMonth)),
    fixedExpenses: finance.fixedExpenses.filter((item) => isEntryInMonth(item, selectedMonth)),
    variableExpenses: finance.variableExpenses.filter((item) => isEntryInMonth(item, selectedMonth)),
  };
}

function filterFixedAccounts(items, filters) {
  return items.filter((item) => {
    const statusMatches = !filters.status
      || (filters.status === "vencidas"
        ? item.status !== "pago" && buildDate(item.dueDate) < buildDate(toDateInputValue(new Date()))
        : item.status === filters.status);
    const categoryMatches = !filters.category || item.category === filters.category;

    return statusMatches && categoryMatches;
  });
}

function calculateSummary(finance) {
  const receivedRevenue = sumByStatus(finance.revenues, "status", "recebido");
  const pendingRevenue = sumByStatus(finance.revenues, "status", "pendente");
  const paidVariable = sumByStatus(finance.variableExpenses, "status", "pago");
  const totalExpenses = paidVariable;

  return {
    receivedRevenue,
    pendingRevenue,
    paidVariable,
    totalExpenses,
    netProfit: receivedRevenue - totalExpenses,
  };
}

function sumByStatus(items, key, status) {
  return items
    .filter((item) => item[key] === status)
    .reduce((total, item) => total + Number(item.value || item.amount || 0), 0);
}

function isEntryInMonth(item, selectedMonth) {
  const entryDate = getFinanceEntryDate(item);

  if (!entryDate) {
    return false;
  }

  const date = buildDate(entryDate);

  return date.getFullYear() === selectedMonth.getFullYear()
    && date.getMonth() === selectedMonth.getMonth();
}

function getFinanceEntryDate(item) {
  return item.paymentDate
    || item.payment_date
    || item.dueDate
    || item.due_date
    || item.date
    || item.dataEntrada
    || item.createdAt
    || item.created_at
    || "";
}

function buildDate(value) {
  return new Date(`${value}T00:00:00`);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) {
    return "Não informado";
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatMonthLabel(value) {
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(value);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatStatus(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatCategory(value) {
  return String(value || "outros")
    .replace("agua", "água")
    .replace("funcionario", "funcionário")
    .replace("manutencao", "manutenção")
    .replace(/^./, (char) => char.toUpperCase());
}

function formatYesNo(value) {
  return value === "sim" ? "Sim" : "Não";
}
