import { createStatusBadge, getStatusClass } from "../components/StatusBadge.js";
import { getClients, getContracts, getReservations } from "../../services/dataService.js";
import { formatCurrency } from "../../services/privacyService.js";

const statusLabels = ["Livre", "Pré-reserva", "Reservada", "Confirmada", "Cancelada"];
const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function createCalendarPage() {
  const today = new Date();
  const reservations = getStoredReservations();
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
    detailsHost.replaceChildren(createDayDetails(selectedDateKey, getReservationsForDate(selectedDateKey)));
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

function createDayDetails(dateKey, reservations) {
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

    card.append(client, status, infoBlocks, timeline, notes);
    wrapper.append(card);
  });

  return wrapper;
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
