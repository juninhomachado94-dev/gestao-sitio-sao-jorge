import { getClients, getContracts, getFinance, getReservations } from "../../services/dataService.js";
import { formatCurrency } from "../../services/privacyService.js";
import {
  buildFixedExpenseAlerts,
  calculateFixedExpensesSummary,
  getFixedExpenses,
} from "../../services/fixedExpensesService.js";
import { buildCommercialAlerts, getCommercialDates } from "../../services/commercialDatesService.js";

export function getDashboardData(referenceDate = new Date()) {
  const selectedMonth = startOfMonth(referenceDate);
  const clients = getStoredClients();
  const reservations = getStoredReservations();
  const finance = getStoredFinance();
  const commercialDates = getCommercialDates();
  const contracts = getStoredGeneratedContracts();
  const monthReservations = reservations.filter((reservation) => (
    isDateInSelectedMonth(reservation.dataEntrada, selectedMonth)
    && reservation.reservationStatus !== "Cancelada"
  ));
  const financialSummary = calculateFinancialSummary(finance, selectedMonth);
  const pendingContracts = contracts.filter((contract) => isPendingContractForSelectedMonth({
    contract,
    reservations,
    selectedMonth,
  }));

  return {
    monthLabel: formatMonthLabel(selectedMonth),
    alerts: buildSystemAlerts({
      clients,
      finance,
      reservations,
      contracts: pendingContracts,
      selectedMonth,
      commercialDates,
    }),
    summaryCards: [
      {
        label: "Reservas do mês",
        value: String(monthReservations.length),
        detail: monthReservations.length ? "Reservas no mês selecionado" : "Nenhuma reserva cadastrada",
      },
      {
        label: "Total recebido",
        value: formatCurrency(financialSummary.receivedRevenue),
        detail: financialSummary.receivedRevenue ? "Receitas recebidas no mês" : "Nenhum lançamento financeiro cadastrado",
      },
      {
        label: "Gastos pagos",
        value: formatCurrency(financialSummary.totalExpenses),
        detail: financialSummary.totalExpenses ? "Gastos pagos no mês" : "Nenhum lançamento financeiro cadastrado",
      },
      {
        label: "Lucro líquido",
        value: formatCurrency(financialSummary.netProfit),
        detail: financialSummary.receivedRevenue || financialSummary.totalExpenses
          ? "Receitas do mês menos gastos pagos"
          : "Nenhum lançamento financeiro cadastrado",
      },
      {
        label: "Valores pendentes",
        value: formatCurrency(financialSummary.pendingRevenue),
        detail: financialSummary.pendingRevenue ? "Receitas pendentes no mês" : "Nenhum lançamento financeiro cadastrado",
      },
      {
        label: "Contratos pendentes",
        value: String(pendingContracts.length),
        detail: pendingContracts.length ? "Reservas do mês aguardando assinatura" : "Nenhum contrato pendente",
      },
    ],
    upcomingReservations: buildMonthReservationsRows(monthReservations, clients),
    pendingPayments: buildPendingPaymentsRows(finance.revenues, selectedMonth),
  };
}

function buildSystemAlerts({ clients, finance, reservations, contracts, selectedMonth, commercialDates }) {
  const today = startOfDay(new Date());
  const alerts = [
    ...finance.revenues
      .filter((revenue) => (
        revenue.status === "pendente"
        && getFinanceEntryValue(revenue) > 0
        && isDateInSelectedMonth(getFinanceEntryDate(revenue), selectedMonth)
      ))
      .map((revenue) => ({
        type: "finance",
        message: `Cliente ${getRevenueClientName(revenue)} possui ${formatCurrency(getFinanceEntryValue(revenue))} pendente`,
      })),
    ...buildFixedExpenseAlerts(new Date()),
    ...buildCommercialAlerts(new Date(), commercialDates, selectedMonth),
    ...reservations
      .filter((reservation) => (
        reservation.reservationStatus !== "Cancelada"
        && isDateInSelectedMonth(reservation.dataEntrada, selectedMonth)
        && buildDate(reservation.dataEntrada) >= today
      ))
      .sort((first, second) => buildDate(first.dataEntrada) - buildDate(second.dataEntrada))
      .map((reservation) => ({
        type: "reservation",
        message: `Próxima reserva: ${getReservationClientName(reservation, clients)} em ${formatDate(reservation.dataEntrada)}`,
      })),
    ...contracts
      .map((contract) => ({
        type: "contract",
        message: `Contrato pendente de assinatura: ${contract.client || contract.clientName || "Cliente não informado"}`,
      })),
  ];

  return alerts.slice(0, 5);
}

function getStoredFinance() {
  return normalizeFinance(getFinance());
}

function getStoredGeneratedContracts() {
  return getContracts();
}

function normalizeFinance(finance = {}) {
  return {
    revenues: Array.isArray(finance.revenues) ? finance.revenues : [],
    fixedExpenses: Array.isArray(finance.fixedExpenses) ? finance.fixedExpenses : [],
    variableExpenses: Array.isArray(finance.variableExpenses) ? finance.variableExpenses : [],
  };
}

function getStoredReservations() {
  return getReservations();
}

function getStoredClients() {
  return getClients();
}

function buildMonthReservationsRows(reservations, clients) {
  const today = startOfDay(new Date());

  return reservations
    .filter((reservation) => buildDate(reservation.dataEntrada) >= today)
    .sort((first, second) => buildDate(first.dataEntrada) - buildDate(second.dataEntrada))
    .slice(0, 5)
    .map((reservation) => [
      formatDate(reservation.dataEntrada),
      getReservationClientName(reservation, clients),
      reservation.eventType || "Não informado",
      reservation.reservationStatus || "Não informado",
      formatCurrency(reservation.totalValue),
    ]);
}

function buildPendingPaymentsRows(revenues, selectedMonth) {
  return revenues
    .filter((revenue) => (
      revenue.status === "pendente"
      && getFinanceEntryValue(revenue) > 0
      && isDateInSelectedMonth(getFinanceEntryDate(revenue), selectedMonth)
    ))
    .sort((first, second) => buildDate(getFinanceEntryDate(first)) - buildDate(getFinanceEntryDate(second)))
    .slice(0, 5)
    .map((revenue) => [
      revenue.clientName || revenue.reference || revenue.description || "Cliente não informado",
      formatDate(getFinanceEntryDate(revenue)),
      formatCurrency(getFinanceEntryValue(revenue)),
      "Pendente",
    ]);
}

function calculateFinancialSummary(finance, selectedMonth) {
  const fixedSummary = calculateFixedExpensesSummary(getFixedExpenses(), selectedMonth);
  const receivedRevenue = sumFinanceEntries(finance.revenues, {
    statuses: ["recebido", "pago"],
    selectedMonth,
  });
  const pendingRevenue = sumFinanceEntries(finance.revenues, {
    statuses: ["pendente"],
    selectedMonth,
  });
  const paidVariable = sumFinanceEntries(finance.variableExpenses, {
    statuses: ["pago"],
    selectedMonth,
  });
  const totalExpenses = fixedSummary.paid + paidVariable;

  return {
    receivedRevenue,
    pendingRevenue,
    paidFixed: fixedSummary.paid,
    paidVariable,
    totalExpenses,
    netProfit: receivedRevenue - totalExpenses,
  };
}

function sumFinanceEntries(items, { statuses, selectedMonth }) {
  return items
    .filter((item) => (
      statuses.includes(item.status)
      && isDateInSelectedMonth(getFinanceEntryDate(item), selectedMonth)
    ))
    .reduce((total, item) => total + getFinanceEntryValue(item), 0);
}

function isPendingContractForSelectedMonth({ contract, reservations, selectedMonth }) {
  if (contract.status === "assinado") {
    return false;
  }

  const reservation = reservations.find((item) => item.id === contract.reservationId);

  return Boolean(reservation && isDateInSelectedMonth(reservation.dataEntrada, selectedMonth));
}

function getFinanceEntryDate(entry) {
  return entry.date || entry.paymentDate || entry.dueDate || entry.dataEntrada || "";
}

function getFinanceEntryValue(entry) {
  return Number(entry.value ?? entry.amount ?? 0);
}

function getRevenueClientName(revenue) {
  return revenue.clientName
    || revenue.client
    || revenue.reference
    || revenue.description
    || "Cliente não informado";
}

function isDateInSelectedMonth(dateValue, selectedMonth) {
  if (!dateValue) {
    return false;
  }

  const date = buildDate(dateValue);

  return date.getFullYear() === selectedMonth.getFullYear()
    && date.getMonth() === selectedMonth.getMonth();
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildDate(dateValue) {
  return new Date(`${dateValue}T00:00:00`);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getReservationClientName(reservation, clients = []) {
  const client = clients.find((item) => item.id === reservation.clientId);

  return reservation.clientName
    || reservation.client
    || reservation.nomeCliente
    || reservation.customerName
    || client?.name
    || reservation.clientId
    || "Cliente não informado";
}

function formatDate(value) {
  if (!value) {
    return "Não informado";
  }

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
