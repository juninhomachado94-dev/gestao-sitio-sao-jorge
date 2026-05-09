import { getClients, getReservations } from "./dataService.js";

const SETTINGS_KEY = "sitio-sao-jorge-message-automation-settings";
const HISTORY_KEY = "sitio-sao-jorge-message-automation-history";
const CHECKOUT_NOTICE_MINUTES = 60;
let schedulerId = null;

const defaultSettings = {
  checkInEnabled: false,
  checkOutEnabled: false,
};

export function getMessageAutomationSettings() {
  return {
    ...defaultSettings,
    ...readJson(SETTINGS_KEY, {}),
  };
}

export function saveMessageAutomationSettings(settings) {
  const nextSettings = {
    checkInEnabled: Boolean(settings.checkInEnabled),
    checkOutEnabled: Boolean(settings.checkOutEnabled),
  };

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
  return nextSettings;
}

export function getMessageAutomationHistory() {
  const history = readJson(HISTORY_KEY, []);

  return Array.isArray(history) ? history : [];
}

export function getReservasForMessageAutomation() {
  const clients = safeList(getClients());

  return safeList(getReservations())
    .filter((reservation) => reservation.reservationStatus !== "Cancelada")
    .map((reservation) => enrichReservationWithClient(reservation, clients))
    .sort((a, b) => buildDateTime(a.dataEntrada, a.horaEntrada) - buildDateTime(b.dataEntrada, b.horaEntrada));
}

export function sendReservationMessage({ reservationId, type, mode = "manual" }) {
  const reservation = getReservasForMessageAutomation().find((item) => item.id === reservationId);

  if (!reservation) {
    return { ok: false, message: "Reserva não encontrada." };
  }

  const rawPhone = reservation.clientPhone || reservation.client?.phone || "";
  const whatsappPhone = formatWhatsAppPhone(rawPhone);

  if (!whatsappPhone) {
    return { ok: false, message: "Telefone do cliente não encontrado." };
  }

  const message = type === "checkout"
    ? buildCheckOutMessage(reservation)
    : buildCheckInMessage(reservation);
  const encodedMessage = encodeURIComponent(message);
  const finalWaUrl = `https://wa.me/${whatsappPhone}?text=${encodedMessage}`;

  console.log("AUTOMAÇÃO WHATSAPP CLIENTE:", {
    type,
    mode,
    clientName: reservation.clientName,
    rawPhone,
    sanitizedPhone: whatsappPhone,
    finalWaUrl,
  });

  window.open(finalWaUrl, "_blank", "noopener,noreferrer");
  registerMessageHistory({
    type,
    mode,
    reservation,
    rawPhone,
    whatsappPhone,
  });

  return { ok: true, message: "Mensagem preparada no WhatsApp." };
}

export function startMessageAutomationScheduler() {
  if (schedulerId) {
    return;
  }

  schedulerId = window.setInterval(checkAutomaticMessages, 60 * 1000);
  checkAutomaticMessages();
}

export function stopMessageAutomationScheduler() {
  if (!schedulerId) {
    return;
  }

  window.clearInterval(schedulerId);
  schedulerId = null;
}

function checkAutomaticMessages() {
  const settings = getMessageAutomationSettings();

  if (!settings.checkInEnabled && !settings.checkOutEnabled) {
    return;
  }

  const now = new Date();
  const reservations = getReservasForMessageAutomation();

  reservations.forEach((reservation) => {
    if (settings.checkInEnabled && shouldSendCheckIn(reservation, now)) {
      sendReservationMessage({ reservationId: reservation.id, type: "checkin", mode: "automatico" });
    }

    if (settings.checkOutEnabled && shouldSendCheckOut(reservation, now)) {
      sendReservationMessage({ reservationId: reservation.id, type: "checkout", mode: "automatico" });
    }
  });
}

function shouldSendCheckIn(reservation, now) {
  const scheduledAt = buildDateTime(reservation.dataEntrada, reservation.horaEntrada);

  return isInsideWindow(now, scheduledAt, 0, 30) && !hasHistoryFor(reservation.id, "checkin");
}

function shouldSendCheckOut(reservation, now) {
  const scheduledAt = buildDateTime(reservation.dataSaida, reservation.horaSaida);

  return isInsideWindow(now, scheduledAt, -CHECKOUT_NOTICE_MINUTES, 30) && !hasHistoryFor(reservation.id, "checkout");
}

function isInsideWindow(now, target, startOffsetMinutes, endOffsetMinutes) {
  if (Number.isNaN(target.getTime())) {
    return false;
  }

  const start = new Date(target.getTime() + startOffsetMinutes * 60 * 1000);
  const end = new Date(target.getTime() + endOffsetMinutes * 60 * 1000);

  return now >= start && now <= end;
}

function registerMessageHistory({ type, mode, reservation, rawPhone, whatsappPhone }) {
  const history = getMessageAutomationHistory();
  const entry = {
    id: `msg-${Date.now()}`,
    type,
    mode,
    reservationId: reservation.id,
    clientId: reservation.clientId || "",
    clientName: reservation.clientName || "Cliente não informado",
    rawPhone,
    whatsappPhone,
    sentAt: new Date().toISOString(),
  };

  window.localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...history].slice(0, 80)));
}

function hasHistoryFor(reservationId, type) {
  return getMessageAutomationHistory().some((entry) => entry.reservationId === reservationId && entry.type === type);
}

function enrichReservationWithClient(reservation, clients) {
  const client = clients.find((item) => item.id === reservation.clientId)
    || clients.find((item) => normalizeText(item.name) === normalizeText(reservation.clientName));

  return {
    ...reservation,
    client,
    clientName: reservation.clientName || client?.name || "Cliente não informado",
    clientPhone: client?.phone || reservation.clientPhone || "",
  };
}

function buildCheckInMessage(reservation) {
  return [
    `Olá, ${reservation.clientName}`,
    "",
    "Seja muito bem-vindo(a) ao Sítio São Jorge!",
    "",
    "Esperamos que vocês aproveitem cada momento e tenham uma experiência incrível conosco.",
    "",
    "Passando apenas alguns lembretes rápidos para ajudar tudo a ocorrer da melhor forma:",
    "",
    "- Descartar o lixo na caçamba azul que fica perto da porteira",
    "- Evitar som alto após o horário permitido",
    "- Não jogar papel ou objetos nos vasos sanitários",
    "- Crianças devem estar sempre acompanhadas na piscina",
    "",
    "Qualquer dúvida ou necessidade, estamos à disposição.",
    "",
    "Aproveitem muito!",
  ].join("\n");
}

function buildCheckOutMessage(reservation) {
  return [
    `Olá, ${reservation.clientName}`,
    "",
    "Esperamos que tenham aproveitado bastante a estadia no Sítio São Jorge.",
    "",
    "Antes da saída, pedimos gentilmente apenas alguns cuidados:",
    "",
    "- Recolher o lixo utilizado, jogando na caçamba azul",
    "- Desligar luzes e equipamentos",
    "- Nos avisar para conferência e entrega das chaves",
    "",
    "Esses pequenos cuidados ajudam muito na organização do espaço para os próximos hóspedes.",
    "",
    "Muito obrigado pela preferência e esperamos receber vocês novamente em breve!",
  ].join("\n");
}

function formatWhatsAppPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("55")) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

function buildDateTime(date, time) {
  return new Date(`${date || ""}T${time || "00:00"}`);
}

function readJson(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}
