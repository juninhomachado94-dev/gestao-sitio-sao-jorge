import { supabase } from "./supabaseClient.js";

const STORAGE_KEY = "sitio-sao-jorge-commercial-dates";
let isSyncing = false;

export const commercialDateTypes = [
  "nacional",
  "estadual",
  "municipal",
  "ponto_facultativo",
  "data_comercial",
  "promocao",
];

export const opportunityLevels = ["alta", "media", "baixa"];
export const promotionStatuses = ["planejada", "publicada", "finalizada"];

export function getCommercialDates() {
  const dates = readCommercialDates();
  syncCommercialDatesFromSupabase();

  return dates;
}

export async function loadCommercialDates(year = new Date().getFullYear()) {
  try {
    const { data, error } = await supabase
      .from("commercial_dates")
      .select("id,title,date,type,city,state,description,opportunity_level,suggested_price,promotion_note,promotion_title,promotion_message,promotion_status,created_at,updated_at")
      .order("date", { ascending: true });

    if (error) {
      console.error("Erro ao carregar calendário comercial no Supabase:", error);
      return ensureCommercialDatesSeed(year);
    }

    if (Array.isArray(data) && data.length) {
      const dates = data.map(mapCommercialDateFromSupabase);
      writeCommercialDates(dates);
      return dates;
    }

    return ensureCommercialDatesSeed(year);
  } catch (error) {
    console.error("Erro ao conectar com Supabase para calendário comercial:", error);
    return ensureCommercialDatesSeed(year);
  }
}

export async function saveCommercialDate(date) {
  const normalizedDate = normalizeCommercialDate(date);
  writeCommercialDates(upsertLocalCommercialDate(normalizedDate));

  try {
    const { error } = await supabase
      .from("commercial_dates")
      .upsert(mapCommercialDateToSupabase(normalizedDate), { onConflict: "id" });

    if (error) {
      console.error("Erro ao salvar data comercial no Supabase:", error);
      return { ok: false, error, date: normalizedDate };
    }

    return { ok: true, error: null, date: normalizedDate };
  } catch (error) {
    console.error("Erro ao conectar com Supabase para salvar data comercial:", error);
    return { ok: false, error, date: normalizedDate };
  }
}

export async function deleteCommercialDate(dateId) {
  writeCommercialDates(readCommercialDates().filter((date) => date.id !== dateId));

  try {
    const { error } = await supabase
      .from("commercial_dates")
      .delete()
      .eq("id", dateId);

    if (error) {
      console.error("Erro ao excluir data comercial no Supabase:", error);
      return { ok: false, error };
    }

    return { ok: true, error: null };
  } catch (error) {
    console.error("Erro ao conectar com Supabase para excluir data comercial:", error);
    return { ok: false, error };
  }
}

export async function saveCommercialPromotion(dateId, promotion) {
  const currentDate = readCommercialDates().find((date) => date.id === dateId);

  if (!currentDate) {
    return { ok: false, error: new Error("Data comercial não encontrada") };
  }

  return saveCommercialDate({
    ...currentDate,
    promotionTitle: promotion.promotionTitle,
    promotionMessage: promotion.promotionMessage,
    promotionStatus: promotion.promotionStatus,
    promotionNote: promotion.promotionNote || currentDate.promotionNote,
    suggestedPrice: promotion.suggestedPrice || currentDate.suggestedPrice,
  });
}

export function buildCommercialAlerts(referenceDate = new Date(), dates = getCommercialDates(), selectedMonth = null) {
  const today = stripTime(referenceDate);
  const alertDays = new Set([30, 15, 7]);

  return dates
    .map((date) => ({
      ...date,
      daysUntil: differenceInDays(buildDate(date.date), today),
    }))
    .filter((date) => isCommercialAlertRelevant(date, today, selectedMonth))
    .filter((date) => alertDays.has(date.daysUntil) || !hasPromotion(date))
    .map((date) => ({
      type: "contract",
      message: buildCommercialAlertMessage(date),
    }));
}

export function getMonthCommercialSummary({ dates, reservations, revenues, selectedMonth }) {
  const monthDates = dates.filter((date) => isDateInMonth(date.date, selectedMonth));
  const holidayDates = monthDates.filter((date) => date.type !== "promocao");
  const rentedHolidays = holidayDates.filter((date) => hasReservationOnDate(reservations, date.date));
  const freeHolidays = holidayDates.filter((date) => !hasReservationOnDate(reservations, date.date));
  const holidayRevenue = revenues
    .filter((revenue) => holidayDates.some((date) => sameDate(getFinanceEntryDate(revenue), date.date)))
    .reduce((sum, revenue) => sum + Number(revenue.value ?? revenue.amount ?? 0), 0);
  const lostOpportunity = freeHolidays.reduce((sum, date) => sum + Number(date.suggestedPrice || 0), 0);

  return {
    monthDates,
    holidayDates,
    rentedHolidays,
    freeHolidays,
    holidayRevenue,
    lostOpportunity,
  };
}

async function syncCommercialDatesFromSupabase() {
  if (isSyncing) {
    return;
  }

  isSyncing = true;

  try {
    await loadCommercialDates(new Date().getFullYear());
  } finally {
    window.setTimeout(() => {
      isSyncing = false;
    }, 5000);
  }
}

async function ensureCommercialDatesSeed(year) {
  const localDates = readCommercialDates();

  if (localDates.length) {
    return localDates;
  }

  const seededDates = await buildInitialCommercialDates(year);
  writeCommercialDates(seededDates);

  try {
    const { error } = await supabase
      .from("commercial_dates")
      .upsert(seededDates.map(mapCommercialDateToSupabase), { onConflict: "id" });

    if (error) {
      console.error("Erro ao criar calendário comercial inicial no Supabase:", error);
    }
  } catch (error) {
    console.error("Erro ao conectar com Supabase para criar calendário comercial inicial:", error);
  }

  return seededDates;
}

async function buildInitialCommercialDates(year) {
  const apiDates = await fetchBrazilHolidays(year);
  const nationalDates = apiDates.length ? apiDates : getFallbackNationalDates(year);
  const extraDates = getFallbackCommercialDates(year);

  return normalizeCommercialDates([...nationalDates, ...extraDates]);
}

async function fetchBrazilHolidays(year) {
  try {
    const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);

    if (!response.ok) {
      return [];
    }

    const holidays = await response.json();

    return Array.isArray(holidays)
      ? holidays.map((holiday) => ({
          id: `br-${holiday.date}`,
          title: holiday.name,
          date: holiday.date,
          type: "nacional",
          city: "",
          state: "BR",
          description: "Feriado nacional do Brasil",
          opportunityLevel: "alta",
          suggestedPrice: 0,
          promotionNote: "",
        }))
      : [];
  } catch (error) {
    console.error("Não foi possível carregar feriados nacionais pela API:", error);
    return [];
  }
}

function getFallbackNationalDates(year) {
  return [
    ["01-01", "Confraternização Universal"],
    ["04-21", "Tiradentes"],
    ["05-01", "Dia do Trabalho"],
    ["09-07", "Independência do Brasil"],
    ["10-12", "Nossa Senhora Aparecida"],
    ["11-02", "Finados"],
    ["11-15", "Proclamação da República"],
    ["12-25", "Natal"],
  ].map(([monthDay, title]) => ({
    id: `br-${year}-${monthDay}`,
    title,
    date: `${year}-${monthDay}`,
    type: "nacional",
    city: "",
    state: "BR",
    description: "Feriado nacional do Brasil",
    opportunityLevel: "alta",
    suggestedPrice: 0,
    promotionNote: "",
  }));
}

function getFallbackCommercialDates(year) {
  return [
    {
      id: `sp-${year}-07-09`,
      title: "Revolução Constitucionalista",
      date: `${year}-07-09`,
      type: "estadual",
      city: "",
      state: "SP",
      description: "Feriado estadual de São Paulo",
      opportunityLevel: "media",
    },
    {
      id: `itatinga-${year}-07-24`,
      title: "Aniversário de Itatinga",
      date: `${year}-07-24`,
      type: "municipal",
      city: "Itatinga",
      state: "SP",
      description: "Data municipal cadastrável e editável",
      opportunityLevel: "alta",
      promotionNote: "Criar pacote especial para moradores e famílias da região.",
    },
    {
      id: `comercial-${year}-05-12`,
      title: "Dia das Mães",
      date: `${year}-05-12`,
      type: "data_comercial",
      city: "Itatinga",
      state: "SP",
      description: "Data comercial para encontros familiares.",
      opportunityLevel: "media",
    },
    {
      id: `comercial-${year}-06-12`,
      title: "Dia dos Namorados",
      date: `${year}-06-12`,
      type: "data_comercial",
      city: "Itatinga",
      state: "SP",
      description: "Data comercial para campanhas de casal e lazer.",
      opportunityLevel: "media",
    },
    {
      id: `comercial-${year}-10-12`,
      title: "Dia das Crianças",
      date: `${year}-10-12`,
      type: "data_comercial",
      city: "Itatinga",
      state: "SP",
      description: "Oportunidade para festas infantis e lazer em família.",
      opportunityLevel: "alta",
    },
  ].map((date) => ({
    suggestedPrice: 0,
    promotionNote: "",
    ...date,
  }));
}

function upsertLocalCommercialDate(date) {
  const dates = readCommercialDates();
  const exists = dates.some((item) => item.id === date.id);

  return exists
    ? dates.map((item) => (item.id === date.id ? date : item))
    : [date, ...dates];
}

function normalizeCommercialDates(dates) {
  return Array.isArray(dates)
    ? dates.filter((date) => date?.id && date?.title && date?.date).map(normalizeCommercialDate)
    : [];
}

function normalizeCommercialDate(date = {}) {
  return {
    id: date.id || `data-comercial-${Date.now()}`,
    title: date.title || "",
    date: date.date || "",
    type: date.type || "data_comercial",
    city: date.city || "",
    state: date.state || "",
    description: date.description || "",
    opportunityLevel: date.opportunityLevel || date.opportunity_level || "media",
    suggestedPrice: Number(date.suggestedPrice ?? date.suggested_price ?? 0),
    promotionNote: date.promotionNote || date.promotion_note || "",
    promotionTitle: date.promotionTitle || date.promotion_title || "",
    promotionMessage: date.promotionMessage || date.promotion_message || "",
    promotionStatus: date.promotionStatus || date.promotion_status || "",
    createdAt: date.createdAt || date.created_at || "",
    updatedAt: date.updatedAt || date.updated_at || "",
  };
}

function mapCommercialDateToSupabase(date) {
  const normalizedDate = normalizeCommercialDate(date);

  return {
    id: normalizedDate.id,
    title: normalizedDate.title,
    date: normalizedDate.date,
    type: normalizedDate.type,
    city: normalizedDate.city,
    state: normalizedDate.state,
    description: normalizedDate.description,
    opportunity_level: normalizedDate.opportunityLevel,
    suggested_price: normalizedDate.suggestedPrice,
    promotion_note: normalizedDate.promotionNote,
    promotion_title: normalizedDate.promotionTitle,
    promotion_message: normalizedDate.promotionMessage,
    promotion_status: normalizedDate.promotionStatus,
    updated_at: new Date().toISOString(),
  };
}

function mapCommercialDateFromSupabase(date) {
  return normalizeCommercialDate(date);
}

function readCommercialDates() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const dates = stored ? JSON.parse(stored) : [];

    return normalizeCommercialDates(dates);
  } catch {
    return [];
  }
}

function writeCommercialDates(dates) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeCommercialDates(dates)));
}

function buildCommercialAlertMessage(date) {
  if (!hasPromotion(date)) {
    return `Feriado de ${formatShortDate(date.date)} está chegando. Que tal criar uma promoção para ${date.title}?`;
  }

  if (date.daysUntil === 30 || date.daysUntil === 15 || date.daysUntil === 7) {
    return `${date.title} está a ${date.daysUntil} dias. Revise a oportunidade comercial.`;
  }

  return `${date.title} está chegando.`;
}

function isCommercialAlertRelevant(date, today, selectedMonth) {
  const dateValue = buildDate(date.date);

  if (dateValue < today) {
    return false;
  }

  if (selectedMonth) {
    return dateValue.getFullYear() === selectedMonth.getFullYear()
      && dateValue.getMonth() === selectedMonth.getMonth();
  }

  return date.daysUntil >= 0 && date.daysUntil <= 30;
}

function hasPromotion(date) {
  return Boolean(date.promotionTitle || date.promotionStatus === "publicada" || date.type === "promocao");
}

function hasReservationOnDate(reservations, dateValue) {
  return reservations.some((reservation) => {
    if (reservation.reservationStatus === "Cancelada") {
      return false;
    }

    const targetDate = buildDate(dateValue);
    const start = buildDate(reservation.dataEntrada);
    const end = buildDate(reservation.dataSaida || reservation.dataEntrada);

    return targetDate >= start && targetDate <= end;
  });
}

function getFinanceEntryDate(revenue) {
  return revenue.date || revenue.paymentDate || revenue.dueDate || revenue.dataEntrada || revenue.createdAt || "";
}

function isDateInMonth(value, selectedMonth) {
  const date = buildDate(value);
  return date.getFullYear() === selectedMonth.getFullYear() && date.getMonth() === selectedMonth.getMonth();
}

function sameDate(first, second) {
  return first && second && first.slice(0, 10) === second.slice(0, 10);
}

function differenceInDays(first, second) {
  return Math.round((stripTime(first) - stripTime(second)) / 86400000);
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildDate(value) {
  return new Date(`${value}T00:00:00`);
}

function formatShortDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}`;
}
