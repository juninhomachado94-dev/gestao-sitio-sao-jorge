import { createDataTable } from "../components/DataTable.js";
import { createSummaryCard } from "../components/SummaryCard.js";
import { getCurrentAuthUser } from "../../services/authService.js";
import { getDashboardData } from "./dashboardData.js";

export function createDashboardPage() {
  let selectedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const page = document.createElement("section");
  const header = document.createElement("div");
  const contentHost = document.createElement("div");
  const greeting = createGreetingCard();

  page.className = "dashboard-page";
  page.setAttribute("aria-labelledby", "dashboard-title");
  header.className = "dashboard-page__header";

  page.append(header, greeting.element, contentHost);
  greeting.loadUser();

  render();

  return page;

  function render() {
    const dashboardData = getDashboardData(selectedMonth);

    header.replaceChildren(createHeaderContent({
      monthLabel: dashboardData.monthLabel,
      onPreviousMonth() {
        selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
        render();
      },
      onNextMonth() {
        selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
        render();
      },
      onCurrentMonth() {
        const today = new Date();
        selectedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        render();
      },
    }));

    contentHost.replaceChildren(createDashboardContent(dashboardData));
  }
}

function createHeaderContent({ monthLabel, onPreviousMonth, onNextMonth, onCurrentMonth }) {
  const fragment = document.createDocumentFragment();
  const textGroup = document.createElement("div");
  const kicker = document.createElement("p");
  const title = document.createElement("h2");
  const intro = document.createElement("p");
  const controls = document.createElement("div");
  const previousButton = document.createElement("button");
  const currentButton = document.createElement("button");
  const nextButton = document.createElement("button");

  textGroup.className = "dashboard-page__header-text";
  kicker.className = "page-panel__kicker";
  kicker.textContent = "Sítio São Jorge";

  title.className = "dashboard-page__title";
  title.id = "dashboard-title";
  title.textContent = "Dashboard";

  intro.className = "dashboard-page__intro";
  intro.textContent = `Resumo da gestão de ${monthLabel}.`;

  controls.className = "dashboard-month-controls";

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
  fragment.append(textGroup, controls);

  return fragment;
}

function createDashboardContent(dashboardData) {
  const fragment = document.createDocumentFragment();
  const alertsSection = createAlertsSection(dashboardData.alerts);
  const summaryGrid = document.createElement("div");
  const tablesGrid = document.createElement("div");

  summaryGrid.className = "dashboard-summary";
  dashboardData.summaryCards.forEach((card) => summaryGrid.append(createSummaryCard(card)));

  tablesGrid.className = "dashboard-tables";
  tablesGrid.append(
    createDataTable({
      title: "Próximas reservas do mês",
      columns: ["Data", "Cliente", "Tipo", "Status", "Valor"],
      rows: dashboardData.upcomingReservations,
      emptyMessage: "Nenhuma reserva cadastrada",
    }),
    createDataTable({
      title: "Pagamentos pendentes do mês",
      columns: ["Cliente", "Data da reserva", "Valor restante", "Status"],
      rows: dashboardData.pendingPayments,
      emptyMessage: "Nenhum lançamento financeiro cadastrado",
    }),
  );

  fragment.append(alertsSection, summaryGrid, tablesGrid);

  return fragment;
}

function createGreetingCard() {
  const section = document.createElement("section");
  const title = document.createElement("h3");
  const text = document.createElement("p");

  section.className = "dashboard-greeting";
  title.className = "dashboard-greeting__title";
  title.textContent = `${getGreetingByHour()}, seja bem-vindo`;
  text.className = "dashboard-greeting__text";
  text.textContent = "Que bom ter você por aqui. Vamos organizar as reservas de hoje?";

  section.append(title, text);

  return {
    element: section,
    async loadUser() {
      const user = await getCurrentAuthUser();
      const name = getUserDisplayName(user);

      title.textContent = `${getGreetingByHour()}, ${name} 👋`;
    },
  };
}

function getGreetingByHour() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return "Bom dia";
  }

  if (hour >= 12 && hour < 18) {
    return "Boa tarde";
  }

  return "Boa noite";
}

function getUserDisplayName(user) {
  const metadataName = user?.user_metadata?.name?.trim();

  if (metadataName) {
    return metadataName;
  }

  const emailName = user?.email?.split("@")[0] || "Usuário";

  return emailName.charAt(0).toUpperCase() + emailName.slice(1);
}

function createAlertsSection(alerts) {
  const section = document.createElement("section");
  const title = document.createElement("h3");
  const list = document.createElement("div");

  section.className = "dashboard-alerts";
  title.className = "dashboard-alerts__title";
  title.textContent = "Alertas do sistema";
  list.className = "dashboard-alerts__list";

  if (!alerts.length) {
    const empty = document.createElement("p");

    empty.className = "dashboard-alerts__empty";
    empty.textContent = "Nenhum alerta no momento";
    section.append(title, empty);

    return section;
  }

  alerts.forEach((alert) => {
    const item = document.createElement("article");
    const marker = document.createElement("span");
    const message = document.createElement("p");

    item.className = `dashboard-alerts__item dashboard-alerts__item--${alert.type}`;
    marker.className = "dashboard-alerts__marker";
    marker.setAttribute("aria-hidden", "true");
    message.textContent = alert.message;

    item.append(marker, message);
    list.append(item);
  });

  section.append(title, list);

  return section;
}
