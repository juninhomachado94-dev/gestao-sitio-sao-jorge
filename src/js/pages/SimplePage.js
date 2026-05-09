export function createSimplePage({ title }) {
  const section = document.createElement("section");
  const kicker = document.createElement("p");
  const heading = document.createElement("h2");
  const text = document.createElement("p");

  section.className = "page-panel";
  section.setAttribute("aria-labelledby", `page-title-${slugify(title)}`);

  kicker.className = "page-panel__kicker";
  kicker.textContent = "Sítio São Jorge";

  heading.className = "page-panel__title";
  heading.id = `page-title-${slugify(title)}`;
  heading.textContent = title;

  text.className = "page-panel__text";
  text.textContent = "Em desenvolvimento";

  section.append(kicker, heading, text);

  return section;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
