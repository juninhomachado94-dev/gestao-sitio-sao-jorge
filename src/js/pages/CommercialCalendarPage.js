import { createSummaryCard } from "../components/SummaryCard.js";
import { getReservations } from "../../services/dataService.js";
import {
  commercialDateTypes,
  deleteCommercialDate,
  getCommercialDates,
  loadCommercialDates,
  opportunityLevels,
  promotionStatuses,
  saveCommercialDate,
  saveCommercialPromotion,
} from "../../services/commercialDatesService.js";

export function createCommercialCalendarPage() {
  let selectedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let dates = getCommercialDates();
  let editingDateId = null;
  let promotionDateId = null;

  const page = document.createElement("section");
  const headerHost = document.createElement("div");
  const contentHost = document.createElement("div");
  const dateModal = createCommercialDateModal({
    onSubmit: saveDate,
    onClose: closeDateModal,
  });
  const promotionModal = createPromotionModal({
    onSubmit: savePromotion,
    onClose: closePromotionModal,
  });

  page.className = "commercial-page";
  page.setAttribute("aria-labelledby", "commercial-title");
  page.append(headerHost, contentHost, dateModal.element, promotionModal.element);

  loadCommercialDates(selectedMonth.getFullYear()).then((loadedDates) => {
    dates = loadedDates;
    render();
  });

  render();

  return page;

  function render() {
    const report = buildCommercialReport({ dates, selectedMonth });

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
      onCreate: openCreateDateModal,
    }));
    contentHost.replaceChildren(createCommercialContent({
      report,
      onEdit: openEditDateModal,
      onDelete: deleteDate,
      onCreatePromotion: openPromotionModal,
    }));
  }

  function openCreateDateModal() {
    editingDateId = null;
    dateModal.open({
      title: "Nova data comercial",
      date: {
        title: "",
        type: "data_comercial",
        date: toDateInputValue(new Date()),
        city: "Itatinga",
        state: "SP",
        description: "",
        opportunityLevel: "media",
        suggestedPrice: "",
        promotionNote: "",
      },
    });
  }

  function openEditDateModal(dateId) {
    const date = dates.find((item) => item.id === dateId);

    if (!date) {
      return;
    }

    editingDateId = dateId;
    dateModal.open({
      title: "Editar data comercial",
      date,
    });
  }

  async function saveDate(formData) {
    const date = {
      id: editingDateId || `data-comercial-${Date.now()}`,
      ...formData,
      suggestedPrice: Number(formData.suggestedPrice || 0),
    };

    dates = editingDateId
      ? dates.map((item) => (item.id === editingDateId ? { ...item, ...date } : item))
      : [date, ...dates];
    await saveCommercialDate(date);
    closeDateModal();
    render();
  }

  async function deleteDate(dateId) {
    const shouldDelete = window.confirm("Tem certeza que deseja excluir esta data comercial?");

    if (!shouldDelete) {
      return;
    }

    dates = dates.filter((item) => item.id !== dateId);
    await deleteCommercialDate(dateId);
    render();
  }

  function openPromotionModal(dateId) {
    const date = dates.find((item) => item.id === dateId);

    if (!date) {
      return;
    }

    promotionDateId = dateId;
    promotionModal.open(date);
  }

  async function savePromotion(formData) {
    const result = await saveCommercialPromotion(promotionDateId, formData);

    if (result.ok) {
      dates = dates.map((item) => (item.id === promotionDateId ? result.date : item));
    }

    closePromotionModal();
    render();
  }

  function closeDateModal() {
    editingDateId = null;
    dateModal.close();
  }

  function closePromotionModal() {
    promotionDateId = null;
    promotionModal.close();
  }
}

function createHeader({ monthLabel, onPreviousMonth, onCurrentMonth, onNextMonth, onCreate }) {
  const header = document.createElement("div");
  const textGroup = document.createElement("div");
  const kicker = document.createElement("p");
  const title = document.createElement("h2");
  const intro = document.createElement("p");
  const controls = document.createElement("div");
  const previousButton = createButton("Mês anterior", "button button--secondary", onPreviousMonth);
  const currentButton = createButton("Mês atual", "button button--secondary", onCurrentMonth);
  const nextButton = createButton("Próximo mês", "button button--secondary", onNextMonth);
  const createButtonElement = createButton("Nova data", "button button--primary", onCreate);

  header.className = "commercial-page__header";
  textGroup.className = "commercial-page__header-text";
  kicker.className = "page-panel__kicker";
  kicker.textContent = "Sítio São Jorge";
  title.className = "commercial-page__title";
  title.id = "commercial-title";
  title.textContent = "Calendário Comercial";
  intro.className = "commercial-page__intro";
  intro.textContent = `Feriados, datas comerciais e oportunidades de ${monthLabel}.`;
  controls.className = "commercial-month-controls";

  textGroup.append(kicker, title, intro);
  controls.append(previousButton, currentButton, nextButton, createButtonElement);
  header.append(textGroup, controls);

  return header;
}

function createCommercialContent({ report, onEdit, onDelete, onCreatePromotion }) {
  const fragment = document.createDocumentFragment();
  const summary = document.createElement("div");

  summary.className = "commercial-summary";
  report.cards.forEach((card) => summary.append(createSummaryCard(card)));

  fragment.append(
    summary,
    createCommercialCalendar(report),
    createOpportunityList({
      title: "Oportunidades do mês",
      items: report.monthDates,
      onEdit,
      onDelete,
      onCreatePromotion,
    }),
  );

  return fragment;
}

function createCommercialCalendar(report) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const weekdays = document.createElement("div");
  const grid = document.createElement("div");
  const title = document.createElement("h3");

  section.className = "commercial-calendar";
  header.className = "commercial-calendar__header";
  title.textContent = "Visão mensal";
  weekdays.className = "commercial-calendar__weekdays";
  grid.className = "commercial-calendar__grid";

  ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].forEach((weekday) => {
    const item = document.createElement("span");
    item.textContent = weekday;
    weekdays.append(item);
  });

  report.calendarDays.forEach((day) => {
    const cell = document.createElement("article");
    const number = document.createElement("strong");
    const list = document.createElement("div");

    cell.className = `commercial-day${day.isMuted ? " is-muted" : ""}`;
    number.textContent = String(day.day);
    list.className = "commercial-day__events";

    day.events.slice(0, 3).forEach((event) => {
      const badge = document.createElement("span");
      badge.className = `commercial-badge commercial-badge--${event.type}`;
      badge.textContent = event.title;
      list.append(badge);
    });

    cell.append(number, list);
    grid.append(cell);
  });

  header.append(title);
  section.append(header, weekdays, grid);

  return section;
}

function createOpportunityList({ title, items, onEdit, onDelete, onCreatePromotion }) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const heading = document.createElement("h3");
  const list = document.createElement("div");

  section.className = "commercial-opportunities";
  header.className = "commercial-opportunities__header";
  heading.textContent = title;
  list.className = "commercial-opportunities__list";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "commercial-empty";
    empty.textContent = "Nenhuma data comercial cadastrada para este mês.";
    list.append(empty);
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    const text = document.createElement("div");
    const itemTitle = document.createElement("h4");
    const meta = document.createElement("p");
    const note = document.createElement("p");
    const actions = document.createElement("div");

    card.className = "commercial-opportunity";
    text.className = "commercial-opportunity__text";
    itemTitle.textContent = item.title;
    meta.textContent = `${formatDate(item.date)} · ${formatType(item.type)} · Oportunidade ${formatLevel(item.opportunityLevel)}`;
    note.textContent = item.promotionNote || item.description || "Sem observação comercial cadastrada.";
    actions.className = "commercial-opportunity__actions";

    actions.append(
      createButton("Criar promoção", "button button--primary", () => onCreatePromotion(item.id)),
      createButton("Editar", "button button--secondary", () => onEdit(item.id)),
      createButton("Excluir", "button button--danger", () => onDelete(item.id)),
    );

    text.append(itemTitle, meta, note);
    card.append(text, actions);
    list.append(card);
  });

  header.append(heading);
  section.append(header, list);

  return section;
}

function createCommercialDateModal({ onSubmit, onClose }) {
  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const closeButton = document.createElement("button");
  const form = document.createElement("form");
  const actions = document.createElement("div");
  const cancelButton = createButton("Cancelar", "button button--secondary", onClose);
  const saveButton = document.createElement("button");
  let fields = {};

  overlay.className = "commercial-modal";
  overlay.hidden = true;
  dialog.className = "commercial-modal__dialog";
  header.className = "commercial-modal__header";
  closeButton.className = "commercial-modal__close";
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);
  form.className = "commercial-form";
  actions.className = "commercial-form__actions";
  saveButton.className = "button button--primary";
  saveButton.type = "submit";
  saveButton.textContent = "Salvar";

  actions.append(cancelButton, saveButton);
  header.append(title, closeButton);
  dialog.append(header, form);
  overlay.append(dialog);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit(readFields(fields));
  });

  return {
    element: overlay,
    open({ title: nextTitle, date }) {
      fields = {};
      title.textContent = nextTitle;
      form.replaceChildren();
      [
        { key: "title", label: "Nome da data", type: "text" },
        { key: "type", label: "Tipo", type: "select", options: commercialDateTypes },
        { key: "date", label: "Data", type: "date" },
        { key: "opportunityLevel", label: "Nível de oportunidade", type: "select", options: opportunityLevels },
        { key: "suggestedPrice", label: "Valor sugerido", type: "number" },
        { key: "city", label: "Cidade", type: "text" },
        { key: "state", label: "Estado", type: "text" },
        { key: "description", label: "Observação", type: "textarea" },
        { key: "promotionNote", label: "Sugestão de promoção", type: "textarea" },
      ].forEach((config) => {
        const field = createField(config);
        field.input.value = date[config.key] ?? "";
        fields[config.key] = field.input;
        form.append(field.wrapper);
      });
      form.append(actions);
      overlay.hidden = false;
    },
    close() {
      overlay.hidden = true;
      form.reset();
    },
  };
}

function createPromotionModal({ onSubmit, onClose }) {
  const overlay = document.createElement("div");
  const dialog = document.createElement("div");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const closeButton = document.createElement("button");
  const form = document.createElement("form");
  const actions = document.createElement("div");
  const cancelButton = createButton("Cancelar", "button button--secondary", onClose);
  const saveButton = document.createElement("button");
  let fields = {};

  overlay.className = "commercial-modal";
  overlay.hidden = true;
  dialog.className = "commercial-modal__dialog";
  header.className = "commercial-modal__header";
  closeButton.className = "commercial-modal__close";
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);
  form.className = "commercial-form";
  actions.className = "commercial-form__actions";
  saveButton.className = "button button--primary";
  saveButton.type = "submit";
  saveButton.textContent = "Salvar promoção";

  actions.append(cancelButton, saveButton);
  header.append(title, closeButton);
  dialog.append(header, form);
  overlay.append(dialog);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit(readFields(fields));
  });

  return {
    element: overlay,
    open(date) {
      fields = {};
      title.textContent = `Promoção - ${date.title}`;
      form.replaceChildren();
      [
        { key: "promotionTitle", label: "Título da promoção", type: "text" },
        { key: "date", label: "Data", type: "date", readonly: true },
        { key: "suggestedPrice", label: "Valor sugerido", type: "number" },
        { key: "promotionMessage", label: "Mensagem pronta para WhatsApp/Instagram", type: "textarea" },
        { key: "promotionStatus", label: "Status", type: "select", options: promotionStatuses },
      ].forEach((config) => {
        const field = createField(config);
        field.input.value = config.key === "promotionMessage"
          ? date.promotionMessage || buildPromotionMessage(date)
          : date[config.key] ?? "";
        field.input.readOnly = Boolean(config.readonly);
        fields[config.key] = field.input;
        form.append(field.wrapper);
      });
      form.append(actions);
      overlay.hidden = false;
    },
    close() {
      overlay.hidden = true;
      form.reset();
    },
  };
}

function createField({ key, label, type, options = [] }) {
  const wrapper = document.createElement("label");
  const text = document.createElement("span");
  const input = type === "textarea"
    ? document.createElement("textarea")
    : type === "select"
      ? document.createElement("select")
      : document.createElement("input");

  wrapper.className = "commercial-form__field";
  text.textContent = label;
  input.name = key;

  if (type === "textarea") {
    input.rows = 5;
  } else if (type === "select") {
    options.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option;
      optionElement.textContent = formatType(option);
      input.append(optionElement);
    });
  } else {
    input.type = type;
    if (type === "number") {
      input.min = "0";
      input.step = "0.01";
    }
  }

  wrapper.append(text, input);
  return { wrapper, input };
}

function buildCommercialReport({ dates, selectedMonth }) {
  const reservations = getReservations();
  const monthDates = dates
    .filter((date) => isDateInMonth(date.date, selectedMonth))
    .sort((a, b) => buildDate(a.date) - buildDate(b.date));
  const freeOpportunities = monthDates.filter((date) => !hasReservationOnDate(reservations, date.date));
  const highOpportunities = monthDates.filter((date) => date.opportunityLevel === "alta");
  const withoutPromotion = monthDates.filter((date) => !date.promotionTitle && date.type !== "promocao");

  return {
    monthLabel: formatMonthLabel(selectedMonth),
    monthDates,
    cards: [
      { label: "Datas do mês", value: String(monthDates.length), detail: "Feriados e oportunidades" },
      { label: "Oportunidades altas", value: String(highOpportunities.length), detail: "Prioridade comercial" },
      { label: "Feriados sem reserva", value: String(freeOpportunities.length), detail: "Datas livres para vender" },
      { label: "Sem promoção", value: String(withoutPromotion.length), detail: "Datas sem campanha cadastrada" },
    ],
    calendarDays: buildCalendarDays(selectedMonth, monthDates),
  };
}

function buildCalendarDays(selectedMonth, monthDates) {
  const firstDay = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - start.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = toDateInputValue(date);

    return {
      day: date.getDate(),
      date: dateKey,
      isMuted: date.getMonth() !== selectedMonth.getMonth(),
      events: monthDates.filter((item) => item.date === dateKey),
    };
  });
}

function hasReservationOnDate(reservations, dateValue) {
  const target = buildDate(dateValue);

  return reservations.some((reservation) => {
    if (reservation.reservationStatus === "Cancelada") {
      return false;
    }

    const start = buildDate(reservation.dataEntrada);
    const end = buildDate(reservation.dataSaida || reservation.dataEntrada);
    return target >= start && target <= end;
  });
}

function buildPromotionMessage(date) {
  return `O Sítio São Jorge está preparando uma condição especial para ${date.title} em ${formatDate(date.date)}. Consulte disponibilidade e reserve sua data.`;
}

function readFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, input]) => [key, input.value.trim()]),
  );
}

function createButton(label, className, onClick) {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function isDateInMonth(value, selectedMonth) {
  const date = buildDate(value);
  return date.getFullYear() === selectedMonth.getFullYear() && date.getMonth() === selectedMonth.getMonth();
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

function formatType(value) {
  const labels = {
    nacional: "Nacional",
    estadual: "Estadual",
    municipal: "Municipal",
    ponto_facultativo: "Ponto facultativo",
    data_comercial: "Data comercial",
    promocao: "Promoção",
    alta: "Alta",
    media: "Média",
    baixa: "Baixa",
    planejada: "Planejada",
    publicada: "Publicada",
    finalizada: "Finalizada",
  };

  return labels[value] || value;
}

function formatLevel(value) {
  return formatType(value).toLowerCase();
}
