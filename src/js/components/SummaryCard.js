export function createSummaryCard({ label, value, detail }) {
  const card = document.createElement("article");
  const labelElement = document.createElement("p");
  const valueElement = document.createElement("strong");
  const detailElement = document.createElement("span");

  card.className = "summary-card";

  labelElement.className = "summary-card__label";
  labelElement.textContent = label;

  valueElement.className = "summary-card__value";
  valueElement.textContent = value;

  detailElement.className = "summary-card__detail";
  detailElement.textContent = detail;

  card.append(labelElement, valueElement, detailElement);

  return card;
}
