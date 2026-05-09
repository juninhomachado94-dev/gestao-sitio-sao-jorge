import { createSummaryCard } from "../components/SummaryCard.js";
import { getFinance, getReservations } from "../../services/dataService.js";
import { formatCurrency } from "../../services/privacyService.js";
import { getCommercialDates, loadCommercialDates } from "../../services/commercialDatesService.js";
import {
  buildMarketingAnalysis,
  campaignStatuses,
  campaignTypes,
  getMarketingCampaigns,
  loadMarketingCampaigns,
  saveMarketingCampaign,
} from "../../services/marketingService.js";

export function createMarketingPage() {
  let selectedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let campaigns = getMarketingCampaigns();
  let commercialDates = getCommercialDates();
  let statusMessage = "";

  const page = document.createElement("section");
  const headerHost = document.createElement("div");
  const contentHost = document.createElement("div");
  const campaignModal = createCampaignModal({
    onSubmit: saveCampaign,
    onClose: closeCampaignModal,
  });

  page.className = "marketing-page";
  page.setAttribute("aria-labelledby", "marketing-title");
  page.append(headerHost, contentHost, campaignModal.element);

  Promise.all([
    loadMarketingCampaigns(),
    loadCommercialDates(selectedMonth.getFullYear()),
  ]).then(([loadedCampaigns, loadedDates]) => {
    campaigns = loadedCampaigns;
    commercialDates = loadedDates;
    render();
  });

  render();

  return page;

  function render() {
    const report = buildMarketingAnalysis({
      reservations: getReservations(),
      commercialDates,
      campaigns,
      finance: getFinance(),
      selectedMonth,
    });

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
      onCreateCampaign: openCampaignModal,
    }));
    contentHost.replaceChildren(createMarketingContent({
      report,
      campaigns: campaigns.filter((campaign) => overlapsMonth(campaign, selectedMonth)),
      statusMessage,
      onCreateCampaign: openCampaignModal,
    }));
  }

  function openCampaignModal(preset = {}) {
    campaignModal.open({
      name: preset.name || "",
      type: preset.type || "promocao_relampago",
      startDate: preset.startDate || toDateInputValue(new Date()),
      endDate: preset.endDate || preset.startDate || toDateInputValue(new Date()),
      promotionalValue: preset.promotionalValue || "",
      description: preset.description || "",
      notes: preset.notes || "",
      status: "planejada",
    });
  }

  async function saveCampaign(formData) {
    if (!formData.name || !formData.startDate || !formData.endDate) {
      statusMessage = "Preencha nome, data inicial e data final da campanha.";
      render();
      return;
    }

    const campaign = {
      id: `campanha-${Date.now()}`,
      ...formData,
      promotionalValue: Number(formData.promotionalValue || 0),
    };
    const result = await saveMarketingCampaign(campaign);

    campaigns = result.ok
      ? [result.campaign, ...campaigns]
      : [campaign, ...campaigns];
    statusMessage = result.ok
      ? "Campanha criada e textos automáticos gerados."
      : "Campanha salva localmente. Verifique a tabela marketing_campaigns no Supabase.";
    closeCampaignModal();
    render();
  }

  function closeCampaignModal() {
    campaignModal.close();
  }
}

function createHeader({ monthLabel, onPreviousMonth, onCurrentMonth, onNextMonth, onCreateCampaign }) {
  const header = document.createElement("div");
  const textGroup = document.createElement("div");
  const kicker = document.createElement("p");
  const title = document.createElement("h2");
  const intro = document.createElement("p");
  const controls = document.createElement("div");

  header.className = "marketing-page__header";
  textGroup.className = "marketing-page__header-text";
  kicker.className = "page-panel__kicker";
  kicker.textContent = "Sítio São Jorge";
  title.className = "marketing-page__title";
  title.id = "marketing-title";
  title.textContent = "Marketing";
  intro.className = "marketing-page__intro";
  intro.textContent = `Central de oportunidades, campanhas e ocupação de ${monthLabel}.`;
  controls.className = "marketing-month-controls";

  controls.append(
    createButton("Mês anterior", "button button--secondary", onPreviousMonth),
    createButton("Mês atual", "button button--secondary", onCurrentMonth),
    createButton("Próximo mês", "button button--secondary", onNextMonth),
    createButton("Nova campanha", "button button--primary", onCreateCampaign),
  );
  textGroup.append(kicker, title, intro);
  header.append(textGroup, controls);

  return header;
}

function createMarketingContent({ report, campaigns, statusMessage, onCreateCampaign }) {
  const fragment = document.createDocumentFragment();
  const summary = document.createElement("div");

  summary.className = "marketing-summary";
  report.cards.forEach((card) => summary.append(createMarketingCard(card)));

  fragment.append(
    summary,
    createMonthlyOpportunitiesSection(report, onCreateCampaign),
    createOccupationThermometer(report),
    createOpportunitiesSection(report, onCreateCampaign),
    createMarketingDashboard(report),
    createCampaignsSection({ campaigns, statusMessage }),
  );

  return fragment;
}

function createMarketingCard(card) {
  const wrapper = document.createElement("div");
  wrapper.className = `marketing-card marketing-card--${card.tone || "neutral"}`;
  wrapper.append(createSummaryCard(card));
  return wrapper;
}

function createMonthlyOpportunitiesSection(report, onCreateCampaign) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const subtitle = document.createElement("p");
  const cards = document.createElement("div");
  const alerts = document.createElement("div");
  const suggestions = document.createElement("div");
  const opportunity = report.commercialOpportunity;

  section.className = "marketing-month-opportunities";
  header.className = "marketing-section-header marketing-section-header--stacked";
  title.textContent = "Oportunidades do mês";
  subtitle.textContent = "Análise automática de ocupação, datas livres, feriados e potencial comercial disponível.";
  cards.className = "marketing-month-opportunities__cards";
  alerts.className = "marketing-month-opportunities__alerts";
  suggestions.className = "marketing-month-opportunities__suggestions";

  opportunity.cards.forEach((card) => {
    cards.append(createMonthlyOpportunityCard(card));
  });

  if (!opportunity.alerts.length) {
    const empty = document.createElement("p");
    empty.className = "marketing-empty";
    empty.textContent = "Nenhum alerta comercial importante neste mês.";
    alerts.append(empty);
  }

  opportunity.alerts.forEach((alert) => {
    alerts.append(createCommercialInsight(alert, onCreateCampaign));
  });

  opportunity.suggestions.forEach((suggestion) => {
    suggestions.append(createCommercialSuggestion(suggestion, onCreateCampaign));
  });

  header.append(title, subtitle);
  section.append(header, cards, createSubsectionTitle("Alertas inteligentes"), alerts, createSubsectionTitle("Sugestões automáticas"), suggestions);
  return section;
}

function createMonthlyOpportunityCard(card) {
  const article = document.createElement("article");
  const label = document.createElement("span");
  const value = document.createElement("strong");
  const detail = document.createElement("p");

  article.className = `marketing-opportunity-card marketing-opportunity-card--${card.tone || "neutral"}`;
  label.textContent = card.label;
  value.textContent = card.value;
  detail.textContent = card.detail;

  article.append(label, value, detail);
  return article;
}

function createCommercialInsight(alert, onCreateCampaign) {
  const card = document.createElement("article");
  const text = document.createElement("div");
  const title = document.createElement("h4");
  const description = document.createElement("p");
  const button = createButton("Criar campanha", "button button--secondary", () => onCreateCampaign({
    name: alert.title,
    type: alert.tone === "danger" ? "promocao_relampago" : "final_de_semana",
    description: alert.text,
    notes: "Criada a partir das oportunidades do mês.",
  }));

  card.className = `marketing-commercial-insight marketing-commercial-insight--${alert.tone || "neutral"}`;
  text.className = "marketing-commercial-insight__text";
  title.textContent = alert.title;
  description.textContent = alert.text;
  text.append(title, description);
  card.append(text, button);
  return card;
}

function createCommercialSuggestion(suggestion, onCreateCampaign) {
  const card = document.createElement("article");
  const title = document.createElement("h4");
  const text = document.createElement("p");
  const button = createButton("Usar sugestão", "button button--secondary", () => onCreateCampaign({
    name: suggestion.title,
    type: suggestion.tone === "danger" ? "promocao_relampago" : "pacote_familia",
    description: suggestion.text,
    notes: "Sugestão automática do sistema.",
  }));

  card.className = `marketing-commercial-suggestion marketing-commercial-suggestion--${suggestion.tone || "neutral"}`;
  title.textContent = suggestion.title;
  text.textContent = suggestion.text;
  card.append(title, text, button);
  return card;
}

function createSubsectionTitle(text) {
  const title = document.createElement("h4");
  title.className = "marketing-subsection-title";
  title.textContent = text;
  return title;
}

function createOccupationThermometer(report) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const status = document.createElement("strong");
  const track = document.createElement("div");
  const fill = document.createElement("span");
  const details = document.createElement("p");

  section.className = `marketing-thermometer marketing-thermometer--${report.occupationStatus.tone}`;
  header.className = "marketing-thermometer__header";
  title.textContent = "Termômetro de ocupação";
  status.textContent = report.occupationStatus.label;
  track.className = "marketing-thermometer__track";
  fill.className = "marketing-thermometer__fill";
  fill.style.width = `${Math.min(Math.max(report.occupancyRate, 0), 100)}%`;
  details.textContent = `${report.occupiedDays} dia(s) ocupados e ${report.freeDays} dia(s) livres no mês.`;

  header.append(title, status);
  track.append(fill);
  section.append(header, track, details);

  return section;
}

function createOpportunitiesSection(report, onCreateCampaign) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const list = document.createElement("div");

  section.className = "marketing-opportunities";
  header.className = "marketing-section-header";
  title.textContent = "Oportunidades detectadas";
  list.className = "marketing-opportunities__list";

  if (!report.opportunities.length) {
    const empty = document.createElement("p");
    empty.className = "marketing-empty";
    empty.textContent = "Nenhuma oportunidade crítica detectada neste mês.";
    list.append(empty);
  }

  report.opportunities.forEach((opportunity) => {
    const card = document.createElement("article");
    const text = document.createElement("div");
    const itemTitle = document.createElement("h4");
    const description = document.createElement("p");
    const suggestion = document.createElement("strong");
    const action = createButton("Criar campanha", "button button--secondary", () => onCreateCampaign({
      name: opportunity.suggestion,
      type: mapOpportunityToCampaignType(opportunity.type),
      description: opportunity.description,
      notes: opportunity.title,
    }));

    card.className = `marketing-opportunity marketing-opportunity--${opportunity.tone}`;
    text.className = "marketing-opportunity__text";
    itemTitle.textContent = opportunity.title;
    description.textContent = opportunity.description;
    suggestion.textContent = opportunity.suggestion;

    text.append(itemTitle, description, suggestion);
    card.append(text, action);
    list.append(card);
  });

  header.append(title);
  section.append(header, list);
  return section;
}

function createMarketingDashboard(report) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const grid = document.createElement("div");

  section.className = "marketing-dashboard";
  header.className = "marketing-section-header";
  title.textContent = "Dashboard de Marketing";
  grid.className = "marketing-dashboard__grid";

  grid.append(
    createProgressPanel("Ocupação", report.occupancyRate, `${report.occupiedDays}/${report.daysInMonth} dias`),
    createMiniBars("Feriados", [
      { label: "Alugados", value: report.holidayDates.length - report.freeHolidays.length, tone: "success" },
      { label: "Livres", value: report.freeHolidays.length, tone: "danger" },
    ]),
    createMiniBars("Finais de semana", [
      { label: "Ocupados", value: report.weekendSlots.length - report.freeWeekends.length, tone: "success" },
      { label: "Vagos", value: report.freeWeekends.length, tone: "warning" },
    ]),
    createMiniBars("Campanhas", [
      { label: "Ativas", value: report.activeCampaigns.length, tone: "info" },
      { label: "Finalizadas", value: report.finishedCampaigns.length, tone: "neutral" },
    ]),
  );

  header.append(title);
  section.append(header, grid);

  return section;
}

function createProgressPanel(title, percent, detail) {
  const panel = document.createElement("article");
  const heading = document.createElement("h4");
  const value = document.createElement("strong");
  const track = document.createElement("div");
  const fill = document.createElement("span");
  const text = document.createElement("p");

  panel.className = "marketing-panel";
  heading.textContent = title;
  value.textContent = formatPercent(percent);
  track.className = "marketing-panel__track";
  fill.className = "marketing-panel__fill";
  fill.style.width = `${Math.min(Math.max(percent, 0), 100)}%`;
  text.textContent = detail;

  track.append(fill);
  panel.append(heading, value, track, text);
  return panel;
}

function createMiniBars(title, items) {
  const panel = document.createElement("article");
  const heading = document.createElement("h4");
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  panel.className = "marketing-panel";
  heading.textContent = title;
  panel.append(heading);

  items.forEach((item) => {
    const row = document.createElement("div");
    const label = document.createElement("span");
    const track = document.createElement("div");
    const fill = document.createElement("i");
    const value = document.createElement("strong");

    row.className = "marketing-panel__bar";
    label.textContent = item.label;
    track.className = "marketing-panel__bar-track";
    fill.className = `marketing-panel__bar-fill is-${item.tone}`;
    fill.style.width = `${Math.max((item.value / maxValue) * 100, item.value ? 8 : 0)}%`;
    value.textContent = String(item.value);

    track.append(fill);
    row.append(label, track, value);
    panel.append(row);
  });

  return panel;
}

function createCampaignsSection({ campaigns, statusMessage }) {
  const section = document.createElement("section");
  const header = document.createElement("div");
  const title = document.createElement("h3");
  const list = document.createElement("div");

  section.className = "marketing-campaigns";
  header.className = "marketing-section-header";
  title.textContent = "Central de campanhas";
  list.className = "marketing-campaigns__list";

  if (statusMessage) {
    const status = document.createElement("p");
    status.className = "marketing-status";
    status.textContent = statusMessage;
    list.append(status);
  }

  if (!campaigns.length) {
    const empty = document.createElement("p");
    empty.className = "marketing-empty";
    empty.textContent = "Nenhuma campanha cadastrada para este mês.";
    list.append(empty);
  }

  campaigns.forEach((campaign) => {
    const card = document.createElement("article");
    const headerGroup = document.createElement("div");
    const titleElement = document.createElement("h4");
    const meta = document.createElement("p");
    const generated = document.createElement("div");

    card.className = "marketing-campaign";
    headerGroup.className = "marketing-campaign__header";
    titleElement.textContent = campaign.name;
    meta.textContent = `${formatCampaignType(campaign.type)} · ${formatDate(campaign.startDate)} até ${formatDate(campaign.endDate)} · ${formatCurrency(campaign.promotionalValue)}`;
    generated.className = "marketing-generated-texts";

    generated.append(
      createGeneratedText("Legenda Instagram", campaign.instagramCaption),
      createGeneratedText("Texto WhatsApp", campaign.whatsappText),
      createGeneratedText("Story", campaign.storyText),
      createGeneratedText("CTA", campaign.cta),
    );

    headerGroup.append(titleElement, createStatusPill(campaign.status));
    card.append(headerGroup, meta, generated);
    list.append(card);
  });

  header.append(title);
  section.append(header, list);

  return section;
}

function createGeneratedText(label, value) {
  const block = document.createElement("div");
  const title = document.createElement("span");
  const text = document.createElement("p");

  block.className = "marketing-generated-text";
  title.textContent = label;
  text.textContent = value || "Gerado ao salvar campanha.";
  block.append(title, text);

  return block;
}

function createStatusPill(status) {
  const pill = document.createElement("span");
  pill.className = `marketing-status-pill marketing-status-pill--${status || "planejada"}`;
  pill.textContent = formatStatus(status);
  return pill;
}

function createCampaignModal({ onSubmit, onClose }) {
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

  overlay.className = "marketing-modal";
  overlay.hidden = true;
  dialog.className = "marketing-modal__dialog";
  header.className = "marketing-modal__header";
  title.textContent = "Nova campanha";
  closeButton.className = "marketing-modal__close";
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.addEventListener("click", onClose);
  form.className = "marketing-form";
  actions.className = "marketing-form__actions";
  saveButton.className = "button button--primary";
  saveButton.type = "submit";
  saveButton.textContent = "Salvar campanha";

  [
    { key: "name", label: "Nome da campanha", type: "text" },
    { key: "type", label: "Tipo", type: "select", options: campaignTypes },
    { key: "startDate", label: "Data inicial", type: "date" },
    { key: "endDate", label: "Data final", type: "date" },
    { key: "promotionalValue", label: "Valor promocional", type: "number" },
    { key: "description", label: "Descrição", type: "textarea" },
    { key: "notes", label: "Observações", type: "textarea" },
    { key: "status", label: "Status", type: "select", options: campaignStatuses },
  ].forEach((config) => {
    const field = createField(config);
    fields[config.key] = field.input;
    form.append(field.wrapper);
  });

  actions.append(cancelButton, saveButton);
  form.append(actions);
  header.append(title, closeButton);
  dialog.append(header, form);
  overlay.append(dialog);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit(readFields(fields));
  });

  return {
    element: overlay,
    open(campaign) {
      Object.entries(fields).forEach(([key, input]) => {
        input.value = campaign[key] ?? "";
      });
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

  wrapper.className = "marketing-form__field";
  text.textContent = label;
  input.name = key;

  if (type === "textarea") {
    input.rows = 4;
  } else if (type === "select") {
    options.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option;
      optionElement.textContent = key === "status" ? formatStatus(option) : formatCampaignType(option);
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

function mapOpportunityToCampaignType(type) {
  const map = {
    feriado: "feriado",
    final_de_semana: "final_de_semana",
    baixa_ocupacao: "promocao_relampago",
    dias_vagos: "pacote_familia",
    promocao: "feriado",
  };

  return map[type] || "promocao_relampago";
}

function overlapsMonth(campaign, selectedMonth) {
  const start = buildDate(campaign.startDate);
  const end = buildDate(campaign.endDate || campaign.startDate);
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);

  return start <= monthEnd && end >= monthStart;
}

function buildDate(value) {
  return value ? new Date(`${value}T00:00:00`) : new Date("Invalid Date");
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

function formatStatus(value) {
  const labels = {
    planejada: "Planejada",
    publicada: "Publicada",
    finalizada: "Finalizada",
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

function formatPercent(value) {
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(Number(value || 0))}%`;
}
