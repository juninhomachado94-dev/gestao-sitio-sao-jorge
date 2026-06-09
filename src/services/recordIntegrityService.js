export function isValidClientReference(record = {}, clients = []) {
  const clientId = normalizeId(record.clientId ?? record.client_id);

  if (!clientId) {
    return false;
  }

  return clients.some((client) => normalizeId(client.id) === clientId);
}

export function getDisplayClientName(record = {}, clients = [], fallback = "Cliente não informado") {
  const savedName = [
    record.clientName,
    record.client_name,
    record.client,
    record.nomeCliente,
    record.customerName,
  ].find(isUsableClientName);

  if (savedName) {
    return String(savedName).trim();
  }

  const clientId = normalizeId(record.clientId ?? record.client_id);
  const linkedClient = clients.find((client) => normalizeId(client.id) === clientId);

  return isUsableClientName(linkedClient?.name) ? linkedClient.name.trim() : fallback;
}

export function isValidReservation(reservation = {}, clients = []) {
  return Boolean(
    normalizeId(reservation.id)
    && reservation.dataEntrada
    && isValidClientReference(reservation, clients),
  );
}

export function filterValidReservations(reservations = [], clients = []) {
  return reservations.filter((reservation) => isValidReservation(reservation, clients));
}

export function isValidFinanceEntry(entry = {}, clients = [], reservations = []) {
  const clientIds = new Set(clients.map((client) => normalizeId(client.id)).filter(Boolean));
  const reservationIds = new Set(
    filterValidReservations(reservations, clients)
      .map((reservation) => normalizeId(reservation.id))
      .filter(Boolean),
  );

  return isValidLinkedRecord(entry, clientIds, reservationIds);
}

export function filterFinanceForPrimaryViews(finance = {}, clients = [], reservations = []) {
  const clientIds = new Set(clients.map((client) => normalizeId(client.id)).filter(Boolean));
  const reservationIds = new Set(
    filterValidReservations(reservations, clients)
      .map((reservation) => normalizeId(reservation.id))
      .filter(Boolean),
  );

  return {
    revenues: filterValidLinkedRecords(finance.revenues, clientIds, reservationIds),
    fixedExpenses: filterValidLinkedRecords(finance.fixedExpenses, clientIds, reservationIds),
    variableExpenses: filterValidLinkedRecords(finance.variableExpenses, clientIds, reservationIds),
  };
}

export function filterValidContracts(contracts = [], clients = [], reservations = []) {
  const clientIds = new Set(clients.map((client) => normalizeId(client.id)).filter(Boolean));
  const reservationIds = new Set(
    filterValidReservations(reservations, clients)
      .map((reservation) => normalizeId(reservation.id))
      .filter(Boolean),
  );

  return contracts.filter((contract) => {
    const clientId = normalizeId(contract.clientId ?? contract.client_id);
    const reservationId = normalizeId(contract.reservationId ?? contract.reservation_id);

    return Boolean(
      reservationId
      && reservationIds.has(reservationId)
      && (!clientId || clientIds.has(clientId)),
    );
  });
}

export function getHistoricalContracts(contracts = [], clients = [], reservations = []) {
  const reservationIds = new Set(reservations.map((reservation) => normalizeId(reservation.id)).filter(Boolean));

  return contracts.filter((contract) => {
    const reservationId = normalizeId(contract.reservationId ?? contract.reservation_id);
    const hasStoredHistory = Boolean(
      normalizeId(contract.id)
      && normalizeId(contract.token)
      && isUsableClientName(getDisplayClientName(contract, clients, "")),
    );

    return hasStoredHistory || (reservationId && reservationIds.has(reservationId));
  });
}

function filterValidLinkedRecords(records, clientIds, reservationIds) {
  return (Array.isArray(records) ? records : []).filter((record) => (
    isValidLinkedRecord(record, clientIds, reservationIds)
  ));
}

function isValidLinkedRecord(record, clientIds, reservationIds) {
  const clientId = normalizeId(record.clientId ?? record.client_id);
  const reservationId = normalizeId(record.reservationId ?? record.reservation_id);

  if (clientId && !clientIds.has(clientId)) {
    return false;
  }

  if (reservationId && !reservationIds.has(reservationId)) {
    return false;
  }

  return true;
}

function isUsableClientName(value) {
  const name = String(value || "").trim();

  return Boolean(name && !isUuid(name));
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function normalizeId(value) {
  return String(value || "").trim();
}
