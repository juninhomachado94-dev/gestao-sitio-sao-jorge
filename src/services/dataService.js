const CLIENTS_STORAGE_KEY = "clientes";
const RESERVATIONS_STORAGE_KEY = "reservas";
const FINANCE_STORAGE_KEY = "sitio-sao-jorge-finance";
const CONTRACTS_STORAGE_KEY = "sitio-sao-jorge-generated-contracts";
const SETTINGS_STORAGE_KEY = "sitio-sao-jorge-settings";
const OWNER_SIGNATURE_STORAGE_KEY = "assinatura_proprietario";
const useOnlineDatabase = true;

const emptyFinance = {
  revenues: [],
  fixedExpenses: [],
  variableExpenses: [],
};
const demoRecordTerms = [
  "mariana alves",
  "carlos mendes",
  "ana paula",
  "cliente teste",
  "reserva teste",
];
let hasLoadedFinanceFromSupabase = false;
let hasLoadedClientsFromSupabase = false;
let hasLoadedReservationsFromSupabase = false;
let hasLoadedContractsFromSupabase = false;
let clientsMutationVersion = 0;
let reservationsMutationVersion = 0;
let financeMutationVersion = 0;
let contractsMutationVersion = 0;
let realtimeChannel = null;

export function getClients() {
  if (useOnlineDatabase) {
    return getOnlineClients();
  }

  return sanitizeList(readList(CLIENTS_STORAGE_KEY), "clientes");
}

export function saveClients(data) {
  if (useOnlineDatabase) {
    saveOnlineClients(data);
    return;
  }

  writeValue(CLIENTS_STORAGE_KEY, sanitizeList(data, "clientes"));
}

export function deleteClient(clientId) {
  if (!clientId) {
    return;
  }

  const clients = sanitizeList(readList(CLIENTS_STORAGE_KEY), "clientes")
    .filter((client) => client.id !== clientId);

  clientsMutationVersion += 1;
  writeValue(CLIENTS_STORAGE_KEY, clients);

  if (useOnlineDatabase) {
    deleteOnlineClient(clientId);
  }
}

export function getReservations() {
  if (useOnlineDatabase) {
    return getOnlineReservations();
  }

  return sanitizeList(readList(RESERVATIONS_STORAGE_KEY), "reservas");
}

export function saveReservations(data) {
  if (useOnlineDatabase) {
    saveOnlineReservations(data);
    return;
  }

  writeValue(RESERVATIONS_STORAGE_KEY, sanitizeList(data, "reservas"));
}

export function getFinance() {
  if (useOnlineDatabase) {
    return getOnlineFinance();
  }

  const finance = sanitizeFinance(readValue(FINANCE_STORAGE_KEY, emptyFinance));

  return {
    revenues: Array.isArray(finance.revenues) ? finance.revenues : [],
    fixedExpenses: Array.isArray(finance.fixedExpenses) ? finance.fixedExpenses : [],
    variableExpenses: Array.isArray(finance.variableExpenses) ? finance.variableExpenses : [],
  };
}

export function saveFinance(data) {
  if (useOnlineDatabase) {
    saveOnlineFinance(data);
    return;
  }

  writeValue(FINANCE_STORAGE_KEY, sanitizeFinance(data));
}

export function getContracts() {
  if (useOnlineDatabase) {
    return getOnlineContracts();
  }

  return sanitizeList(readList(CONTRACTS_STORAGE_KEY), "contratos");
}

export function saveContracts(data) {
  if (useOnlineDatabase) {
    saveOnlineContracts(data);
    return;
  }

  writeValue(CONTRACTS_STORAGE_KEY, sanitizeList(data, "contratos"));
}

export async function findContractByToken(token) {
  const normalizedToken = token?.trim();

  if (!normalizedToken) {
    return null;
  }

  const localContract = sanitizeList(readList(CONTRACTS_STORAGE_KEY), "contratos")
    .find((contract) => contract.token === normalizedToken);

  if (localContract) {
    return localContract;
  }

  if (!useOnlineDatabase) {
    return null;
  }

  return findOnlineContractByToken(normalizedToken);
}

export function saveContract(contract) {
  if (!contract?.id) {
    return;
  }

  const contracts = sanitizeList(readList(CONTRACTS_STORAGE_KEY), "contratos");
  const exists = contracts.some((item) => item.id === contract.id);
  const nextContracts = exists
    ? contracts.map((item) => (item.id === contract.id ? contract : item))
    : [contract, ...contracts];

  contractsMutationVersion += 1;
  writeValue(CONTRACTS_STORAGE_KEY, nextContracts);

  if (useOnlineDatabase) {
    upsertSingleContractToSupabase(contract);
  }
}

export function getSettings() {
  return readValue(SETTINGS_STORAGE_KEY, {});
}

export function saveSettings(data) {
  writeValue(SETTINGS_STORAGE_KEY, data);
}

export function getOwnerSignature() {
  return readValue(OWNER_SIGNATURE_STORAGE_KEY, null);
}

export function saveOwnerSignature(signature) {
  writeValue(OWNER_SIGNATURE_STORAGE_KEY, signature);
}

export function removeOwnerSignature() {
  window.localStorage.removeItem(OWNER_SIGNATURE_STORAGE_KEY);
}

export async function clearAllData({ keepOwnerSignature = false } = {}) {
  if (useOnlineDatabase) {
    logSupabaseTableDiagnostics();
    await clearSupabaseTables([
      "generated_contracts",
      "finance_entries",
      "reservations",
      "clients",
    ]);
  }

  clearLocalSystemData({ keepOwnerSignature });
  resetDataSyncState();
}

export async function subscribeToRealtimeChanges(onChange) {
  if (!useOnlineDatabase || realtimeChannel) {
    return () => {};
  }

  const supabase = await getSupabaseClient();
  realtimeChannel = supabase
    .channel("sitio-sao-jorge-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, handleRealtimeChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, handleRealtimeChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "finance_entries" }, handleRealtimeChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "generated_contracts" }, handleRealtimeChange)
    .subscribe((status) => {
      console.log("Status Supabase Realtime:", status);
    });

  return () => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  };

  async function handleRealtimeChange(payload) {
    console.log("Atualização recebida via Supabase Realtime:", payload);
    await refreshOnlineDataFromSupabase();
    onChange?.(payload);
  }
}

function readList(key) {
  const value = readValue(key, []);

  return Array.isArray(value) ? value : [];
}

function readValue(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key);

    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.error("Erro ao conectar com Supabase para buscar clientes:", error);
    return fallback;
  }
}

function writeValue(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

async function refreshOnlineDataFromSupabase() {
  await Promise.all([
    syncClientsFromSupabase(readList(CLIENTS_STORAGE_KEY), clientsMutationVersion, true),
    syncReservationsFromSupabase(readList(RESERVATIONS_STORAGE_KEY), reservationsMutationVersion, true),
    syncFinanceFromSupabase(normalizeFinance(readValue(FINANCE_STORAGE_KEY, emptyFinance)), financeMutationVersion, true),
    syncContractsFromSupabase(readList(CONTRACTS_STORAGE_KEY), contractsMutationVersion, true),
  ]);
}

function clearLocalSystemData({ keepOwnerSignature = false } = {}) {
  [
    CLIENTS_STORAGE_KEY,
    RESERVATIONS_STORAGE_KEY,
    FINANCE_STORAGE_KEY,
    CONTRACTS_STORAGE_KEY,
  ].forEach((key) => window.localStorage.removeItem(key));

  if (!keepOwnerSignature) {
    window.localStorage.removeItem(OWNER_SIGNATURE_STORAGE_KEY);
  }
}

function resetDataSyncState() {
  hasLoadedFinanceFromSupabase = true;
  hasLoadedClientsFromSupabase = true;
  hasLoadedReservationsFromSupabase = true;
  hasLoadedContractsFromSupabase = true;
  clientsMutationVersion += 1;
  reservationsMutationVersion += 1;
  financeMutationVersion += 1;
  contractsMutationVersion += 1;
}

async function clearSupabaseTables(tableNames) {
  const supabase = await getSupabaseClient();

  for (const tableName of tableNames) {
    console.log(`Iniciando limpeza da tabela Supabase: ${tableName}`);

    const { data, error } = await supabase
      .from(tableName)
      .delete()
      .gte("created_at", "1900-01-01")
      .select("id");

    console.log(`Resultado da limpeza da tabela ${tableName}:`, {
      tableName,
      data,
      error,
    });

    if (error) {
      console.error(`Erro detalhado ao limpar tabela ${tableName} no Supabase:`, {
        tableName,
        data,
        error,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    console.log(`Tabela ${tableName} limpa no Supabase.`);
  }

  console.log("sincronizacao concluida");
}

function logSupabaseTableDiagnostics() {
  console.log("Diagnóstico de nomes de tabelas usados na limpeza total:", {
    clients: { usadoNaLimpeza: true },
    reservations: { usadoNaLimpeza: true },
    finance_entries: { usadoNaLimpeza: true },
    generated_contracts: { usadoNaLimpeza: true },
  });
}

function getOnlineClients() {
  const localClients = sanitizeList(readList(CLIENTS_STORAGE_KEY), "clientes");

  syncClientsFromSupabase(localClients, clientsMutationVersion);

  return localClients;
}

function saveOnlineClients(data) {
  const previousLocalClients = readList(CLIENTS_STORAGE_KEY);
  const clients = sanitizeList(data, "clientes");

  clientsMutationVersion += 1;
  writeValue(CLIENTS_STORAGE_KEY, clients);

  if (!clients.length && !previousLocalClients.length && !hasLoadedClientsFromSupabase) {
    return;
  }

  if (!clients.length && previousLocalClients.length) {
    console.warn("Sincronização de clientes ignorada para evitar exclusão em massa sem ação explícita.");
    return;
  }

  syncClientsToSupabase(clients);
}

function getOnlineReservations() {
  const localReservations = sanitizeList(readList(RESERVATIONS_STORAGE_KEY), "reservas");

  syncReservationsFromSupabase(localReservations, reservationsMutationVersion);

  return localReservations;
}

function saveOnlineReservations(data) {
  const previousLocalReservations = readList(RESERVATIONS_STORAGE_KEY);
  const reservations = sanitizeList(data, "reservas");

  reservationsMutationVersion += 1;
  writeValue(RESERVATIONS_STORAGE_KEY, reservations);

  if (!reservations.length && !previousLocalReservations.length && !hasLoadedReservationsFromSupabase) {
    return;
  }

  syncReservationsToSupabase(reservations);
}

function getOnlineFinance() {
  const localFinance = sanitizeFinance(normalizeFinance(readValue(FINANCE_STORAGE_KEY, emptyFinance)));

  syncFinanceFromSupabase(localFinance, financeMutationVersion);

  return localFinance;
}

function saveOnlineFinance(data) {
  const finance = sanitizeFinance(normalizeFinance(data));
  const previousLocalFinance = sanitizeFinance(normalizeFinance(readValue(FINANCE_STORAGE_KEY, emptyFinance)));

  financeMutationVersion += 1;
  writeValue(FINANCE_STORAGE_KEY, finance);

  if (!hasFinanceItems(finance) && !hasFinanceItems(previousLocalFinance) && !hasLoadedFinanceFromSupabase) {
    return;
  }

  syncFinanceToSupabase(finance);
}

function getOnlineContracts() {
  const localContracts = sanitizeList(readList(CONTRACTS_STORAGE_KEY), "contratos");

  syncContractsFromSupabase(localContracts, contractsMutationVersion);

  return localContracts;
}

function saveOnlineContracts(data) {
  const previousLocalContracts = readList(CONTRACTS_STORAGE_KEY);
  const contracts = sanitizeList(data, "contratos");

  contractsMutationVersion += 1;
  writeValue(CONTRACTS_STORAGE_KEY, contracts);

  if (!contracts.length && !previousLocalContracts.length && !hasLoadedContractsFromSupabase) {
    return;
  }

  syncContractsToSupabase(contracts);
}

async function getSupabaseClient() {
  const { supabase } = await import("./supabaseClient.js");

  return supabase;
}

async function syncClientsFromSupabase(localClients = [], mutationVersion = clientsMutationVersion, forceReplace = false) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("clients")
      .select("id,name,phone,cpf_cnpj,address,city,notes,created_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao buscar clientes no Supabase:", error);
      return;
    }

    if (!Array.isArray(data)) {
      return;
    }

    const clients = sanitizeList(data.map(mapClientFromSupabase), "clientes");
    hasLoadedClientsFromSupabase = true;

    if (mutationVersion !== clientsMutationVersion) {
      return;
    }

    if (forceReplace || clients.length || !localClients.length) {
      writeValue(CLIENTS_STORAGE_KEY, clients);
    }

    console.log("Clientes carregados do Supabase:", clients.length);
  } catch (error) {
    console.error("Erro ao conectar com Supabase para buscar clientes:", error);
    // Mantém o fallback em localStorage se o Supabase estiver indisponível.
  }
}

async function syncClientsToSupabase(clients) {
  try {
    const supabase = await getSupabaseClient();
    const normalizedClients = Array.isArray(clients)
      ? clients.map(mapClientToSupabase)
      : [];

    if (normalizedClients.length) {
      console.log("ENVIANDO CLIENTE:", normalizedClients);

      const { data, error } = await supabase
        .from("clients")
        .upsert(normalizedClients, { onConflict: "id" })
        .select("id,name,phone,cpf_cnpj,address,city,notes,created_at");

      console.log("RESPOSTA CLIENTE:", data);

      if (error) {
        console.error("ERRO CLIENTE:", error);
        window.alert("Erro ao salvar cliente no banco online. O cliente continuará visível neste navegador.");
        return;
      }
    }

    console.log("Itens salvos no Supabase:", normalizedClients.length);
    console.log("sincronizacao concluida");
  } catch (error) {
    console.error("Erro ao conectar com Supabase para salvar clientes:", error);
    // Mantém os dados locais se o Supabase estiver indisponível.
  }
}

async function deleteOnlineClient(clientId) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId)
      .select("id");

    if (error) {
      console.error("Erro ao excluir cliente no Supabase:", {
        clientId,
        error,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return;
    }

    console.log("item removido do Supabase:", data);
    console.log("sincronizacao concluida");
  } catch (error) {
    console.error("Erro ao conectar com Supabase para excluir cliente:", error);
  }
}

async function syncReservationsFromSupabase(localReservations = [], mutationVersion = reservationsMutationVersion, forceReplace = false) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("reservations")
      .select("id,client_id,client_name,start_date,start_time,end_date,end_time,event_type,total_value,deposit_value,remaining_value,payment_method,payment_status,reservation_status,notes,created_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao buscar reservas no Supabase:", error);
      return;
    }

    if (!Array.isArray(data)) {
      return;
    }

    const reservations = sanitizeList(data.map(mapReservationFromSupabase), "reservas");
    hasLoadedReservationsFromSupabase = true;

    if (mutationVersion !== reservationsMutationVersion) {
      return;
    }

    if (forceReplace || reservations.length || !localReservations.length) {
      writeValue(RESERVATIONS_STORAGE_KEY, reservations);
    }

    console.log("Reservas carregadas do Supabase:", reservations.length);
  } catch (error) {
    console.error("Erro ao conectar com Supabase para buscar reservas:", error);
    // Mantém o fallback em localStorage se o Supabase estiver indisponível.
  }
}

async function syncReservationsToSupabase(reservations) {
  try {
    const supabase = await getSupabaseClient();
    const normalizedReservations = Array.isArray(reservations)
      ? reservations.map(mapReservationToSupabase)
      : [];

    const { data: existingReservations, error: listError } = await supabase
      .from("reservations")
      .select("id");

    if (listError) {
      console.error("Erro ao listar reservas no Supabase para limpeza:", listError);
      return;
    }

    const currentIds = new Set(normalizedReservations.map((reservation) => reservation.id));
    const idsToDelete = (existingReservations || [])
      .map((reservation) => reservation.id)
      .filter((id) => id && !currentIds.has(id));

    if (idsToDelete.length) {
      const { error: deleteError } = await supabase
        .from("reservations")
        .delete()
        .in("id", idsToDelete);

      if (deleteError) {
        console.error("Erro ao excluir reservas no Supabase:", deleteError);
        return;
      }
    }

    console.log("item removido do Supabase:", idsToDelete);

    if (normalizedReservations.length) {
      const { error } = await supabase
        .from("reservations")
        .upsert(normalizedReservations, { onConflict: "id" });

      if (error) {
        console.error("Erro ao salvar reservas no Supabase:", error);
        return;
      }
    }

    console.log("Itens salvos no Supabase:", normalizedReservations.length);
    console.log("sincronizacao concluida");
  } catch (error) {
    console.error("Erro ao conectar com Supabase para salvar reservas:", error);
    // Mantém os dados locais se o Supabase estiver indisponível.
  }
}

async function syncFinanceFromSupabase(localFinance = emptyFinance, mutationVersion = financeMutationVersion, forceReplace = false) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("finance_entries")
      .select("id,reservation_id,client_id,client_name,type,origin,description,amount,status,payment_method,payment_date,due_date,category,notes,created_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao buscar financeiro no Supabase:", error);
      return;
    }

    if (!Array.isArray(data)) {
      return;
    }

    const finance = sanitizeFinance(mapFinanceFromSupabase(data));
    const hasRemoteData = hasFinanceItems(finance);
    const hasLocalData = hasFinanceItems(localFinance);

    hasLoadedFinanceFromSupabase = true;

    if (mutationVersion !== financeMutationVersion) {
      return;
    }

    if (forceReplace || hasRemoteData || !hasLocalData) {
      writeValue(FINANCE_STORAGE_KEY, finance);
    }

    console.log("Lançamentos financeiros carregados do Supabase:", data.length);
  } catch (error) {
    console.error("Erro ao conectar com Supabase para buscar financeiro:", error);
    // Mantém o fallback em localStorage se o Supabase estiver indisponível.
  }
}

async function syncFinanceToSupabase(finance) {
  try {
    const supabase = await getSupabaseClient();
    const entries = mapFinanceToSupabase(finance);

    const { data: existingEntries, error: listError } = await supabase
      .from("finance_entries")
      .select("id");

    if (listError) {
      console.error("Erro ao listar financeiro no Supabase para limpeza:", listError);
      return;
    }

    const currentIds = new Set(entries.map((entry) => entry.id));
    const idsToDelete = (existingEntries || [])
      .map((entry) => entry.id)
      .filter((id) => id && !currentIds.has(id));

    if (idsToDelete.length) {
      const { error: deleteError } = await supabase
        .from("finance_entries")
        .delete()
        .in("id", idsToDelete);

      if (deleteError) {
        console.error("Erro ao excluir financeiro no Supabase:", deleteError);
        return;
      }
    }

    console.log("item removido do Supabase:", idsToDelete);

    if (entries.length) {
      const { error } = await supabase
        .from("finance_entries")
        .upsert(entries, { onConflict: "id" });

      if (error) {
        console.error("Erro ao salvar financeiro no Supabase:", error);
        return;
      }
    }

    console.log("Itens salvos no Supabase:", entries.length);
    console.log("sincronizacao concluida");
  } catch (error) {
    console.error("Erro ao conectar com Supabase para salvar financeiro:", error);
    // Mantém os dados locais se o Supabase estiver indisponível.
  }
}

async function syncContractsFromSupabase(localContracts = [], mutationVersion = contractsMutationVersion, forceReplace = false) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("generated_contracts")
      .select("id,reservation_id,client_id,client_name,contract_model_id,status,token,contract_text,owner_signature,client_signature,signed_at,generated_at,created_at,signer_ip,signer_user_agent,signer_timezone,signer_language,signer_platform,signature_token")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao buscar contratos no Supabase:", error);
      return;
    }

    if (!Array.isArray(data)) {
      return;
    }

    const contracts = sanitizeList(data.map(mapContractFromSupabase), "contratos");
    hasLoadedContractsFromSupabase = true;

    if (mutationVersion !== contractsMutationVersion) {
      return;
    }

    if (forceReplace || contracts.length || !localContracts.length) {
      writeValue(CONTRACTS_STORAGE_KEY, contracts);
    }

    console.log("Contratos carregados do Supabase:", contracts.length);
  } catch (error) {
    console.error("Erro ao conectar com Supabase para buscar contratos:", error);
    // Mantém o fallback em localStorage se o Supabase estiver indisponível.
  }
}

async function syncContractsToSupabase(contracts) {
  try {
    const supabase = await getSupabaseClient();
    const normalizedContracts = Array.isArray(contracts)
      ? contracts.map(mapContractToSupabase)
      : [];

    const { data: existingContracts, error: listError } = await supabase
      .from("generated_contracts")
      .select("id");

    if (listError) {
      console.error("Erro ao listar contratos no Supabase para limpeza:", listError);
      return;
    }

    const currentIds = new Set(normalizedContracts.map((contract) => contract.id));
    const idsToDelete = (existingContracts || [])
      .map((contract) => contract.id)
      .filter((id) => id && !currentIds.has(id));

    if (idsToDelete.length) {
      const { error: deleteError } = await supabase
        .from("generated_contracts")
        .delete()
        .in("id", idsToDelete);

      if (deleteError) {
        console.error("Erro ao excluir contratos no Supabase:", deleteError);
        return;
      }
    }

    console.log("item removido do Supabase:", idsToDelete);

    if (normalizedContracts.length) {
      const { error } = await supabase
        .from("generated_contracts")
        .upsert(normalizedContracts, { onConflict: "id" });

      if (error) {
        console.error("Erro ao salvar contratos no Supabase:", error);
        return;
      }
    }

    console.log("Itens salvos no Supabase:", normalizedContracts.length);
    console.log("sincronizacao concluida");
  } catch (error) {
    console.error("Erro ao conectar com Supabase para salvar contratos:", error);
    // Mantém os dados locais se o Supabase estiver indisponível.
  }
}

async function findOnlineContractByToken(token) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("generated_contracts")
      .select("id,reservation_id,client_id,client_name,contract_model_id,status,token,contract_text,owner_signature,client_signature,signed_at,generated_at,created_at,signer_ip,signer_user_agent,signer_timezone,signer_language,signer_platform,signature_token")
      .eq("token", token)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar contrato por token no Supabase:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    const contract = mapContractFromSupabase(data);
    saveContract(contract);

    return contract;
  } catch (error) {
    console.error("Erro ao conectar com Supabase para buscar contrato por token:", error);
    return null;
  }
}

async function upsertSingleContractToSupabase(contract) {
  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from("generated_contracts")
      .upsert(mapContractToSupabase(contract), { onConflict: "id" });

    if (error) {
      console.error("Erro ao salvar contrato no Supabase:", error);
      return;
    }

    console.log("Itens salvos no Supabase:", 1);
    console.log("sincronizacao concluida");
  } catch (error) {
    console.error("Erro ao conectar com Supabase para salvar contrato:", error);
  }
}

function mapClientToSupabase(client) {
  return {
    id: client.id,
    name: client.name ?? client.nome ?? "",
    phone: client.phone ?? client.telefone ?? client.whatsapp ?? "",
    cpf_cnpj: client.document ?? client.cpfCnpj ?? client.cpf_cnpj ?? client.cpf ?? client.cnpj ?? "",
    address: client.address ?? client.endereco ?? "",
    city: client.city ?? client.cidade ?? "",
    notes: client.notes ?? client.observacoes ?? "",
  };
}

function mapClientFromSupabase(client) {
  return {
    id: client.id,
    name: client.name ?? "",
    phone: client.phone ?? "",
    document: client.cpf_cnpj ?? "",
    address: client.address ?? "",
    city: client.city ?? "",
    notes: client.notes ?? "",
    createdAt: client.created_at ?? "",
  };
}

function mapReservationToSupabase(reservation) {
  const totalValue = Number(reservation.totalValue ?? reservation.total_value ?? 0);
  const depositValue = Number(reservation.depositValue ?? reservation.deposit_value ?? 0);
  const remainingValue = Number(
    reservation.remainingValue
      ?? reservation.remaining_value
      ?? Math.max(totalValue - depositValue, 0),
  );

  return {
    id: reservation.id,
    client_id: reservation.clientId ?? reservation.client_id ?? "",
    client_name: reservation.clientName ?? reservation.client_name ?? "",
    start_date: reservation.dataEntrada ?? reservation.start_date ?? null,
    start_time: reservation.horaEntrada ?? reservation.start_time ?? null,
    end_date: reservation.dataSaida ?? reservation.end_date ?? null,
    end_time: reservation.horaSaida ?? reservation.end_time ?? null,
    event_type: reservation.eventType ?? reservation.event_type ?? "",
    total_value: totalValue,
    deposit_value: depositValue,
    remaining_value: remainingValue,
    payment_method: reservation.paymentMethod ?? reservation.payment_method ?? "",
    payment_status: reservation.paymentStatus ?? reservation.payment_status ?? "",
    reservation_status: reservation.reservationStatus ?? reservation.reservation_status ?? "",
    notes: reservation.notes ?? "",
  };
}

function mapReservationFromSupabase(reservation) {
  return {
    id: reservation.id,
    clientId: reservation.client_id ?? "",
    clientName: reservation.client_name ?? "",
    dataEntrada: reservation.start_date ?? "",
    horaEntrada: normalizeTime(reservation.start_time),
    dataSaida: reservation.end_date ?? "",
    horaSaida: normalizeTime(reservation.end_time),
    eventType: reservation.event_type ?? "",
    totalValue: Number(reservation.total_value ?? 0),
    depositValue: Number(reservation.deposit_value ?? 0),
    remainingValue: Number(reservation.remaining_value ?? 0),
    paymentMethod: reservation.payment_method ?? "",
    paymentStatus: reservation.payment_status ?? "",
    reservationStatus: reservation.reservation_status ?? "",
    notes: reservation.notes ?? "",
    createdAt: reservation.created_at ?? "",
  };
}

function mapContractToSupabase(contract) {
  return {
    id: contract.id,
    reservation_id: contract.reservationId ?? contract.reservation_id ?? "",
    client_id: contract.clientId ?? contract.client_id ?? "",
    client_name: contract.client ?? contract.clientName ?? contract.client_name ?? "",
    contract_model_id: contract.templateId ?? contract.contractModelId ?? contract.contract_model_id ?? "",
    status: contract.status ?? "gerado",
    token: contract.token ?? "",
    contract_text: contract.content ?? contract.contractText ?? contract.contract_text ?? "",
    owner_signature: serializeSignature(contract.ownerSignature ?? contract.owner_signature ?? null),
    client_signature: contract.clientSignature ?? contract.client_signature ?? null,
    signed_at: contract.signedAt ?? contract.signed_at ?? null,
    signer_ip: contract.signerIp ?? contract.signer_ip ?? "",
    signer_user_agent: contract.signerUserAgent ?? contract.signer_user_agent ?? "",
    signer_timezone: contract.signerTimezone ?? contract.signer_timezone ?? "",
    signer_language: contract.signerLanguage ?? contract.signer_language ?? "",
    signer_platform: contract.signerPlatform ?? contract.signer_platform ?? "",
    signature_token: contract.signatureToken ?? contract.signature_token ?? contract.token ?? "",
    generated_at: contract.generatedAt ?? contract.generated_at ?? null,
  };
}

function mapContractFromSupabase(contract) {
  return {
    id: contract.id,
    reservationId: contract.reservation_id ?? "",
    clientId: contract.client_id ?? "",
    client: contract.client_name ?? "",
    clientName: contract.client_name ?? "",
    reservation: contract.reservation_id ? `Reserva ${contract.reservation_id}` : "Reserva não informada",
    templateId: contract.contract_model_id ?? "",
    contractModelId: contract.contract_model_id ?? "",
    status: contract.status ?? "gerado",
    token: contract.token ?? "",
    content: contract.contract_text ?? "",
    contractText: contract.contract_text ?? "",
    ownerSignature: parseSignature(contract.owner_signature),
    clientSignature: contract.client_signature ?? null,
    signedAt: contract.signed_at ?? "",
    signerIp: contract.signer_ip ?? "",
    signerUserAgent: contract.signer_user_agent ?? "",
    signerTimezone: contract.signer_timezone ?? "",
    signerLanguage: contract.signer_language ?? "",
    signerPlatform: contract.signer_platform ?? "",
    signatureToken: contract.signature_token ?? contract.token ?? "",
    generatedAt: contract.generated_at ?? contract.created_at ?? "",
    createdAt: contract.created_at ?? "",
  };
}

function normalizeFinance(finance = emptyFinance) {
  return {
    revenues: Array.isArray(finance.revenues) ? finance.revenues : [],
    fixedExpenses: Array.isArray(finance.fixedExpenses) ? finance.fixedExpenses : [],
    variableExpenses: Array.isArray(finance.variableExpenses) ? finance.variableExpenses : [],
  };
}

function sanitizeList(items, context) {
  const list = Array.isArray(items) ? items : [];

  // Dados mockados não devem ser carregados automaticamente em produção.
  return list.filter((item) => !isDemoRecord(item, context));
}

function sanitizeFinance(finance = emptyFinance) {
  const normalizedFinance = normalizeFinance(finance);

  return {
    revenues: sanitizeList(normalizedFinance.revenues, "financeiro"),
    fixedExpenses: sanitizeList(normalizedFinance.fixedExpenses, "financeiro"),
    variableExpenses: sanitizeList(normalizedFinance.variableExpenses, "financeiro"),
  };
}

function isDemoRecord(record, context) {
  if (!record || typeof record !== "object") {
    return false;
  }

  const searchableText = Object.entries(record)
    .filter(([, value]) => typeof value === "string" || typeof value === "number")
    .map(([key, value]) => `${key}:${String(value).toLowerCase()}`)
    .join(" ");

  if (demoRecordTerms.some((term) => searchableText.includes(term))) {
    console.warn(`Registro de demonstração ignorado em ${context}:`, record);
    return true;
  }

  const explicitDemoFlags = ["mock", "fake", "demo", "sample", "seed"];

  return explicitDemoFlags.some((flag) => searchableText.includes(`${flag}:true`));
}

function hasFinanceItems(finance = emptyFinance) {
  const normalizedFinance = normalizeFinance(finance);

  return Boolean(
    normalizedFinance.revenues.length
    || normalizedFinance.fixedExpenses.length
    || normalizedFinance.variableExpenses.length,
  );
}

function mapFinanceToSupabase(finance) {
  const normalizedFinance = normalizeFinance(finance);

  return [
    ...normalizedFinance.revenues.map((entry) => mapFinanceEntryToSupabase(entry, "receita")),
    ...normalizedFinance.fixedExpenses.map((entry) => mapFinanceEntryToSupabase(entry, "gasto_fixo")),
    ...normalizedFinance.variableExpenses.map((entry) => mapFinanceEntryToSupabase(entry, "gasto_variavel")),
  ];
}

function mapFinanceEntryToSupabase(entry, fallbackType) {
  const type = entry.type ?? fallbackType;
  const isFixedExpense = fallbackType === "gasto_fixo";
  const paymentDate = entry.paymentDate ?? entry.payment_date ?? entry.date ?? null;
  const dueDate = entry.dueDate ?? entry.due_date ?? (isFixedExpense ? entry.date : null);
  const origin = entry.origin
    ?? (entry.linkedToReservation === "sim" ? "reserva" : "manual");

  return {
    id: entry.id,
    reservation_id: entry.reservationId ?? entry.reservation_id ?? "",
    client_id: entry.clientId ?? entry.client_id ?? "",
    client_name: entry.clientName ?? entry.client_name ?? entry.client ?? entry.reference ?? "",
    type,
    origin,
    description: entry.description ?? "",
    amount: Number(entry.amount ?? entry.value ?? 0),
    status: entry.status ?? "",
    payment_method: entry.paymentMethod ?? entry.payment_method ?? "",
    payment_date: paymentDate,
    due_date: dueDate,
    category: entry.category ?? "",
    notes: entry.notes ?? "",
  };
}

function mapFinanceFromSupabase(entries = []) {
  return entries.reduce((finance, entry) => {
    const type = normalizeFinanceType(entry.type);

    if (type === "receita") {
      finance.revenues.push(mapRevenueFromSupabase(entry));
      return finance;
    }

    if (type === "gasto_fixo") {
      finance.fixedExpenses.push(mapFixedExpenseFromSupabase(entry));
      return finance;
    }

    finance.variableExpenses.push(mapVariableExpenseFromSupabase(entry));
    return finance;
  }, {
    revenues: [],
    fixedExpenses: [],
    variableExpenses: [],
  });
}

function mapRevenueFromSupabase(entry) {
  return {
    id: entry.id,
    type: entry.type ?? "receita",
    origin: entry.origin ?? "manual",
    reservationId: entry.reservation_id ?? "",
    clientId: entry.client_id ?? "",
    clientName: entry.client_name ?? "",
    description: entry.description ?? "",
    reference: entry.client_name || entry.reservation_id || entry.description || "",
    date: entry.payment_date ?? "",
    value: Number(entry.amount ?? 0),
    paymentMethod: entry.payment_method ?? "",
    status: entry.status ?? "pendente",
    notes: entry.notes ?? "",
    createdAt: entry.created_at ?? "",
  };
}

function mapFixedExpenseFromSupabase(entry) {
  return {
    id: entry.id,
    type: entry.type ?? "gasto_fixo",
    origin: entry.origin ?? "manual",
    description: entry.description ?? "",
    category: entry.category ?? "",
    dueDate: entry.due_date ?? "",
    value: Number(entry.amount ?? 0),
    status: entry.status ?? "pendente",
    notes: entry.notes ?? "",
    createdAt: entry.created_at ?? "",
  };
}

function mapVariableExpenseFromSupabase(entry) {
  return {
    id: entry.id,
    type: entry.type ?? "gasto_variavel",
    origin: entry.origin ?? "manual",
    reservationId: entry.reservation_id ?? "",
    description: entry.description ?? "",
    category: entry.category ?? "",
    date: entry.payment_date ?? "",
    value: Number(entry.amount ?? 0),
    linkedToReservation: entry.reservation_id || entry.origin === "reserva" ? "sim" : "não",
    status: entry.status ?? "pendente",
    notes: entry.notes ?? "",
    createdAt: entry.created_at ?? "",
  };
}

function normalizeFinanceType(type) {
  if (["receita", "revenue", "entrada"].includes(type)) {
    return "receita";
  }

  if (["gasto_fixo", "fixedExpense", "fixed_expense"].includes(type)) {
    return "gasto_fixo";
  }

  return "gasto_variavel";
}

function serializeSignature(signature) {
  if (!signature) {
    return null;
  }

  return typeof signature === "string" ? signature : JSON.stringify(signature);
}

function parseSignature(signature) {
  if (!signature || typeof signature !== "string") {
    return signature ?? null;
  }

  try {
    return JSON.parse(signature);
  } catch {
    return { image: signature };
  }
}

function normalizeTime(value) {
  return value ? String(value).slice(0, 5) : "";
}



