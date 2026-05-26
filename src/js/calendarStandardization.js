const currentMonthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseMonthLabel(label) {
  const normalized = normalizeText(label).replace(" de ", " ");
  const match = normalized.match(/([a-z]+)\s+(\d{4})/);

  if (!match) {
    return null;
  }

  const months = [
    "janeiro",
    "fevereiro",
    "marco",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const monthIndex = months.indexOf(match[1]);
  const year = Number(match[2]);

  if (monthIndex < 0 || Number.isNaN(year)) {
    return null;
  }

  return { monthIndex, year };
}

function getMonthDiff(from, to) {
  return ((to.year - from.year) * 12) + (to.monthIndex - from.monthIndex);
}

function goToCurrentReservationMonth(controls) {
  const label = controls.querySelector(".calendar-controls__month");
  const buttons = Array.from(controls.querySelectorAll("button"));
  const previousButton = buttons.find((button) => normalizeText(button.textContent).includes("anterior"));
  const nextButton = buttons.find((button) => normalizeText(button.textContent).includes("proximo"));
  const currentDate = new Date();
  const target = {
    monthIndex: currentDate.getMonth(),
    year: currentDate.getFullYear(),
  };
  const current = parseMonthLabel(label?.textContent);

  if (!current || !previousButton || !nextButton) {
    return;
  }

  const diff = getMonthDiff(current, target);
  const button = diff > 0 ? nextButton : previousButton;

  for (let index = 0; index < Math.min(Math.abs(diff), 36); index += 1) {
    button.click();
  }
}

function ensureCurrentMonthButton() {
  const controls = document.querySelector(".calendar-page .calendar-controls");

  if (!controls || controls.querySelector("[data-calendar-current-month]")) {
    return;
  }

  const button = document.createElement("button");
  button.className = "button button--secondary";
  button.type = "button";
  button.dataset.calendarCurrentMonth = "true";
  button.textContent = "Mês atual";
  button.addEventListener("click", () => goToCurrentReservationMonth(controls));

  const monthLabel = controls.querySelector(".calendar-controls__month");
  controls.insertBefore(button, monthLabel || controls.children[1] || null);
}

function enhanceReservationCalendar() {
  const calendarHost = document.querySelector(".calendar-page__calendar");
  const grid = calendarHost?.querySelector(".calendar-grid");

  calendarHost?.classList.add("calendar-shell");
  grid?.classList.add("calendar-grid--reservations");

  calendarHost?.querySelectorAll(".calendar-day").forEach((day) => {
    day.classList.add("calendar-day-card");
    day.querySelector(".calendar-day__number")?.classList.add("calendar-day-number");
  });

  calendarHost?.querySelectorAll(".calendar-legend__dot").forEach((dot) => {
    dot.classList.add("calendar-status-dot");
  });

  ensureCurrentMonthButton();
}

function hasPromotion(dateCard) {
  return Boolean(dateCard.querySelector(".commercial-opportunity__status--promoted"));
}

function enhanceCommercialCalendar() {
  const commercialCalendar = document.querySelector(".commercial-calendar");
  const grid = commercialCalendar?.querySelector(".commercial-calendar__grid");
  const weekdays = commercialCalendar?.querySelector(".commercial-calendar__weekdays");

  commercialCalendar?.classList.add("calendar-shell");
  grid?.classList.add("calendar-grid", "calendar-grid--commercial");
  weekdays?.classList.add("calendar-grid", "calendar-grid--weekdays");

  commercialCalendar?.querySelectorAll(".commercial-day").forEach((day) => {
    day.classList.add("calendar-day-card");
    day.querySelector(".commercial-day__number")?.classList.add("calendar-day-number");
  });

  commercialCalendar?.querySelectorAll(".commercial-badge").forEach((badge) => {
    badge.classList.add("calendar-badge");
  });

  document.querySelectorAll(".commercial-opportunity").forEach((card) => {
    if (card.querySelector(".commercial-opportunity__date")) {
      return;
    }

    const title = card.querySelector("h4");
    const meta = card.querySelector("p");
    const metaText = meta?.textContent || "";
    const dateMatch = metaText.match(/(\d{2})\/(\d{2})\/(\d{4})/);

    if (!title || !dateMatch) {
      return;
    }

    const [, day, month] = dateMatch;
    const dateBlock = document.createElement("div");
    const dayElement = document.createElement("strong");
    const monthElement = document.createElement("span");

    dateBlock.className = "commercial-opportunity__date";
    dayElement.textContent = day;
    monthElement.textContent = currentMonthFormatter
      .format(new Date(Number(dateMatch[3]), Number(month) - 1, 1))
      .slice(0, 3);

    dateBlock.append(dayElement, monthElement);
    card.prepend(dateBlock);
  });

  document.querySelectorAll(".commercial-opportunity").forEach((card) => {
    const text = card.querySelector(".commercial-opportunity__text");
    const meta = text?.querySelector("p");

    if (!text || text.querySelector(".commercial-opportunity__status")) {
      return;
    }

    const status = document.createElement("p");
    const promoted = hasPromotion(card);

    status.className = `commercial-opportunity__status commercial-opportunity__status--${promoted ? "promoted" : "open"}`;
    status.textContent = `Status: ${promoted ? "com campanha" : "sem campanha"}`;
    meta?.after(status);
  });
}

function enhanceCalendars() {
  enhanceReservationCalendar();
  enhanceCommercialCalendar();
}

const observer = new MutationObserver(() => enhanceCalendars());
observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener("DOMContentLoaded", enhanceCalendars);
enhanceCalendars();
