import { createDataTable } from "../components/DataTable.js";
import { createSummaryCard } from "../components/SummaryCard.js";
import { getContracts, getFinance, getReservations } from "../../services/dataService.js";
import { formatCurrency } from "../../services/privacyService.js";
import {
  buildCheckoutStrategicIndicators,
  getCheckoutOccurrences,
} from "../../services/checkoutService.js";
import { getCommercialDates, getMonthCommercialSummary } from "../../services/commercialDatesService.js";
import { calculateFixedExpensesSummary, getFixedExpenses } from "../../services/fixedExpensesService.js";
import {
  defaultStrategicSettings,
  getStrategicSettings,
  saveStrategicSettings,
} from "../../services/strategicSettingsService.js";

export function createStrategicReportPage() {
  let selectedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let strategicSettings = { ...defaultStrategicSettings };
  let settingsStatus = "";

  const page = document.createElement("section");
  const headerHost = document.createElement("div");
  const contentHost = document.createElement("div");

  page.className = "strategic-page";
  page.setAttribute("aria-labelledby", "strategic-title");
  page.append(headerHost, contentHost);

  getStrategicSettings().then((settings) => {
    strategicSettings = settings;
    render();
  });

  render();

  return page;

  function render() {
    const report = buildStrategicReport(selectedMonth, strategicSettings);

    headerHost.replaceChildren(createHeader({
      monthLabel: report.monthLabel,
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
    contentHost.replaceChildren(createReportContent({
      report,
      settings: strategicSettings,
      settingsStatus,
      onSaveSettings: async (nextSettings) => {
        const result = await saveStrategicSettings(nextSettings);
        strategicSettings = nextSettings;
        settingsStatus = result.ok
          ? "Configurações estratégicas salvas com sucesso."
          : "Configurações salvas localmente. Verifique a tabela strategic_settings no Supabase.";
        render();
      },
    }));
  }
}

function createHeader({ monthLabel, onPreviousMonth, onCurrentMonth, onNextMonth }) {
  const header = document.createElement("div");
  const textGroup = document.createElement("div");
  const kicker = document.createElement("p");
  const title = document.createElement("h2");
  const intro = document.createElement("p");
  const controls = document.createElement("div");
  const previousButton = document.createElement("button");
  const currentButton = document.createElement("button");
  const nextButton = document.createElement("button");

  header.className = "strategic-page__header";
  textGroup.className = "strategic-page__header-text";
  kicker.className = "page-panel__kicker";
  kicker.textContent = "Sítio São Jorge";
  title.className = "strategic-page__title";
  title.id = "strategic-title";
  title.textContent = "Relatório Estratégico";
  intro.className = "strategic-page__intro";
  intro.textContent = `Análise estratégica de ${monthLabel}.`;
  controls.className = "strategic-month-controls";

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

function createReportContent({ report, settings, settingsStatus, onSaveSettings }) {
  const fragment = document.createDocumentFragment();
  const summaryGrid = document.createElement("div");
  const strategicGrid = document.createElement("div");
  const chartsGrid = document.createElement("div");
  const reportSection = createGeneratedReportSection(report);

  summaryGrid.className = "strategic-summary";
  report.primaryCards.forEach((card) => summaryGrid.append(createSummaryCard(card)));

  strategicGrid.className = "strategic-summary strategic-summary--analysis";
  report.strategicCards.forEach((card) => strategicGrid.append(createSummaryCard(card)));

  chartsGrid.className = "strategic-charts";
  chartsGrid.append(
    createBarChart({
      title: "Recebido x pendente x perdido",
      items: [
        { label: "Recebido", value: report.receivedTotal, className: "is-received" },
        { label: "Pendente", value: report.pendingTotal, className: "is-pending" },
        { label: "Perdido", value: report.estimatedLost, className: "is-lost" },
      ],
      formatter: formatCurrency,
    }),
    createLineChart({
      title: "Evolução mensal de faturamento",
      items: report.monthlyRevenueEvolution,
    }),
    createDonutChart({
      title: "Status dos pagamentos",
      items: report.paymentStatusItems,
    }),
    createBarChart({
      title: "Reservas por tipo de evento",
      items: report.eventTypeItems,
      formatter: (value) => String(value),
    }),
    createDayOccupancyChart(report),
  );

  fragment.append(
    summaryGrid,
    strategicGrid,
    createGoalProgressSection(report),
    createStrategicSettingsSection({ settings, settingsStatus, onSaveSettings }),
  );

  if (!report.hasStrategicData) {
    const empty = document.createElement("p");
    empty.className = "strategic-empty";
    empty.textContent = "Nenhum dado estratégico disponível para este mês.";
    fragment.append(empty);
  }

  fragment.append(
    chartsGrid,
    createDataTable({
      title: "Tabela estratégica",
      columns: ["Data", "Cliente", "Tipo de evento", "Valor total", "Recebido", "Pendente", "Status", "Observação estratégica"],
      rows: report.tableRows,
      emptyMessage: "Nenhum dado estratégico disponível para este mês.",
    }),
    reportSection,
  );

  return fragment;
}

function createStrategicSettingsSection({ settings, settingsStatus, onSaveSettings }) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const intro = document.createElement("p");
  const form = document.createElement("form");
  const grid = document.createElement("div");
  const actions = document.createElement("div");
  const saveButton = document.createElement("button");
  const status = document.createElement("p");

  section.className = "strategic-settings";
  header.className = "strategic-settings__header";
  title.textContent = "Configurações Estratégicas";
  intro.textContent = "Edite os valores de referência para estimar oportunidades perdidas e acompanhar a meta do mês.";
  form.className = "strategic-settings__form";
  grid.className = "strategic-settings__grid";
  actions.className = "strategic-settings__actions";
  saveButton.className = "button button--primary";
  saveButton.type = "submit";
  saveButton.textContent = "Salvar configurações";
  status.className = "strategic-settings__status";
  status.textContent = settingsStatus || "";

  const fields = [
    ["averageWeekdayPrice", "Valor médio diária semana"],
    ["averageFridayPrice", "Valor médio sexta-feira"],
    ["averageSaturdayPrice", "Valor médio sábado"],
    ["averageSundayPrice", "Valor médio domingo"],
    ["averageHolidayPrice", "Valor médio feriado"],
    ["averageComboPrice", "Valor médio combo/final de semana"],
    ["monthlyGoal", "Meta mensal de faturamento"],
  ];

  fields.forEach(([name, label]) => {
    grid.append(createMoneyField({ name, label, value: settings[name] }));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const nextSettings = fields.reduce((acc, [name]) => {
      acc[name] = parseNumber(formData.get(name));
      return acc;
    }, {});
    onSaveSettings(nextSettings);
  });

  header.append(title, intro);
  actions.append(saveButton, status);
  form.append(grid, actions);
  section.append(header, form);

  return section;
}

function createMoneyField({ name, label, value }) {
  const field = document.createElement("label");
  const text = document.createElement("span");
  const input = document.createElement("input");

  field.className = "strategic-settings__field";
  text.textContent = label;
  input.name = name;
  input.type = "number";
  input.min = "0";
  input.step = "0.01";
  input.inputMode = "decimal";
  input.value = String(Number(value || 0));

  field.append(text, input);
  return field;
}

function createGoalProgressSection(report) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const values = document.createElement("div");
  const goal = document.createElement("span");
  const received = document.createElement("span");
  const percent = document.createElement("strong");
  const track = document.createElement("div");
  const fill = document.createElement("span");

  section.className = "strategic-goal";
  header.className = "strategic-goal__header";
  title.textContent = "Meta mensal";
  values.className = "strategic-goal__values";
  goal.textContent = `Meta: ${formatCurrency(report.monthlyGoal)}`;
  received.textContent = `Recebido: ${formatCurrency(report.goalReachedValue)}`;
  percent.textContent = `${formatPercent(report.goalPercent)} atingido`;
  track.className = "strategic-goal__track";
  fill.className = "strategic-goal__fill";
  fill.style.width = `${Math.min(Math.max(report.goalPercent, 0), 100)}%`;

  values.append(goal, received, percent);
  header.append(title, values);
  track.append(fill);
  section.append(header, track);

  return section;
}

function createGeneratedReportSection(report) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const button = document.createElement("button");
  const output = document.createElement("textarea");

  section.className = "strategic-generated-report";
  header.className = "strategic-generated-report__header";
  title.textContent = "Resumo automático";
  button.className = "button button--primary";
  button.type = "button";
  button.textContent = "Gerar relatório";
  output.className = "strategic-generated-report__output";
  output.rows = 5;
  output.readOnly = true;
  output.placeholder = "Clique em Gerar relatório para montar um resumo copiável do mês.";

  button.addEventListener("click", () => {
    output.value = `Em ${report.monthLabel}, o Sítio São Jorge teve ${report.reservationsCount} reserva(s), faturou ${formatCurrency(report.rentedTotal)}, recebeu ${formatCurrency(report.receivedTotal)} e possui ${formatCurrency(report.pendingTotal)} pendente. A taxa de ocupação foi de ${formatPercent(report.occupancyRate)}. O potencial estimado não faturado foi de ${formatCurrency(report.estimatedLost)} considerando os dias livres do mês.`;
    output.focus();
    output.select();
  });

  header.append(title, button);
  section.append(header, output);

  return section;
}

function createBarChart({ title, items, formatter }) {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  const list = document.createElement("div");
  const maxValue = Math.max(...items.map((item) => Number(item.value || 0)), 1);

  section.className = "strategic-chart";
  heading.className = "strategic-chart__title";
  heading.textContent = title;
  list.className = "strategic-bar-chart";

  items.forEach((item) => {
    const row = document.createElement("div");
    const label = document.createElement("span");
    const track = document.createElement("div");
    const bar = document.createElement("span");
    const value = document.createElement("strong");

    row.className = "strategic-bar-chart__row";
    label.textContent = item.label;
    track.className = "strategic-bar-chart__track";
    bar.className = `strategic-bar-chart__bar ${item.className || ""}`.trim();
    bar.style.width = `${Math.max((Number(item.value || 0) / maxValue) * 100, item.value ? 4 : 0)}%`;
    value.textContent = formatter(item.value);

    track.append(bar);
    row.append(label, track, value);
    list.append(row);
  });

  section.append(heading, list);
  return section;
}

function createLineChart({ title, items }) {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const labels = document.createElement("div");
  const maxValue = Math.max(...items.map((item) => item.value), 1);
  const points = items.map((item, index) => {
    const x = 24 + (index * (252 / Math.max(items.length - 1, 1)));
    const y = 142 - ((item.value / maxValue) * 112);
    return { ...item, x, y };
  });
  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");

  section.className = "strategic-chart";
  heading.className = "strategic-chart__title";
  heading.textContent = title;
  svg.classList.add("strategic-line-chart");
  svg.setAttribute("viewBox", "0 0 300 170");
  polyline.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", "#2f6b4f");
  polyline.setAttribute("stroke-width", "4");
  polyline.setAttribute("stroke-linecap", "round");
  polyline.setAttribute("stroke-linejoin", "round");
  svg.append(polyline);

  points.forEach((point) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(point.x));
    circle.setAttribute("cy", String(point.y));
    circle.setAttribute("r", "5");
    circle.setAttribute("fill", "#b9955b");
    svg.append(circle);
  });

  labels.className = "strategic-line-chart__labels";
  items.forEach((item) => {
    const label = document.createElement("span");
    label.textContent = `${item.label}: ${formatCurrency(item.value)}`;
    labels.append(label);
  });

  section.append(heading, svg, labels);
  return section;
}

function createDonutChart({ title, items }) {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  const donut = document.createElement("div");
  const legend = document.createElement("div");
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let current = 0;
  const segments = items.map((item) => {
    const start = total ? (current / total) * 100 : 0;
    current += item.value;
    const end = total ? (current / total) * 100 : 0;
    return `${item.color} ${start}% ${end}%`;
  });

  section.className = "strategic-chart";
  heading.className = "strategic-chart__title";
  heading.textContent = title;
  donut.className = "strategic-donut";
  donut.style.background = total
    ? `conic-gradient(${segments.join(", ")})`
    : "conic-gradient(#e5e7eb 0% 100%)";
  legend.className = "strategic-donut__legend";

  items.forEach((item) => {
    const legendItem = document.createElement("span");
    const dot = document.createElement("i");
    dot.style.background = item.color;
    legendItem.append(dot, document.createTextNode(`${item.label}: ${item.value}`));
    legend.append(legendItem);
  });

  section.append(heading, donut, legend);
  return section;
}

function createDayOccupancyChart(report) {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  const grid = document.createElement("div");

  section.className = "strategic-chart strategic-chart--wide";
  heading.className = "strategic-chart__title";
  heading.textContent = "Dias alugados x livres";
  grid.className = "strategic-day-grid";

  report.daysInMonth.forEach((day) => {
    const cell = document.createElement("span");
    cell.className = `strategic-day-grid__cell ${day.rented ? "is-rented" : "is-free"}`;
    cell.textContent = String(day.day);
    cell.title = day.rented ? "Alugado" : `${day.typeLabel} livre`;
    grid.append(cell);
  });

  section.append(heading, grid);
  return section;
}

function buildStrategicReport(selectedMonth, settings) {
  const reservations = normalizeReservations(getReservations());
  const finance = normalizeFinance(getFinance());
  const fixedAccountsSummary = calculateFixedExpensesSummary(getFixedExpenses(), selectedMonth);
  const commercialSummary = getMonthCommercialSummary({
    dates: getCommercialDates(),
    reservations,
    revenues: finance.revenues,
    selectedMonth,
  });
  const checkoutIndicators = buildCheckoutStrategicIndicators({
    occurrences: getCheckoutOccurrences(),
    selectedMonth,
  });
  const contracts = Array.isArray(getContracts()) ? getContracts() : [];
  const monthReservations = reservations.filter((reservation) => (
    reservation.reservationStatus !== "Cancelada"
    && isDateInMonth(reservation.dataEntrada, selectedMonth)
  ));
  const rentedDays = getRentedDays(monthReservations, selectedMonth);
  const daysInMonthCount = getDaysInMonth(selectedMonth);
  const freeDayDetails = getFreeDayDetails(selectedMonth, rentedDays);
  const freeDays = freeDayDetails.length;
  const potential = calculateLostPotential(freeDayDetails, settings);
  const rentedTotal = monthReservations.reduce((sum, reservation) => sum + Number(reservation.totalValue || 0), 0);
  const receivedTotal = sumFinanceEntries(finance.revenues, ["recebido", "pago"], selectedMonth);
  const pendingTotal = sumFinanceEntries(finance.revenues, ["pendente"], selectedMonth);
  const variableExpenses = sumFinanceEntries(finance.variableExpenses, ["pago"], selectedMonth);
  const totalExpenses = fixedAccountsSummary.paid + variableExpenses;
  const operationalCost = variableExpenses + fixedAccountsSummary.total;
  const estimatedLost = potential.total;
  const contractCount = contracts.filter((contract) => contract.status !== "assinado").length;
  const occupancyRate = daysInMonthCount ? (rentedDays.size / daysInMonthCount) * 100 : 0;
  const averageRealTicket = monthReservations.length ? rentedTotal / monthReservations.length : 0;
  const monthlyGoal = Number(settings.monthlyGoal || 0);
  const goalReachedValue = receivedTotal;
  const goalPercent = monthlyGoal ? (goalReachedValue / monthlyGoal) * 100 : 0;

  return {
    monthLabel: formatMonthLabel(selectedMonth),
    hasStrategicData: monthReservations.length || receivedTotal || pendingTotal || totalExpenses || monthlyGoal || estimatedLost,
    rentedTotal,
    receivedTotal,
    pendingTotal,
    totalExpenses,
    netProfit: receivedTotal - totalExpenses,
    operationalCost,
    realProfit: receivedTotal - operationalCost,
    commercialSummary,
    checkoutIndicators,
    reservationsCount: monthReservations.length,
    rentedDays: rentedDays.size,
    freeDays,
    estimatedLost,
    contractCount,
    occupancyRate,
    averageRealTicket,
    potential,
    monthlyGoal,
    goalReachedValue,
    goalPercent,
    primaryCards: [
      { label: "Total alugado no mês", value: formatCurrency(rentedTotal), detail: "Valor total das reservas" },
      { label: "Total recebido", value: formatCurrency(receivedTotal), detail: "Receitas recebidas" },
      { label: "Total pendente", value: formatCurrency(pendingTotal), detail: "Receitas pendentes" },
      { label: "Total de gastos", value: formatCurrency(totalExpenses), detail: "Gastos pagos" },
      { label: "Lucro líquido", value: formatCurrency(receivedTotal - totalExpenses), detail: "Recebido menos gastos" },
      { label: "Custo operacional do mês", value: formatCurrency(operationalCost), detail: "Gastos pagos e contas fixas" },
      { label: "Gasto fixo mensal", value: formatCurrency(fixedAccountsSummary.total), detail: "Contas fixas do mês" },
      { label: "Lucro real", value: formatCurrency(receivedTotal - operationalCost), detail: "Recebido menos custo operacional" },
      { label: "Feriados alugados", value: String(commercialSummary.rentedHolidays.length), detail: "Datas comerciais ocupadas" },
      { label: "Feriados livres", value: String(commercialSummary.freeHolidays.length), detail: "Oportunidades sem reserva" },
      { label: "Receita em feriados", value: formatCurrency(commercialSummary.holidayRevenue), detail: "Receitas vinculadas às datas" },
      { label: "Oportunidades perdidas em feriados", value: formatCurrency(commercialSummary.lostOpportunity), detail: "Valor sugerido em datas livres" },
      { label: "Prejuízos do mês", value: formatCurrency(checkoutIndicators.damageTotal), detail: "Ocorrências de checkout" },
      { label: "Atrasos recorrentes", value: String(checkoutIndicators.recurrentDelays), detail: "Atrasos na saída registrados" },
      { label: "Quantidade de reservas", value: String(monthReservations.length), detail: "Reservas do mês" },
      { label: "Dias alugados", value: String(rentedDays.size), detail: "Dias ocupados" },
      { label: "Dias livres", value: String(freeDays), detail: "Dias disponíveis" },
    ],
    strategicCards: [
      { label: "Taxa de ocupação", value: formatPercent(occupancyRate), detail: "Dias alugados no mês" },
      { label: "Ticket médio real", value: formatCurrency(averageRealTicket), detail: "Média das reservas do mês" },
      { label: "Potencial perdido semana", value: formatCurrency(potential.weekday), detail: `${potential.counts.weekday} dia(s) úteis livres` },
      { label: "Potencial perdido final de semana", value: formatCurrency(potential.weekend), detail: "Sexta, sábado e domingo livres" },
      { label: "Potencial total não faturado", value: formatCurrency(estimatedLost), detail: "Estimativa por dias livres" },
      { label: "Meta mensal", value: formatCurrency(monthlyGoal), detail: "Objetivo configurado" },
      { label: "Valor atingido da meta", value: formatCurrency(goalReachedValue), detail: "Recebido no mês" },
      { label: "Percentual da meta concluída", value: formatPercent(goalPercent), detail: "Progresso financeiro" },
      { label: "Cliente com mais ocorrências", value: checkoutIndicators.topClients[0]?.[0] || "Nenhum", detail: `${checkoutIndicators.topClients[0]?.[1] || 0} ocorrência(s)` },
      { label: "Tipo mais comum", value: checkoutIndicators.commonTypes[0]?.[0] || "Nenhum", detail: `${checkoutIndicators.commonTypes[0]?.[1] || 0} registro(s)` },
    ],
    monthlyRevenueEvolution: buildMonthlyRevenueEvolution(finance.revenues, selectedMonth),
    paymentStatusItems: buildPaymentStatusItems(finance.revenues, selectedMonth),
    eventTypeItems: buildEventTypeItems(monthReservations),
    daysInMonth: Array.from({ length: daysInMonthCount }, (_, index) => {
      const day = index + 1;
      return {
        day,
        rented: rentedDays.has(day),
        typeLabel: getDayTypeLabel(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day)),
      };
    }),
    tableRows: buildStrategicTableRows(monthReservations, finance.revenues),
  };
}

function calculateLostPotential(freeDayDetails, settings) {
  const counts = {
    weekday: 0,
    friday: 0,
    saturday: 0,
    sunday: 0,
  };

  freeDayDetails.forEach((day) => {
    counts[day.type] += 1;
  });

  const weekday = counts.weekday * Number(settings.averageWeekdayPrice || 0);
  const friday = counts.friday * Number(settings.averageFridayPrice || 0);
  const saturday = counts.saturday * Number(settings.averageSaturdayPrice || 0);
  const sunday = counts.sunday * Number(settings.averageSundayPrice || 0);
  const weekend = friday + saturday + sunday;

  return {
    counts,
    weekday,
    friday,
    saturday,
    sunday,
    weekend,
    total: weekday + weekend,
  };
}

function buildStrategicTableRows(reservations, revenues) {
  return reservations.map((reservation) => {
    const relatedRevenues = revenues.filter((revenue) => revenue.reservationId === reservation.id);
    const received = relatedRevenues
      .filter((revenue) => ["recebido", "pago"].includes(revenue.status))
      .reduce((sum, revenue) => sum + getFinanceEntryValue(revenue), 0);
    const pending = relatedRevenues
      .filter((revenue) => revenue.status === "pendente")
      .reduce((sum, revenue) => sum + getFinanceEntryValue(revenue), 0);

    return [
      formatDate(reservation.dataEntrada),
      reservation.clientName || "Cliente não informado",
      reservation.eventType || "Não informado",
      formatCurrency(reservation.totalValue),
      formatCurrency(received),
      formatCurrency(pending),
      reservation.reservationStatus || "Não informado",
      buildStrategicObservation({ reservation, received, pending }),
    ];
  });
}

function buildStrategicObservation({ reservation, received, pending }) {
  if (reservation.reservationStatus === "Cancelada") {
    return "Reserva cancelada";
  }

  if (pending > 0) {
    return "Acompanhar recebimento pendente";
  }

  if (received >= Number(reservation.totalValue || 0)) {
    return "Reserva financeiramente concluída";
  }

  return "Monitorar evolução do pagamento";
}

function buildMonthlyRevenueEvolution(revenues, selectedMonth) {
  return Array.from({ length: 6 }, (_, offset) => {
    const month = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 5 + offset, 1);
    const value = sumFinanceEntries(revenues, ["recebido", "pago"], month);

    return {
      label: formatShortMonthLabel(month),
      value,
    };
  });
}

function buildPaymentStatusItems(revenues, selectedMonth) {
  const monthRevenues = revenues.filter((revenue) => isDateInMonth(getFinanceEntryDate(revenue), selectedMonth));

  return [
    { label: "Recebido", value: monthRevenues.filter((revenue) => ["recebido", "pago"].includes(revenue.status)).length, color: "#22c55e" },
    { label: "Pendente", value: monthRevenues.filter((revenue) => revenue.status === "pendente" && getFinanceEntryValue(revenue) > 0).length, color: "#facc15" },
  ];
}

function buildEventTypeItems(reservations) {
  const counts = reservations.reduce((map, reservation) => {
    const key = reservation.eventType || "Não informado";
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());

  return Array.from(counts.entries()).map(([label, value]) => ({ label, value, className: "is-received" }));
}

function getRentedDays(reservations, selectedMonth) {
  const rentedDays = new Set();

  reservations.forEach((reservation) => {
    const start = buildDate(reservation.dataEntrada);
    const end = buildDate(reservation.dataSaida || reservation.dataEntrada);

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      if (date.getFullYear() === selectedMonth.getFullYear() && date.getMonth() === selectedMonth.getMonth()) {
        rentedDays.add(date.getDate());
      }
    }
  });

  return rentedDays;
}

function getFreeDayDetails(selectedMonth, rentedDays) {
  return Array.from({ length: getDaysInMonth(selectedMonth) }, (_, index) => {
    const day = index + 1;
    const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
    return {
      day,
      type: getDayType(date),
    };
  }).filter((day) => !rentedDays.has(day.day));
}

function getDayType(date) {
  const dayOfWeek = date.getDay();

  if (dayOfWeek === 5) {
    return "friday";
  }

  if (dayOfWeek === 6) {
    return "saturday";
  }

  if (dayOfWeek === 0) {
    return "sunday";
  }

  return "weekday";
}

function getDayTypeLabel(date) {
  const type = getDayType(date);
  const labels = {
    weekday: "Semana",
    friday: "Sexta-feira",
    saturday: "Sábado",
    sunday: "Domingo",
  };

  return labels[type];
}

function sumFinanceEntries(items, statuses, selectedMonth) {
  return items
    .filter((item) => statuses.includes(item.status) && isDateInMonth(getFinanceEntryDate(item), selectedMonth))
    .reduce((sum, item) => sum + getFinanceEntryValue(item), 0);
}

function normalizeReservations(reservations) {
  return Array.isArray(reservations) ? reservations : [];
}

function normalizeFinance(finance = {}) {
  return {
    revenues: Array.isArray(finance.revenues) ? finance.revenues : [],
    fixedExpenses: Array.isArray(finance.fixedExpenses) ? finance.fixedExpenses : [],
    variableExpenses: Array.isArray(finance.variableExpenses) ? finance.variableExpenses : [],
  };
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

function getFinanceEntryValue(item) {
  return Number(item.value ?? item.amount ?? 0);
}

function isDateInMonth(value, selectedMonth) {
  if (!value) {
    return false;
  }

  const date = buildDate(value);

  return date.getFullYear() === selectedMonth.getFullYear() && date.getMonth() === selectedMonth.getMonth();
}

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function buildDate(value) {
  return new Date(`${value}T00:00:00`);
}

function parseNumber(value) {
  return Number(String(value || "0").replace(",", "."));
}

function formatPercent(value) {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(Number(value || 0))}%`;
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

function formatShortMonthLabel(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
  }).format(value);
}
