import { createStatusBadge, getStatusClass } from "../components/StatusBadge.js";
import { getClients, getContracts, getFinance, getReservations } from "../../services/dataService.js";
import { formatCurrency } from "../../services/privacyService.js";
import { filterValidReservations } from "../../services/recordIntegrityService.js";

const statusLabels = ["Livre", "Pré-reserva", "Reservada", "Confirmada", "Cancelada"];
const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function createCalendarPage() {
  const today = new Date();
  const reservations = filterValidReservations(getStoredReservations(), getStoredClients());
  const finance = getFinance();
  let currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let selectedDateKey = toDateKey(today);

  const page = document.createElement("section");
  const header = createHeader();
  const calendarShell = document.createElement("div");
  const calendarHost = document.createElement("div");
  const detailsHost = document.createElement("aside");

  page.className = "calendar-page";
  page.setAttribute("aria-labelledby", "calendar-title");
  calendarShell.className = "calendar-page__shell";
  calendarHost.className = "calendar-page__calendar";
  detailsHost.className = "calendar-details";

  calendarShell.append(calendarHost, detailsHost);
  page.append(header.element, calendarShell);

  render();

  return page;

  function render() {
    header.updateTitle(formatMonthTitle(currentMonth));
    calendarHost.replaceChildren(createMonthGrid({
      monthDate: currentMonth,
      selectedDateKey,
      reservationsByDate: mapReservationsByDate(reservations),
      onSelectDate(dateKey) {
        selectedDateKey = dateKey;
        render();
      },
    }));
    detailsHost.replaceChildren(createDayDetails(selectedDateKey, getReservationsForDate(selectedDateKey), finance));
  }

  function getReservationsForDate(dateKey) {
    return mapReservationsByDate(reservations).get(dateKey) ?? [];
  }

  function createHeader() {
    const wrapper = document.createElement("div");
    const textGroup = document.createElement("div");
    const kicker = document.createElement("p");
    const title = document.createElement("h2");
    const intro = document.createElement("p");
    const controls = document.createElement("div");
    const previousButton = document.createElement("button");
    const monthLabel = document.createElement("strong");
    const nextButton = document.createElement("button");

    wrapper.className = "calendar-page__header";
    textGroup.className = "calendar-page__header-text";

    kicker.className = "page-panel__kicker";
    kicker.textContent = "Sítio São Jorge";

    title.className = "calendar-page__title";
    title.id = "calendar-title";
    title.textContent = "Calendário";

    intro.className = "calendar-page__intro";
    intro.textContent = "Visualização mensal das reservas do sítio.";

    controls.className = "calendar-controls";

    previousButton.className = "button button--secondary";
    previousButton.type = "button";
    previousButton.textContent = "Mês anterior";
    previousButton.addEventListener("click", () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      selectedDateKey = toDateKey(currentMonth);
      render();
    });

    monthLabel.className = "calendar-controls__month";

    nextButton.className = "button button--secondary";
    nextButton.type = "button";
    nextButton.textContent = "Próximo mês";
    nextButton.addEventListener("click", () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      selectedDateKey = toDateKey(currentMonth);
      render();
    });

    controls.append(previousButton, monthLabel, nextButton);
    textGroup.append(kicker, title, intro);
    wrapper.append(textGroup, controls);

    return {
      element: wrapper,
      updateTitle(monthTitle) {
        monthLabel.textContent = monthTitle;
      },
    };
  }
}

function getStoredReservations() {
  return getReservations();
}

function getStoredClients() {
  return getClients();
}

function createMonthGrid({ monthDate, selectedDateKey, reservationsByDate, onSelectDate }) {
  const fragment = document.createDocumentFragment();
  const legend = document.createElement("div");
  const grid = document.createElement("div");
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startDate = new Date(firstDay);

  startDate.setDate(firstDay.getDate() - firstDay.getDay());

  legend.className = "calendar-legend";
  statusLabels.forEach((status) => {
    const item = document.createElement("span");
    const dot = document.createElement("span");

    item.className = "calendar-legend__item";
    dot.className = `calendar-legend__dot ${getStatusClass(status)}`;
    item.append(dot, document.createTextNode(status));
    legend.append(item);
  });

  grid.className = "calendar-grid";

  weekdayLabels.forEach((label) => {
    const weekday = document.createElement("div");
    weekday.className = "calendar-grid__weekday";
    weekday.textContent = label;
    grid.append(weekday);
  });

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const dateKey = toDateKey(date);
    const dayReservations = reservationsByDate.get(dateKey) ?? [];
    const status = getPrimaryStatus(dayReservations);
    const button = document.createElement("button");
    const number = document.createElement("span");
    const badge = createStatusBadge(
      dayReservations.length > 1 ? `${dayReservations.length} reservas` : status,
      status,
      "calendar-day__badge",
    );

    button.className = [
      "calendar-day",
      getStatusClass(status),
      date.getMonth() === monthDate.getMonth() ? "" : "is-muted",
      dateKey === selectedDateKey ? "is-selected" : "",
    ].filter(Boolean).join(" ");
    button.type = "button";
    button.addEventListener("click", () => onSelectDate(dateKey));

    number.className = "calendar-day__number";
    number.textContent = String(date.getDate()).padStart(2, "0");

    button.append(number, badge);
    grid.append(button);
  }

  fragment.append(legend, grid);

  return fragment;
}

function createDayDetails(dateKey, reservations, finance) {
  const wrapper = document.createElement("div");
  const title = document.createElement("h3");

  wrapper.className = "calendar-details__content";
  title.className = "calendar-details__title";
  title.textContent = formatDate(dateKey);
  wrapper.append(title);

  if (reservations.length === 0) {
    const freeText = document.createElement("p");
    freeText.className = "calendar-details__free";
    freeText.textContent = "Data livre";
    wrapper.append(freeText);
    return wrapper;
  }

  reservations.forEach((reservation) => {
    const card = document.createElement("article");
    const client = document.createElement("h4");
    const status = createStatusBadge(reservation.reservationStatus, reservation.reservationStatus);
    const infoBlocks = createReservationInfoBlocks(reservation);
    const timeline = createReservationTimeline(reservation);
    const notes = document.createElement("p");

    card.className = "calendar-details__card";
    client.className = "calendar-details__client";
    client.textContent = getClientName(reservation.clientId);
    status.classList.add("calendar-details__status");

    notes.className = "calendar-details__notes";
    notes.textContent = reservation.notes || "Sem observações.";

    card.append(client, status, infoBlocks, createFinancialSituation(reservation, finance), timeline, notes);
    wrapper.append(card);
  });

  return wrapper;
}

function getCalendarFinancialSituation(reservation, finance) {
  const cents = (value) => {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && Number.isSafeInteger(Math.round(number * 100))
      ? Math.round(number * 100) : null;
  };
  const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const total = cents(reservation.totalValue);
  const deposit = cents(reservation.depositValue);
  const remaining = cents(reservation.remainingValue);
  const entries = (Array.isArray(finance?.revenues) ? finance.revenues : [])
    .filter((entry) => (entry.reservationId ?? entry.reservation_id) === reservation.id);
  const issues = [];
  let paid = 0;
  let pending = 0;
  let signalPaid = 0;
  let signalIdentified = false;
  const ids = new Set();
  for (const entry of entries) {
    if (entry.id && ids.has(entry.id)) issues.push("Há identificadores repetidos nos lançamentos financeiros.");
    ids.add(entry.id);
    const value = cents(entry.value ?? entry.amount);
    if (value === null) {
      issues.push("Há lançamento financeiro com valor ausente ou inválido.");
      continue;
    }
    const status = normalize(entry.status);
    const confirmed = ["recebido", "pago"].includes(status);
    if (confirmed) paid += value;
    else if (status === "pendente") pending += value;
    else issues.push("Há lançamento financeiro com situação não reconhecida.");
    const isSignal = /-entrada$/.test(String(entry.id ?? "")) || /^(entrada|sinal)\b/.test(normalize(entry.description));
    if (isSignal) {
      signalIdentified = true;
      if (confirmed) signalPaid += value;
    }
  }
  if (total === null || total <= 0 || deposit === null || remaining === null) {
    issues.push("A reserva não possui todos os valores necessários para conferir o pagamento.");
  }
  if (!entries.length) issues.push("Não há lançamentos financeiros vinculados disponíveis para confirmar o pagamento.");
  if (total !== null && remaining !== null && entries.length) {
    if (paid + pending !== total) issues.push("Total da reserva difere da soma dos lançamentos financeiros.");
    if (remaining !== pending) issues.push("Restante salvo na reserva difere do saldo pendente no financeiro.");
    if (paid > total || remaining > total || (deposit !== null && deposit > total)) issues.push("Há valor superior ao total da reserva.");
  }
  const paymentStatus = normalize(reservation.paymentStatus);
  if (entries.length) {
    if (paymentStatus === "pendente" && paid > 0) issues.push("Reserva indica pagamento pendente, mas o financeiro registra recebimento.");
    else if (paymentStatus === "sinal pago" && (paid <= 0 || remaining === 0)) issues.push("Status de sinal pago não corresponde aos valores disponíveis.");
    else if (paymentStatus === "pago completo" && (paid !== total || remaining !== 0)) issues.push("Status de pagamento completo não corresponde aos valores disponíveis.");
    else if (!["pendente", "sinal pago", "pago completo"].includes(paymentStatus)) issues.push("Status de pagamento da reserva insuficiente para conferência.");
    if (signalIdentified && deposit !== null && (signalPaid > 0 || paymentStatus !== "pendente") && signalPaid !== deposit) {
      issues.push("Sinal salvo na reserva difere do sinal recebido no financeiro.");
    }
  }
  const status = issues.length ? "Indeterminado" : paid === 0 ? "Pendente" : paid === total ? "Quitado" : "Parcial";
  return { total, deposit, remaining, paid: entries.length ? paid : null, pending: entries.length ? pending : null,
    signalPaid: signalIdentified ? signalPaid : null, status, issues: [...new Set(issues)],
    progress: issues.length ? null : Math.round(paid / total * 100) };
}

function createFinancialSituation(reservation, finance) {
  const data = getCalendarFinancialSituation(reservation, finance);
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h5");
  const status = document.createElement("span");
  const list = document.createElement("dl");
  section.className = `calendar-financial calendar-financial--${data.status.toLowerCase()}`;
  title.textContent = "Situação financeira";
  status.className = "calendar-financial__status";
  status.textContent = data.status;
  header.className = "calendar-financial__header";
  header.append(title, status);
  const rows = [
    ["Total salvo na reserva", data.total],
    ["Sinal salvo na reserva", data.deposit],
    ["Sinal recebido (financeiro)", data.signalPaid],
    ["Recebido confirmado (financeiro)", data.paid],
    ["Restante salvo na reserva", data.remaining],
    ["Pendente no financeiro", data.pending],
  ];
  rows.forEach(([label, value], index) => {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    if (index === 4) row.className = "calendar-financial__balance";
    term.textContent = label;
    description.textContent = value === null ? "Não confirmado" : formatCurrency(value / 100);
    row.append(term, description);
    list.append(row);
  });
  section.append(header, list);
  if (data.progress !== null) {
    const progress = document.createElement("progress");
    progress.max = 100;
    progress.value = data.progress;
    progress.setAttribute("aria-label", "Progresso dos pagamentos confirmados");
    const text = document.createElement("p");
    text.className = "calendar-financial__progress-label";
    text.textContent = `${data.progress}% do total confirmado`;
    section.append(progress, text);
  } else {
    const warning = document.createElement("ul");
    warning.className = "calendar-financial__warning";
    data.issues.forEach((issue) => {
      const item = document.createElement("li");
      item.textContent = issue;
      warning.append(item);
    });
    section.append(warning);
  }
  return section;
}

function createReservationInfoBlocks(reservation) {
  const grid = document.createElement("div");
  const contract = getContractForReservation(reservation.id);
  const blocks = [
    {
      title: "Cliente",
      items: [
        ["Nome", getClientName(reservation.clientId)],
        ["Evento", reservation.eventType || "Não informado"],
      ],
    },
    {
      title: "Período",
      items: [
        ["Entrada", formatDateTime(reservation.dataEntrada, reservation.horaEntrada)],
        ["Saída", formatDateTime(reservation.dataSaida, reservation.horaSaida)],
      ],
    },
    {
      title: "Pagamento",
      items: [
        ["Valor total", formatCurrency(reservation.totalValue)],
        ["Status", reservation.paymentStatus || "Pendente"],
      ],
    },
    {
      title: "Contrato",
      items: [
        ["Status", contract ? formatContractStatus(contract.status) : "Pendente"],
      ],
    },
  ];

  grid.className = "reservation-detail-grid";

  blocks.forEach((block) => {
    const section = document.createElement("section");
    const title = document.createElement("h5");
    const list = document.createElement("dl");

    section.className = "reservation-detail-block";
    title.textContent = block.title;

    block.items.forEach(([label, value]) => {
      const term = document.createElement("dt");
      const description = document.createElement("dd");

      term.textContent = label;

      if (label === "Status") {
        description.append(createStatusBadge(value || "Pendente", value || "Pendente"));
      } else {
        description.textContent = value || "Não informado";
      }

      list.append(term, description);
    });

    section.append(title, list);
    grid.append(section);
  });

  return grid;
}

function createReservationTimeline(reservation) {
  const timeline = document.createElement("div");
  const contract = getContractForReservation(reservation.id);
  const steps = getReservationTimelineSteps(reservation, contract);

  timeline.className = "reservation-timeline";

  steps.forEach((step) => {
    const item = document.createElement("div");
    const marker = document.createElement("span");
    const icon = document.createElement("span");
    const label = document.createElement("span");

    item.className = `reservation-timeline__item is-${step.state}`;
    marker.className = "reservation-timeline__marker";
    icon.className = "reservation-timeline__icon";
    icon.textContent = step.icon;
    label.className = "reservation-timeline__label";
    label.textContent = step.label;
    marker.append(icon);
    item.append(marker, label);
    timeline.append(item);
  });

  return timeline;
}

function getReservationTimelineSteps(reservation, contract) {
  const signalPaid = ["Sinal pago", "Pago completo"].includes(reservation.paymentStatus);
  const generated = Boolean(contract);
  const sent = ["enviado", "assinado"].includes(contract?.status);
  const signed = contract?.status === "assinado";
  const paid = reservation.paymentStatus === "Pago completo";

  return [
    { label: "Cliente cadastrado", icon: "✓", state: reservation.clientId ? "done" : "pending" },
    { label: "Reserva criada", icon: "▣", state: "done" },
    { label: "Sinal pago", icon: "✓", state: signalPaid ? "done" : "pending" },
    { label: "Contrato gerado", icon: "▣", state: generated ? "done" : "blocked" },
    { label: "Contrato enviado", icon: "↗", state: sent ? "done" : generated ? "pending" : "blocked" },
    { label: "Contrato assinado", icon: "✓", state: signed ? "done" : sent ? "pending" : "blocked" },
    { label: "Pagamento concluído", icon: "✓", state: paid ? "done" : "pending" },
  ];
}

function mapReservationsByDate(reservations) {
  const map = new Map();

  reservations.forEach((reservation) => {
    getDateRangeKeys(reservation.dataEntrada, reservation.dataSaida).forEach((dateKey) => {
      const current = map.get(dateKey) ?? [];
      map.set(dateKey, [...current, reservation]);
    });
  });

  return map;
}

function getDateRangeKeys(startDate, endDate) {
  const dates = [];
  const current = parseDateKey(startDate);
  const end = parseDateKey(endDate);

  if (!startDate || !endDate || Number.isNaN(current.getTime()) || Number.isNaN(end.getTime())) {
    return dates;
  }

  while (current <= end) {
    dates.push(toDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function getPrimaryStatus(reservations) {
  if (reservations.length === 0) {
    return "Livre";
  }

  const priority = ["Confirmada", "Reservada", "Pré-reserva", "Cancelada"];
  return priority.find((status) => reservations.some((reservation) => (
    reservation.reservationStatus === status
  ))) ?? "Livre";
}

function getClientName(clientId) {
  return getStoredClients().find((client) => client.id === clientId)?.name ?? "Cliente não encontrado";
}

function getStoredGeneratedContracts() {
  return getContracts();
}

function getContractForReservation(reservationId) {
  return getStoredGeneratedContracts().find((contract) => contract.reservationId === reservationId);
}

function formatContractStatus(status) {
  if (!status) {
    return "Pendente";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatMonthTitle(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date, time) {
  if (!date || !time) {
    return "Não informado";
  }

  return `${formatDate(date)} às ${time}`;
}

function formatDate(dateKey) {
  const date = parseDateKey(dateKey);

  if (Number.isNaN(date.getTime())) {
    return "Data não informada";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
