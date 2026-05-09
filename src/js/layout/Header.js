import { areMoneyValuesHidden, toggleMoneyValuesVisibility } from "../../services/privacyService.js";

export function createHeader({ onMenuClick }) {
  const header = document.createElement("header");
  const menuButton = document.createElement("button");
  const menuIcon = document.createElement("span");
  const titleGroup = document.createElement("div");
  const eyebrow = document.createElement("p");
  const title = document.createElement("h1");
  const status = document.createElement("div");
  const statusDot = document.createElement("span");
  const statusText = document.createElement("span");
  const actions = document.createElement("div");
  const privacyButton = document.createElement("button");

  header.className = "header";

  menuButton.className = "header__menu-button";
  menuButton.type = "button";
  menuButton.setAttribute("aria-label", "Abrir menu");
  menuButton.addEventListener("click", onMenuClick);

  menuIcon.className = "header__menu-lines";
  menuButton.append(menuIcon);

  eyebrow.className = "header__eyebrow";
  eyebrow.textContent = "SÍTIO SÃO JORGE";

  title.className = "header__title";
  title.textContent = "Gestão de Aluguel";

  titleGroup.append(eyebrow, title);

  status.className = "header__status";
  statusDot.className = "header__status-dot";
  statusText.textContent = "Sistema ativo";
  status.append(statusDot, statusText);

  actions.className = "header__actions";
  privacyButton.className = "header__privacy-button";
  privacyButton.type = "button";
  updatePrivacyButton(privacyButton);
  privacyButton.addEventListener("click", () => {
    toggleMoneyValuesVisibility();
    updatePrivacyButton(privacyButton);
  });
  actions.append(privacyButton, status);

  header.append(menuButton, titleGroup, actions);

  return header;
}

function updatePrivacyButton(button) {
  const hidden = areMoneyValuesHidden();
  button.setAttribute("aria-label", hidden ? "Exibir valores em dinheiro" : "Ocultar valores em dinheiro");
  button.title = hidden ? "Exibir valores" : "Ocultar valores";
  button.innerHTML = hidden ? getEyeOffIcon() : getEyeIcon();
}

function getEyeIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;
}

function getEyeOffIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 3l18 18"></path>
      <path d="M10.7 5.2A9.7 9.7 0 0 1 12 5c6 0 9.5 7 9.5 7a16.8 16.8 0 0 1-3.1 3.9"></path>
      <path d="M6.5 6.7C3.9 8.6 2.5 12 2.5 12s3.5 7 9.5 7a9.8 9.8 0 0 0 4.1-.9"></path>
      <path d="M9.9 9.9A3 3 0 0 0 14.1 14.1"></path>
    </svg>
  `;
}
