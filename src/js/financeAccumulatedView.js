import { getFinanceData } from "./pages/financeStore.js";
import { getReservations } from "../services/dataService.js";
import { getFixedExpenses } from "../services/fixedExpensesService.js";
import { formatCurrency } from "../services/privacyService.js";

const state = {
  mode: "month",
  selectedMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  busy: false,
};

const observer = new MutationObserver(() => enhanceFinancePage());
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener("DOMContentLoaded", enhanceFinancePage);

function enhanceFinancePage() {
  if (state.busy) {
    return;
  }

  const page = document.querySelector(".finance-page");

  if (!page) {
    return;
  }

  state.busy = true;

  try {
    syncMonthFromTitle(page);
    enhanceControls(page);
    renderSummary(page);
    renderHistoricalPanel(page);
  } finally {
    state.busy = false;
  }
}

function enhanceControls(page) {
  const controls = page.querySelector(".finance-month-controls");

  if (!controls) {
    return;
  }

  const buttons = [...controls.querySelectorAll("button")];
  buttons.forEach((button) => {
    const label = button.textContent.trim().toLowerCase();

    if (button.dataset.financeAccumulatedBound === "true") {
      return;
    }

    if (label === "mês anterior") {
      button.addEventListener("click", () => {
        state.mode = "month";
        state.selectedMonth = new Date(state.selectedMonth.getFullYear(), state.selectedMonth.getMonth() - 1, 1);
        setTimeout(enhanceFinancePage, 0);
      });
    }

    if (label === "mês atual") {
      button.addEventListener("click", () => {
        const today = new Date();
        state.mode = "month";
        state.selectedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setTimeout(enhanceFinancePage, 0);
      });
    }

    if (label === "próximo mês") {
      button.addEventListener("click", () => {
        state.mode = "month";
        state.selectedMonth = new Date(state.selectedMonth.getFullYear(), state.selectedMonth.getMonth() + 1, 1);
        setTimeout(enhanceFinancePage, 0);
      });
    }

    button.dataset.financeAccumulatedBound = "true";
  });

  if (!controls.querySelector("[data-finance-mode='year']")) {
    controls.append(createModeButton("Ano atual", "year"));
  }

  if (!controls.querySelector("[data-finance-mode='all']")) {
    controls.append(createModeButton("Geral", "all"));
  }

  controls.querySelectorAll("[data-finance-mode]").forEach((button) => {
    button.classList.toggle("is-accumulated-active", button.dataset.financeMode === state.mode);
  });
}

function createModeButton(label, mode) {
  const button = document.createElement("button");
  button.className = "button button--secondary";
  button.type = "button";
  button.textContent = label;
  button.dataset.financeMode = mode;
  button.addEventListener("click", () => {
    const today = new Date();
    state.mode = mode;

    if (mode === "year") {
      state.selectedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    enhanceFinancePage();
  });
  return button;
}

function renderSummary(page) {
  const title = page.querySelector(".finance-page__title");
  const intro = page.querySelector(".finance-page__intro");
  const summary = page.querySelector(".finance-summary");

  if (!summary) {
    return;
  }

  const data = getScopedData();
  const historical = getHistoricalData();
  const period = getPeriodLabel();
  const totalExpenses = data.fixed.paid + data.financeSummary.paidVariable;
  const netProfit = data.financeSummary.receivedRevenue - totalExpenses;
  const reservationsTotalValue = data.reservations.reduce((sum, item) => sum + getReservationAmount(item), 0);
  const averageTicket = data.reservations.length ? reservationsTotalValue / data.reservations.length : 0;
  const monthlyAverage = historical.monthsWithRevenue ? historical.totalReceived / historical.monthsWithRevenue : 0;

  if (title) {
    title.textContent = getFinanceTitle();
  }

  if (intro) {
    intro.textContent = state.mode === "all"
      ? "Visão acumulada de receitas, gastos, lucro e pendências de todo o sistema."
      : state.mode === "year"
        ? "Resumo anual de receitas, gastos, lucro e pendências."
        : "Controle mensal de receitas, gastos e lucro com dados do sistema.";
  }

  summary.replaceChildren(...[
    [`Receitas ${period}`, data.financeSummary.receivedRevenue, "money"],
    [`Contas fixas ${period}`, data.fixed.paid, "money"],
    [`Gastos variáveis ${period}`, data.financeSummary.paidVariable, "money"],
    ["Total de gastos", totalExpenses, "money"],
    ["Lucro líquido", netProfit, "money"],
    [`Valores pendentes ${period}`, data.financeSummary.pendingRevenue, "money"],
    ["Total histórico recebido", historical.totalReceived, "money"],
    ["Total histórico pendente", historical.totalPending, "money"],
    ["Quantidade total de reservas", data.reservations.length, "number"],
    ["Ticket médio por reserva", averageTicket, "money"],
    ["Média mensal de faturamento", monthlyAverage, "money"],
    ["Total de contas fixas", data.fixed.total, "money"],
    ["Contas fixas pagas", data.fixed.paid, "money"],
    ["Contas fixas pendentes", data.fixed.pending, "money"],
    ["Contas vencidas", data.fixed.overdue, "number"],
  ].map(([label, value, type]) => createSummaryCard(label, value, type)));
}

function renderHistoricalPanel(page) {
  const summary = page.querySelector(".finance-summary");

  if (!summary) {
    return;
  }

  page.querySelector(".finance-accumulated-panel")?.remove();

  const historical = getHistoricalData();
  const panel = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const intro = document.createElement("p");
  const cards = document.createElement("div");

  panel.className = "finance-accumulated-panel";
  header.className = "finance-accumulated-header";
  title.className = "finance-accumulated-title";
  title.textContent = "Resumo histórico";
  intro.className = "finance-accumulated-intro";
  intro.textContent = "Visão acumulada do desempenho financeiro do sistema.";
  cards.className = "finance-accumulated-cards";

  [
    ["Melhor mês", formatHistoricalMonth(historical.bestMonth, "received")],
    ["Pior mês", formatHistoricalMonth(historical.worstMonth, "profit")],
    ["Mês com mais reservas", formatHistoricalMonth(historical.mostReservationsMonth, "reservations")],
    ["Total acumulado do ano", formatCurrency(historical.currentYearReceived)],
    ["Total acumulado geral", formatCurrency(historical.totalReceived)],
  ].forEach(([label, value]) => cards.append(createInfoCard(label, value)));

  header.append(title, intro);
  panel.append(header, cards, createMonthlyChart(historical.months), createAnnualTable(historical.annualRows));
  summary.after(panel);
}

function createSummaryCard(label, value, type) {
  const card = document.createElement("article");
  const labelElement = document.createElement("p");
  const valueElement = document.createElement("strong");

  card.className = "finance-summary__card";
  labelElement.className = "finance-summary__label";
  labelElement.textContent = label;
  valueElement.className = "finance-summary__value";
  valueElement.textContent = type === "number" ? String(value) : formatCurrency(value);

  card.append(labelElement, valueElement);
  return card;
}

function createInfoCard(label, value) {
  const card = document.createElement("article");
  const labelElement = document.createElement("p");
  const valueElement = document.createElement("strong");

  card.className = "finance-accumulated-card";
  labelElement.className = "finance-accumulated-label";
  labelElement.textContent = label;
  valueElement.className = "finance-accumulated-value";
  valueElement.textContent = value;
  card.append(labelElement, valueElement);
  return card;
}

function createMonthlyChart(rows) {
  const section = document.createElement("section");
  const title = document.createElement("h3");
  const list = document.createElement("div");
  const max = Math.max(...rows.map((row) => Math.max(row.received, row.expenses, Math.abs(row.profit))), 1);

  section.className = "finance-accumulated-chart";
  title.className = "finance-accumulated-chart-title";
  title.textContent = "Faturamento por mês";
  list.className = "finance-accumulated-chart-list";

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "finance-accumulated-empty";
    empty.textContent = "Nenhum dado financeiro cadastrado ainda.";
    section.append(title, empty);
    return section;
  }

  rows.forEach((row) => {
    const line = document.createElement("div");
    const month = document.createElement("span");
    const bars = document.createElement("div");

    line.className = "finance-accumulated-chart-row";
    month.className = "finance-accumulated-month";
    month.textContent = formatMonthKey(row.monthKey);
    bars.className = "finance-accumulated-bars";

    [
      ["Receitas", row.received, "revenue"],
      ["Gastos", row.expenses, "expense"],
      ["Lucro", row.profit, "profit"],
    ].forEach(([label, value, type]) => {
      const barRow = document.createElement("div");
      const bar = document.createElement("span");
      const text = document.createElement("small");

      barRow.className = "finance-accumulated-bar-row";
      bar.className = `finance-accumulated-bar finance-accumulated-bar--${type}`;
      bar.style.width = `${Math.max((Math.abs(value) / max) * 100, value ? 8 : 0)}%`;
      text.textContent = `${label}: ${formatCurrency(value)}`;
      barRow.append(bar, text);
      bars.append(barRow);
    });

    line.append(month, bars);
    list.append(line);
  });

  section.append(title, list);
  return section;
}

function createAnnualTable(rows) {
  const section = document.createElement("section");
  const title = document.createElement("h3");
  const wrapper = document.createElement("div");
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");
  const headerRow = document.createElement("tr");

  section.className = "finance-accumulated-annual";
  title.className = "finance-accumulated-chart-title";
  title.textContent = "Histórico anual";
  wrapper.className = "finance-table__wrapper";

  ["Ano", "Receitas", "Gastos", "Lucro", "Reservas"].forEach((column) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = column;
    headerRow.append(th);
  });
  thead.append(headerRow);

  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "Nenhum histórico financeiro disponível.";
    row.append(cell);
    tbody.append(row);
  }

  rows.forEach((item) => {
    const row = document.createElement("tr");
    [item.year, formatCurrency(item.received), formatCurrency(item.expenses), formatCurrency(item.profit), item.reservations]
      .forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.append(cell);
      });
    tbody.append(row);
  });

  table.append(thead, tbody);
  wrapper.append(table);
  section.append(title, wrapper);
  return section;
}

function getScopedData() {
  const finance = normalizeFinance(getFinanceData());
  const fixedAccounts = safeArray(getFixedExpenses());
  const reservations = safeArray(getReservations());

  const scopedFinance = {
    revenues: finance.revenues.filter((item) => isInScope(getFinanceEntryDate(item))),
    fixedExpenses: finance.fixedExpenses.filter((item) => isInScope(getFinanceEntryDate(item))),
    variableExpenses: finance.variableExpenses.filter((item) => isInScope(getFinanceEntryDate(item))),
  };
  const scopedFixedAccounts = fixedAccounts.filter((item) => isInScope(getFixedDate(item)));
  const scopedReservations = reservations.filter((item) => isInScope(getReservationDate(item)));

  return {
    finance: scopedFinance,
    fixed: calculateFixed(scopedFixedAccounts),
    reservations: scopedReservations,
    financeSummary: calculateFinance(scopedFinance),
  };
}

function getHistoricalData() {
  const finance = normalizeFinance(getFinanceData());
  const fixedAccounts = safeArray(getFixedExpenses());
  const reservations = safeArray(getReservations());
  const months = new Map();
  const years = new Map();

  const ensureMonth = (key) => {
    if (!months.has(key)) {
      months.set(key, { monthKey: key, received: 0, pending: 0, expenses: 0, profit: 0, reservations: 0 });
    }
    return months.get(key);
  };
  const ensureYear = (year) => {
    if (!years.has(year)) {
      years.set(year, { year, received: 0, expenses: 0, profit: 0, reservations: 0 });
    }
    return years.get(year);
  };

  finance.revenues.forEach((item) => {
    const key = getMonthKey(getFinanceEntryDate(item));
    if (!key) return;
    const amount = getAmount(item);
    const month = ensureMonth(key);
    const year = ensureYear(key.slice(0, 4));

    if (["recebido", "pago"].includes(item.status)) {
      month.received += amount;
      year.received += amount;
    }
    if (item.status === "pendente") {
      month.pending += amount;
    }
  });

  [...fixedAccounts, ...finance.variableExpenses].forEach((item) => {
    const key = getMonthKey(getFixedDate(item) || getFinanceEntryDate(item));
    if (!key || item.status !== "pago") return;
    const amount = getAmount(item);
    const month = ensureMonth(key);
    const year = ensureYear(key.slice(0, 4));
    month.expenses += amount;
    year.expenses += amount;
  });

  reservations.forEach((item) => {
    const key = getMonthKey(getReservationDate(item));
    if (!key) return;
    ensureMonth(key).reservations += 1;
    ensureYear(key.slice(0, 4)).reservations += 1;
  });

  const monthRows = [...months.values()]
    .map((row) => ({ ...row, profit: row.received - row.expenses }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const annualRows = [...years.values()]
    .map((row) => ({ ...row, profit: row.received - row.expenses }))
    .sort((a, b) => b.year.localeCompare(a.year));

  const currentYear = String(new Date().getFullYear());
  const currentYearRow = annualRows.find((row) => row.year === currentYear) || { received: 0 };

  return {
    months: monthRows,
    annualRows,
    bestMonth: getBest(monthRows, "received"),
    worstMonth: getWorst(monthRows, "profit"),
    mostReservationsMonth: getBest(monthRows, "reservations"),
    totalReceived: monthRows.reduce((sum, row) => sum + row.received, 0),
    totalPending: monthRows.reduce((sum, row) => sum + row.pending, 0),
    currentYearReceived: currentYearRow.received,
    monthsWithRevenue: monthRows.filter((row) => row.received > 0).length,
  };
}

function calculateFinance(finance) {
  const receivedRevenue = finance.revenues.filter((item) => ["recebido", "pago"].includes(item.status)).reduce((sum, item) => sum + getAmount(item), 0);
  const pendingRevenue = finance.revenues.filter((item) => item.status === "pendente").reduce((sum, item) => sum + getAmount(item), 0);
  const paidVariable = finance.variableExpenses.filter((item) => item.status === "pago").reduce((sum, item) => sum + getAmount(item), 0);
  return { receivedRevenue, pendingRevenue, paidVariable };
}

function calculateFixed(items) {
  const today = buildDate(toDateInputValue(new Date()));
  return items.reduce((summary, item) => {
    const amount = getAmount(item);
    const due = getFixedDate(item);
    summary.total += amount;
    if (item.status === "pago") summary.paid += amount;
    else summary.pending += amount;
    if (item.status !== "pago" && due && buildDate(due) < today) summary.overdue += 1;
    return summary;
  }, { total: 0, paid: 0, pending: 0, overdue: 0 });
}

function isInScope(dateValue) {
  if (state.mode === "all") return true;
  if (!dateValue) return false;
  const date = buildDate(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  if (state.mode === "year") return date.getFullYear() === new Date().getFullYear();
  return date.getFullYear() === state.selectedMonth.getFullYear() && date.getMonth() === state.selectedMonth.getMonth();
}

function normalizeFinance(finance) {
  return {
    revenues: safeArray(finance?.revenues),
    fixedExpenses: safeArray(finance?.fixedExpenses),
    variableExpenses: safeArray(finance?.variableExpenses),
  };
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getFinanceEntryDate(item) {
  return item.paymentDate || item.payment_date || item.dueDate || item.due_date || item.date || item.dataEntrada || item.createdAt || item.created_at || "";
}

function getFixedDate(item) {
  return item.dueDate || item.due_date || item.paymentDate || item.payment_date || item.createdAt || item.created_at || "";
}

function getReservationDate(item) {
  return item.dataEntrada || item.startDate || item.start_date || item.date || item.createdAt || item.created_at || "";
}

function getReservationAmount(item) {
  return Number(item.totalValue || item.total_value || item.valorTotal || item.value || 0);
}

function getAmount(item) {
  return Number(item.amount || item.value || 0);
}

function getMonthKey(value) {
  if (!value) return "";
  const date = buildDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getBest(rows, key) {
  return rows.reduce((best, item) => (!best || item[key] > best[key] ? item : best), null);
}

function getWorst(rows, key) {
  return rows.reduce((worst, item) => (!worst || item[key] < worst[key] ? item : worst), null);
}

function getPeriodLabel() {
  if (state.mode === "all") return "totais";
  if (state.mode === "year") return `do ano ${new Date().getFullYear()}`;
  return "do mês";
}

function getFinanceTitle() {
  if (state.mode === "all") return "Financeiro geral";
  if (state.mode === "year") return `Financeiro de ${new Date().getFullYear()}`;
  return `Financeiro de ${formatMonthLabel(state.selectedMonth)}`;
}

function formatHistoricalMonth(month, type) {
  if (!month) return "Sem dados";
  const value = type === "reservations" ? `${month.reservations} reservas` : formatCurrency(month[type] || 0);
  return `${formatMonthKey(month.monthKey)} · ${value}`;
}

function formatMonthKey(key) {
  if (!key) return "Sem dados";
  const [year, month] = key.split("-");
  return formatMonthLabel(new Date(Number(year), Number(month) - 1, 1));
}

function formatMonthLabel(date) {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildDate(value) {
  return new Date(`${value}T00:00:00`);
}

function toDateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function syncMonthFromTitle(page) {
  if (state.mode !== "month") {
    return;
  }

  const title = page.querySelector(".finance-page__title")?.textContent || "";
  const match = title.match(/Financeiro de ([\p{L}]+) de (\d{4})/u);

  if (!match) {
    return;
  }

  const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const monthIndex = monthNames.indexOf(match[1].toLowerCase());

  if (monthIndex >= 0) {
    state.selectedMonth = new Date(Number(match[2]), monthIndex, 1);
  }
}
