import { getFinance, saveFinance } from "../../services/dataService.js";

export function getFinanceData() {
  const storedFinance = readStoredFinance();

  if (storedFinance) {
    return storedFinance;
  }

  // Dados mockados não devem ser carregados automaticamente em produção.
  return {
    revenues: [],
    fixedExpenses: [],
    variableExpenses: [],
  };
}

export function saveFinanceData(finance) {
  saveFinance(finance);
}

export function syncReservationRevenues(reservation, client) {
  const finance = getFinanceData();
  const manualRevenues = finance.revenues.filter((revenue) => (
    revenue.origin !== "reserva" || revenue.reservationId !== reservation.id
  ));
  const reservationRevenues = createReservationRevenues(reservation, client);

  saveFinanceData({
    ...finance,
    revenues: [
      ...reservationRevenues,
      ...manualRevenues,
    ],
  });
}

export function removeReservationRevenues(reservationId) {
  const finance = getFinanceData();

  saveFinanceData({
    ...finance,
    revenues: finance.revenues.filter((revenue) => (
      revenue.origin !== "reserva" || revenue.reservationId !== reservationId
    )),
  });
}

function createReservationRevenues(reservation, client) {
  const clientName = client?.name ?? "Cliente não encontrado";
  const depositValue = Number(reservation.depositValue || 0);
  const remainingValue = calculateRemaining(reservation.totalValue, reservation.depositValue);
  const reference = `${clientName} - ${formatDate(reservation.dataEntrada)}`;

  return [
    {
      id: `receita-reserva-${reservation.id}-entrada`,
      type: "receita",
      origin: "reserva",
      reservationId: reservation.id,
      clientName,
      description: `Entrada - Reserva ${clientName}`,
      reference,
      date: reservation.dataEntrada,
      value: depositValue,
      paymentMethod: reservation.paymentMethod,
      status: depositValue > 0 ? "recebido" : "pendente",
    },
    {
      id: `receita-reserva-${reservation.id}-restante`,
      type: "receita",
      origin: "reserva",
      reservationId: reservation.id,
      clientName,
      description: `Restante - Reserva ${clientName}`,
      reference,
      date: reservation.dataEntrada,
      value: remainingValue,
      paymentMethod: reservation.paymentMethod,
      status: "pendente",
    },
  ];
}

function readStoredFinance() {
  const finance = getFinance();
  const hasFinanceData = finance.revenues.length
    || finance.fixedExpenses.length
    || finance.variableExpenses.length;

  return hasFinanceData ? finance : null;
}

function calculateRemaining(totalValue, depositValue) {
  return Math.max(Number(totalValue || 0) - Number(depositValue || 0), 0);
}

function formatDate(value) {
  if (!value) {
    return "Data não informada";
  }

  const [year, month, day] = value.split("-");

  return `${day}/${month}/${year}`;
}
