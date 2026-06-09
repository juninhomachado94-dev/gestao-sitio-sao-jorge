import {
  findContractByToken,
  getContracts,
  saveContract,
  saveContractConfirmed,
  saveContracts,
} from "../../services/dataService.js";

export function getGeneratedContracts() {
  const contracts = getContracts();
  return ensureContractIdentities(contracts).contracts;
}

export function saveGeneratedContracts(contracts) {
  try {
    saveContracts(ensureContractIdentities(contracts).contracts);
  } catch {
    // Mantém a sessão funcionando mesmo se o armazenamento local estiver indisponível.
  }
}

export function findGeneratedContractByToken(token) {
  return getGeneratedContracts().find((contract) => contract.token === token?.trim());
}

export async function findGeneratedContractByTokenAsync(token) {
  const localContract = findGeneratedContractByToken(token);

  if (localContract) {
    return localContract;
  }

  return findContractByToken(token);
}

export function updateGeneratedContractByToken(token, updater) {
  const contracts = getGeneratedContracts();
  let updatedContract = null;
  const updatedContracts = contracts.map((contract) => {
    if (contract.token !== token) {
      return contract;
    }

    updatedContract = normalizeContractIdentity(updater(contract));
    return updatedContract;
  });

  if (updatedContract) {
    saveContract(updatedContract);
    return updatedContract;
  }

  return updatedContracts.find((contract) => contract.token === token);
}

export async function updateGeneratedContractByTokenConfirmed(token, updater) {
  const contract = await findGeneratedContractByTokenAsync(token);

  if (!contract) {
    return { ok: false, error: new Error("Contrato não encontrado."), contract: null };
  }

  const updatedContract = normalizeContractIdentity(updater(contract));
  const result = await saveContractConfirmed(updatedContract);

  return {
    ...result,
    contract: updatedContract,
  };
}

export function saveGeneratedContract(contract) {
  const normalizedContract = normalizeContractIdentity(contract);
  saveContract(normalizedContract);
  return normalizedContract;
}

export async function saveGeneratedContractConfirmed(contract) {
  const normalizedContract = normalizeContractIdentity(contract);
  const result = await saveContractConfirmed(normalizedContract);

  return {
    ...result,
    contract: normalizedContract,
  };
}

export function createContractToken(existingContracts = []) {
  const existingTokens = new Set(existingContracts.map((contract) => contract.token).filter(Boolean));
  let token = createToken();

  while (existingTokens.has(token)) {
    token = createToken();
  }

  return token;
}

function ensureContractIdentities(contracts) {
  const usedTokens = new Set();
  let changed = false;

  const normalizedContracts = contracts.map((contract) => {
    const normalizedContract = normalizeContractIdentity(contract, usedTokens);

    if (normalizedContract.id !== contract.id || normalizedContract.token !== contract.token) {
      changed = true;
    }

    usedTokens.add(normalizedContract.token);
    return normalizedContract;
  });

  return {
    contracts: normalizedContracts,
    changed,
  };
}

function normalizeContractIdentity(contract, usedTokens = new Set()) {
  let token = contract.token;

  if (!token || usedTokens.has(token)) {
    token = createContractToken(Array.from(usedTokens).map((usedToken) => ({ token: usedToken })));
  }

  return {
    ...contract,
    id: isUuid(contract.id) ? contract.id : token,
    token,
  };
}

function createToken() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? ""));
}
