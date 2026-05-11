import { createDashboardPage } from "./DashboardPage.js";
import { createBudgetsPage } from "./BudgetsPage.js";
import { createClientsPage } from "./ClientsPage.js";
import { createCalendarPage } from "./CalendarPage.js";
import { createCommercialCalendarPage } from "./CommercialCalendarPage.js";
import { createContractsPage } from "./ContractsPage.js";
import { createFinancePage } from "./FinancePage.js";
import { createMarketingPage } from "./MarketingPage.js";
import { createReservationsPage } from "./ReservationsPage.js";
import { createSettingsPage } from "./SettingsPage.js";
import { createSimplePage } from "./SimplePage.js";
import { createStrategicReportPage } from "./StrategicReportPage.js";

export const pageRegistry = {
  dashboard: createDashboardPage,
  clientes: createClientsPage,
  reservas: createReservationsPage,
  orcamentos: createBudgetsPage,
  calendario: createCalendarPage,
  "calendario-comercial": createCommercialCalendarPage,
  marketing: createMarketingPage,
  financeiro: createFinancePage,
  "relatorio-estrategico": createStrategicReportPage,
  contratos: createContractsPage,
  configuracoes: createSettingsPage,
};
