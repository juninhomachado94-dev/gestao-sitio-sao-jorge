const MONEY_PRIVACY_KEY = "sitio-sao-jorge-hide-money";
const MONEY_PRIVACY_EVENT = "sitio-sao-jorge-money-privacy-change";

export function areMoneyValuesHidden() {
  return window.localStorage.getItem(MONEY_PRIVACY_KEY) === "true";
}

export function toggleMoneyValuesVisibility() {
  const nextHiddenState = !areMoneyValuesHidden();
  window.localStorage.setItem(MONEY_PRIVACY_KEY, String(nextHiddenState));
  window.dispatchEvent(new CustomEvent(MONEY_PRIVACY_EVENT, {
    detail: { hidden: nextHiddenState },
  }));

  return nextHiddenState;
}

export function subscribeToMoneyPrivacyChange(callback) {
  const handler = (event) => callback?.(event.detail?.hidden ?? areMoneyValuesHidden());

  window.addEventListener(MONEY_PRIVACY_EVENT, handler);

  return () => window.removeEventListener(MONEY_PRIVACY_EVENT, handler);
}

export function formatCurrency(value) {
  if (areMoneyValuesHidden()) {
    return "R$ •••••";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}
