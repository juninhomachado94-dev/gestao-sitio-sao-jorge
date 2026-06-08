import {
  findContractByToken,
  getContracts,
  saveContract,
  saveContractAsync,
  saveContracts,
} from "../../services/dataService.js";

export function getGeneratedContracts() {
  const contracts = getContracts();

  const normalizedContracts = ensureContractTokens(contracts);

  if (normalizedContracts.changed) {
    saveGeneratedContracts(normalizedContracts.contracts);
  }

  return normalizedContracts.contracts;
}

export function saveGeneratedContracts(contracts) {
  try {
    saveContracts(contracts);
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
  const updatedContracts = contracts.map((contract) => (
    contract.token === token ? (updatedContract = updater(contract)) : contract
  ));

  if (updatedContract) {
    saveContract(updatedContract);
    return updatedContract;
  }

  return updatedContracts.find((contract) => contract.token === token);
}

export async function updateGeneratedContractByTokenAsync(token, updater) {
  const contracts = getGeneratedContracts();
  let updatedContract = null;

  contracts.forEach((contract) => {
    if (contract.token === token) {
      updatedContract = updater(contract);
    }
  });

  if (!updatedContract) {
    const remoteContract = await findContractByToken(token);

    if (remoteContract) {
      updatedContract = updater(remoteContract);
    }
  }

  if (updatedContract) {
    await saveContractAsync(updatedContract);
    return updatedContract;
  }

  return null;
}

export function saveGeneratedContract(contract) {
  saveContract(contract);
}

export async function saveGeneratedContractAsync(contract) {
  return saveContractAsync(contract);
}

export function createContractToken(existingContracts = []) {
  const existingTokens = new Set(existingContracts.map((contract) => contract.token).filter(Boolean));
  let token = createToken();

  while (existingTokens.has(token)) {
    token = createToken();
  }

  return token;
}

export function createContractId() {
  return createToken();
}

function ensureContractTokens(contracts) {
  const usedTokens = new Set();
  let changed = false;

  const contractsWithTokens = contracts.map((contract) => {
    let token = contract.token;

    if (!token || usedTokens.has(token)) {
      token = createContractToken([...contracts, ...Array.from(usedTokens).map((usedToken) => ({ token: usedToken }))]);
      changed = true;
    }

    usedTokens.add(token);

    return {
      ...contract,
      token,
    };
  });

  return {
    contracts: contractsWithTokens,
    changed,
  };
}

function createToken() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
