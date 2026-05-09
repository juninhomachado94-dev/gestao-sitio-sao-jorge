import { supabase } from "./supabaseClient.js";

const STORAGE_KEY = "sitio-sao-jorge-marketing-campaigns";
let isSyncing = false;

export const campaignTypes = [
  "feriado",
  "final_de_semana",
  "promocao_relampago",
  "pacote_familia",
  "casal",
  "aniversario",
];

export const campaignStatuses = ["planejada", "publicada", "finalizada"];

export function getMarketingCampaigns() {
  const campaigns = readCampaigns();
  syncCampaignsFromSupabase();

  return campaigns;
}

export async function loadMarketingCampaigns() {
  try {
    const { data, error } = await supabase
      .from("marketing_campaigns")
      .select("id,name,type,start_date,end_date,promotional_value,description,notes,instagram_caption,whatsapp_text,story_text,cta,status,created_at,updated_at")
      .order("start_date", { ascending: true });

    if (error) {
      console.error("Erro ao carregar campanhas de marketing no Supabase:", error);
      return readCampaigns();
    }

    const campaigns = Array.isArray(data) ? data.map(mapCampaignFromSupabase) : [];
    writeCampaigns(campaigns);
    return campaigns;
  } catch (error) {
    console.error("Erro ao conectar com Supabase para campanhas de marketing:", error);
    return readCampaigns();
  }
}

export async function saveMarketingCampaign(campaign) {
  const normalizedCampaign = normalizeCampaign({
    ...campaign,
    ...buildCampaignTexts(campaign),
  });
  writeCampaigns(upsertLocalCampaign(normalizedCampaign));

  try {
    const { error } = await supabase
      .from("marketing_campaigns")
      .upsert(mapCampaignToSupabase(normalizedCampaign), { onConflict: "id" });

    if (error) {
      console.error("Erro ao salvar campanha de marketing no Supabase:", error);
      return { ok: false, error, campaign: normalizedCampaign };
    }

    return { ok: true, error: null, campaign: normalizedCampaign };
  } catch (error) {
    console.error("Erro ao conectar com Supabase para salvar campanha de marketing:", error);
    return { ok: false, error, campaign: normalizedCampaign };
  }
}

export function buildMarketingAnalysis({
  reservations = [],
  commercialDates = [],
  campaigns = [],
  finance = {},
  selectedMonth = new Date(),
}) {
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  const daysInMonth = getDaysInMonth(monthStart);
  const activeReservations = reservations.filter((reservation) => reservation.reservationStatus !== "Cancelada");
  const monthReservations = activeReservations.filter((reservation) => overlapsMonth(reservation, monthStart));
  const occupiedDays = getOccupiedDays(monthReservations, monthStart);
  const freeDays = daysInMonth - occupiedDays.size;
  const occupancyRate = daysInMonth ? (occupiedDays.size / daysInMonth) * 100 : 0;
  const occupationStatus = getOccupationStatus(occupancyRate);
  const weekendSlots = getWeekendSlots(monthStart, occupiedDays);
  const freeWeekends = weekendSlots.filter((weekend) => weekend.isFree);
  const monthCommercialDates = commercialDates.filter((date) => isDateInMonth(date.date, monthStart));
  const holidayDates = monthCommercialDates.filter((date) => date.type !== "promocao");
  const futureHolidayDates = holidayDates.filter((date) => !isPastDate(date.date));
  const freeHolidays = futureHolidayDates.filter((date) => !occupiedDays.has(buildDate(date.date).getDate()));
  const activeCampaigns = campaigns.filter((campaign) => campaign.status !== "finalizada" && overlapsRange(campaign, monthStart));
  const finishedCampaigns = campaigns.filter((campaign) => campaign.status === "finalizada" && overlapsRange(campaign, monthStart));
  const lostOpportunities = freeWeekends.length + freeHolidays.length;
  const consecutiveFreeRanges = getConsecutiveFreeRanges(monthStart, occupiedDays);
  const commercialOpportunity = buildMonthlyCommercialOpportunity({
    monthReservations,
    freeDays,
    freeWeekends,
    freeHolidays,
    occupancyRate,
    campaigns,
    finance,
    monthStart,
  });
  const opportunities = buildOpportunities({
    occupancyRate,
    monthLabel: formatMonthLabel(monthStart),
    freeWeekends,
    freeHolidays,
    consecutiveFreeRanges,
    monthCommercialDates: monthCommercialDates.filter((date) => !isPastDate(date.date)),
    occupiedDays,
  });

  return {
    monthLabel: formatMonthLabel(monthStart),
    daysInMonth,
    occupiedDays: occupiedDays.size,
    freeDays,
    occupancyRate,
    occupationStatus,
    monthReservations,
    weekendSlots,
    freeWeekends,
    holidayDates,
    freeHolidays,
    activeCampaigns,
    finishedCampaigns,
    lostOpportunities,
    consecutiveFreeRanges,
    commercialOpportunity,
    opportunities,
    cards: [
      {
        label: "Ocupação do mês",
        value: formatPercent(occupancyRate),
        detail: `${occupiedDays.size} dia(s) ocupados`,
        tone: occupationStatus.tone,
      },
      {
        label: "Feriados alugados",
        value: String(holidayDates.length - freeHolidays.length),
        detail: "Datas comerciais ocupadas",
        tone: "success",
      },
      {
        label: "Feriados livres",
        value: String(freeHolidays.length),
        detail: "Datas para vender melhor",
        tone: freeHolidays.length ? "warning" : "success",
      },
      {
        label: "Finais de semana vagos",
        value: String(freeWeekends.length),
        detail: "Sábados e domingos sem reserva",
        tone: freeWeekends.length ? "danger" : "success",
      },
      {
        label: "Campanhas ativas",
        value: String(activeCampaigns.length),
        detail: "Planejadas ou publicadas",
        tone: "info",
      },
      {
        label: "Campanhas finalizadas",
        value: String(finishedCampaigns.length),
        detail: "Encerradas no mês",
        tone: "neutral",
      },
      {
        label: "Oportunidades perdidas",
        value: String(lostOpportunities),
        detail: "Feriados e fins de semana livres",
        tone: lostOpportunities ? "danger" : "success",
      },
    ],
  };
}

function buildOpportunities({
  occupancyRate,
  monthLabel,
  freeWeekends,
  freeHolidays,
  consecutiveFreeRanges,
  monthCommercialDates,
  occupiedDays,
}) {
  const opportunities = [];
  const upcomingDates = monthCommercialDates
    .map((date) => ({
      ...date,
      daysUntil: differenceInDays(buildDate(date.date), stripTime(new Date())),
    }))
    .filter((date) => date.daysUntil >= 0 && date.daysUntil <= 30);

  freeHolidays.slice(0, 4).forEach((date) => {
    opportunities.push({
      type: "feriado",
      tone: "danger",
      title: `${date.title} ainda sem reserva`,
      description: `Data de ${formatDate(date.date)} está livre. Considere uma campanha com valor sugerido ou pacote especial.`,
      suggestion: `Criar promoção para ${date.title}`,
    });
  });

  if (freeWeekends.length) {
    opportunities.push({
      type: "final_de_semana",
      tone: "warning",
      title: `Você está com ${freeWeekends.length} finais de semana vagos`,
      description: "Priorize campanhas rápidas para sexta, sábado e domingo disponíveis.",
      suggestion: "Criar campanha de final de semana",
    });
  }

  if (occupancyRate < 40) {
    opportunities.push({
      type: "baixa_ocupacao",
      tone: "danger",
      title: `Baixa ocupação detectada em ${monthLabel}`,
      description: `O mês está com ${formatPercent(occupancyRate)} de ocupação. Vale ativar promoção relâmpago.`,
      suggestion: "Criar promoção relâmpago",
    });
  }

  consecutiveFreeRanges
    .filter((range) => range.count >= 4)
    .slice(0, 2)
    .forEach((range) => {
      opportunities.push({
        type: "dias_vagos",
        tone: "warning",
        title: `${range.count} dias vagos seguidos`,
        description: `Período livre de ${range.startLabel} até ${range.endLabel}.`,
        suggestion: "Criar pacote família ou casal",
      });
    });

  upcomingDates
    .filter((date) => !occupiedDays.has(buildDate(date.date).getDate()))
    .filter((date) => !date.promotionTitle && date.type !== "promocao")
    .slice(0, 3)
    .forEach((date) => {
      opportunities.push({
        type: "promocao",
        tone: "info",
        title: "Próximo feriado sem promoção criada",
        description: `${date.title} está a ${date.daysUntil} dia(s) e ainda não tem campanha vinculada.`,
        suggestion: `Criar promoção para ${date.title}`,
      });
    });

  return opportunities.slice(0, 8);
}

function buildMonthlyCommercialOpportunity({
  monthReservations,
  freeDays,
  freeWeekends,
  freeHolidays,
  occupancyRate,
  campaigns,
  finance,
  monthStart,
}) {
  const averageTicket = calculateAverageTicket(monthReservations);
  const holidaySuggestedAverage = calculateAverageSuggestedPrice(freeHolidays);
  const estimatedTicket = averageTicket || holidaySuggestedAverage;
  const availablePotential = calculateAvailablePotential({
    freeWeekends,
    freeHolidays,
    freeDays,
    estimatedTicket,
  });
  const occupationTone = occupancyRate < 30 ? "danger" : occupancyRate < 55 ? "warning" : "success";
  const opportunityTone = availablePotential > 0 && occupancyRate < 55 ? "success" : freeDays > 10 ? "warning" : "success";
  const monthCampaigns = campaigns.filter((campaign) => overlapsRange(campaign, monthStart));
  const receivedTotal = sumFinanceEntries(finance?.revenues || [], ["recebido", "pago"], monthStart);
  const cards = [
    {
      label: "Finais de semana livres",
      value: String(freeWeekends.length),
      detail: freeWeekends.length ? "Datas fortes para promoção" : "Finais de semana ocupados",
      tone: freeWeekends.length ? "success" : "neutral",
    },
    {
      label: "Feriados sem reserva",
      value: String(freeHolidays.length),
      detail: freeHolidays.length ? "Oportunidades comerciais abertas" : "Nenhum feriado livre",
      tone: freeHolidays.length ? "success" : "neutral",
    },
    {
      label: "Taxa de ocupação",
      value: formatPercent(occupancyRate),
      detail: occupancyRate < 30 ? "Abaixo de 30%" : "Ocupação do mês",
      tone: occupationTone,
    },
    {
      label: "Dias vagos",
      value: String(freeDays),
      detail: "Dias disponíveis no calendário",
      tone: freeDays > 15 ? "warning" : "success",
    },
    {
      label: "Potencial disponível",
      value: formatCurrency(availablePotential),
      detail: estimatedTicket ? "Estimativa por datas livres" : "Configure preços ou crie reservas para estimar melhor",
      tone: opportunityTone,
    },
    {
      label: "Recebido no mês",
      value: formatCurrency(receivedTotal),
      detail: "Referência financeira para campanhas",
      tone: receivedTotal ? "success" : "warning",
    },
  ];
  const alerts = [
    ...(freeWeekends.length ? [{
      tone: "success",
      title: `${freeWeekends.length} finais de semana disponíveis`,
      text: "Crie uma campanha de final de semana com pacote família, casal ou promoção relâmpago.",
    }] : []),
    ...freeHolidays.slice(0, 3).map((holiday) => ({
      tone: "warning",
      title: `${holiday.title} ainda livre`,
      text: `Feriado em ${formatDate(holiday.date)} sem reserva registrada. Vale preparar oferta antecipada.`,
    })),
    ...(occupancyRate < 30 ? [{
      tone: "danger",
      title: "Ocupação abaixo de 30%",
      text: "Ative uma campanha curta para acelerar reservas no mês selecionado.",
    }] : []),
    ...(availablePotential > 0 ? [{
      tone: "success",
      title: `Potencial estimado de faturamento disponível: ${formatCurrency(availablePotential)}`,
      text: "Estimativa baseada em finais de semana livres, feriados livres e ticket médio das reservas.",
    }] : []),
  ].slice(0, 6);
  const suggestions = buildCommercialSuggestions({
    freeWeekends,
    freeHolidays,
    occupancyRate,
    availablePotential,
    monthCampaigns,
  });

  return {
    averageTicket,
    availablePotential,
    cards,
    alerts,
    suggestions,
  };
}

function buildCommercialSuggestions({ freeWeekends, freeHolidays, occupancyRate, availablePotential, monthCampaigns }) {
  const suggestions = [];
  const hasActiveCampaign = monthCampaigns.some((campaign) => campaign.status !== "finalizada");

  if (freeWeekends.length) {
    suggestions.push({
      title: "Combo final de semana",
      text: "Ofereça sexta à noite + sábado ou sábado + domingo com valor fechado para famílias.",
      tone: "success",
    });
  }

  if (freeHolidays.length) {
    suggestions.push({
      title: "Promoção de feriado",
      text: `Crie uma chamada para ${freeHolidays[0].title} destacando piscina, churrasqueira e lazer completo.`,
      tone: "warning",
    });
  }

  if (occupancyRate < 30) {
    suggestions.push({
      title: "Promoção relâmpago",
      text: "Use uma oferta com prazo curto para ocupar datas próximas e reduzir dias vagos.",
      tone: "danger",
    });
  }

  if (availablePotential > 0 && !hasActiveCampaign) {
    suggestions.push({
      title: "Campanha ativa recomendada",
      text: "Existe potencial disponível e nenhuma campanha ativa no mês. Vale criar uma ação comercial agora.",
      tone: "success",
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      title: "Mês bem encaminhado",
      text: "Continue acompanhando ocupação, feriados e campanhas para manter o ritmo de reservas.",
      tone: "success",
    });
  }

  return suggestions.slice(0, 4);
}

function calculateAverageTicket(reservations) {
  const values = reservations
    .map((reservation) => Number(reservation.totalValue || 0))
    .filter((value) => value > 0);

  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateAverageSuggestedPrice(dates) {
  const values = dates
    .map((date) => Number(date.suggestedPrice || 0))
    .filter((value) => value > 0);

  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateAvailablePotential({ freeWeekends, freeHolidays, freeDays, estimatedTicket }) {
  if (!estimatedTicket) {
    return 0;
  }

  const strategicDates = Math.max(freeWeekends.length + freeHolidays.length, Math.ceil(freeDays / 7));
  return strategicDates * estimatedTicket;
}

function sumFinanceEntries(items, statuses, selectedMonth) {
  return items
    .filter((item) => statuses.includes(item.status) && isDateInMonth(getFinanceEntryDate(item), selectedMonth))
    .reduce((sum, item) => sum + Number(item.value ?? item.amount ?? 0), 0);
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

function buildCampaignTexts(campaign) {
  const typeLabel = formatCampaignType(campaign.type).toLowerCase();
  const dateLabel = campaign.startDate && campaign.endDate
    ? `${formatDate(campaign.startDate)} a ${formatDate(campaign.endDate)}`
    : "data disponível";
  const valueLabel = Number(campaign.promotionalValue || 0)
    ? `Valor promocional: ${formatCurrency(campaign.promotionalValue)}.`
    : "Consulte condição especial.";

  return {
    instagramCaption: [
      `${campaign.name}`,
      "",
      `O Sítio São Jorge está com uma oportunidade especial para ${typeLabel}.`,
      "Piscina, churrasqueira, espaço completo e lazer para toda família.",
      valueLabel,
      "Reserve sua data e aproveite o espaço com tranquilidade.",
    ].join("\n"),
    whatsappText: [
      `Olá! Temos uma oportunidade especial no Sítio São Jorge.`,
      "",
      `${campaign.name}`,
      `Período: ${dateLabel}`,
      valueLabel,
      "",
      "Quer verificar disponibilidade e reservar?",
    ].join("\n"),
    storyText: `${campaign.name} | ${dateLabel} | Reserve agora`,
    cta: "Reserve agora",
  };
}

async function syncCampaignsFromSupabase() {
  if (isSyncing) {
    return;
  }

  isSyncing = true;

  try {
    await loadMarketingCampaigns();
  } finally {
    window.setTimeout(() => {
      isSyncing = false;
    }, 5000);
  }
}

function upsertLocalCampaign(campaign) {
  const campaigns = readCampaigns();
  const exists = campaigns.some((item) => item.id === campaign.id);

  return exists
    ? campaigns.map((item) => (item.id === campaign.id ? campaign : item))
    : [campaign, ...campaigns];
}

function normalizeCampaigns(campaigns) {
  return Array.isArray(campaigns)
    ? campaigns.filter((campaign) => campaign?.id && campaign?.name).map(normalizeCampaign)
    : [];
}

function normalizeCampaign(campaign = {}) {
  return {
    id: campaign.id || `campanha-${Date.now()}`,
    name: campaign.name || "",
    type: campaign.type || "promocao_relampago",
    startDate: campaign.startDate || campaign.start_date || "",
    endDate: campaign.endDate || campaign.end_date || campaign.startDate || campaign.start_date || "",
    promotionalValue: Number(campaign.promotionalValue ?? campaign.promotional_value ?? 0),
    description: campaign.description || "",
    notes: campaign.notes || "",
    instagramCaption: campaign.instagramCaption || campaign.instagram_caption || "",
    whatsappText: campaign.whatsappText || campaign.whatsapp_text || "",
    storyText: campaign.storyText || campaign.story_text || "",
    cta: campaign.cta || "Reserve agora",
    status: campaign.status || "planejada",
    createdAt: campaign.createdAt || campaign.created_at || "",
    updatedAt: campaign.updatedAt || campaign.updated_at || "",
  };
}

function mapCampaignToSupabase(campaign) {
  const normalizedCampaign = normalizeCampaign(campaign);

  return {
    id: normalizedCampaign.id,
    name: normalizedCampaign.name,
    type: normalizedCampaign.type,
    start_date: normalizedCampaign.startDate || null,
    end_date: normalizedCampaign.endDate || null,
    promotional_value: normalizedCampaign.promotionalValue,
    description: normalizedCampaign.description,
    notes: normalizedCampaign.notes,
    instagram_caption: normalizedCampaign.instagramCaption,
    whatsapp_text: normalizedCampaign.whatsappText,
    story_text: normalizedCampaign.storyText,
    cta: normalizedCampaign.cta,
    status: normalizedCampaign.status,
    updated_at: new Date().toISOString(),
  };
}

function mapCampaignFromSupabase(campaign) {
  return normalizeCampaign(campaign);
}

function readCampaigns() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const campaigns = stored ? JSON.parse(stored) : [];

    return normalizeCampaigns(campaigns);
  } catch {
    return [];
  }
}

function writeCampaigns(campaigns) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeCampaigns(campaigns)));
}

function getOccupiedDays(reservations, selectedMonth) {
  const days = new Set();

  reservations.forEach((reservation) => {
    const start = buildDate(reservation.dataEntrada);
    const end = buildDate(reservation.dataSaida || reservation.dataEntrada);

    for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      if (date.getFullYear() === selectedMonth.getFullYear() && date.getMonth() === selectedMonth.getMonth()) {
        days.add(date.getDate());
      }
    }
  });

  return days;
}

function getWeekendSlots(selectedMonth, occupiedDays) {
  const slots = [];
  const daysInMonth = getDaysInMonth(selectedMonth);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);

    if (date.getDay() !== 6) {
      continue;
    }

    const sunday = new Date(date);
    sunday.setDate(date.getDate() + 1);
    const saturdayOccupied = occupiedDays.has(day);
    const sundayOccupied = sunday.getMonth() === selectedMonth.getMonth() && occupiedDays.has(sunday.getDate());

    slots.push({
      start: toDateInputValue(date),
      end: sunday.getMonth() === selectedMonth.getMonth() ? toDateInputValue(sunday) : toDateInputValue(date),
      isFree: !saturdayOccupied && !sundayOccupied,
    });
  }

  return slots;
}

function getConsecutiveFreeRanges(selectedMonth, occupiedDays) {
  const ranges = [];
  const daysInMonth = getDaysInMonth(selectedMonth);
  let start = null;

  for (let day = 1; day <= daysInMonth + 1; day += 1) {
    const isFree = day <= daysInMonth && !occupiedDays.has(day);

    if (isFree && start === null) {
      start = day;
    }

    if ((!isFree || day > daysInMonth) && start !== null) {
      const end = day - 1;
      ranges.push({
        start,
        end,
        count: end - start + 1,
        startLabel: formatDate(toDateInputValue(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), start))),
        endLabel: formatDate(toDateInputValue(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), end))),
      });
      start = null;
    }
  }

  return ranges;
}

function getOccupationStatus(rate) {
  if (rate >= 70) {
    return { label: "Alta ocupação", tone: "success" };
  }

  if (rate >= 40) {
    return { label: "Média ocupação", tone: "warning" };
  }

  return { label: "Baixa ocupação", tone: "danger" };
}

function overlapsMonth(reservation, selectedMonth) {
  if (!reservation.dataEntrada) {
    return false;
  }

  const start = buildDate(reservation.dataEntrada);
  const end = buildDate(reservation.dataSaida || reservation.dataEntrada);
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);

  return start <= monthEnd && end >= monthStart;
}

function overlapsRange(item, selectedMonth) {
  const start = buildDate(item.startDate || item.start_date);
  const end = buildDate(item.endDate || item.end_date || item.startDate || item.start_date);
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);

  return start <= monthEnd && end >= monthStart;
}

function isDateInMonth(value, selectedMonth) {
  const date = buildDate(value);
  return date.getFullYear() === selectedMonth.getFullYear() && date.getMonth() === selectedMonth.getMonth();
}

function isPastDate(value) {
  return buildDate(value) < stripTime(new Date());
}

function differenceInDays(first, second) {
  return Math.round((stripTime(first) - stripTime(second)) / 86400000);
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildDate(value) {
  return value ? new Date(`${value}T00:00:00`) : new Date("Invalid Date");
}

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCampaignType(value) {
  const labels = {
    feriado: "Feriado",
    final_de_semana: "Final de semana",
    promocao_relampago: "Promoção relâmpago",
    pacote_familia: "Pacote família",
    casal: "Casal",
    aniversario: "Aniversário",
  };

  return labels[value] || value;
}

function formatDate(value) {
  if (!value) {
    return "Não informado";
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(Number(value || 0))}%`;
}

function formatMonthLabel(value) {
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(value);

  return label.charAt(0).toUpperCase() + label.slice(1);
}
