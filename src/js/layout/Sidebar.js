export function createSidebar({ items, activePageId, onNavigate }) {
  const sidebar = document.createElement("aside");
  const brand = document.createElement("div");
  const mark = document.createElement("div");
  const brandText = document.createElement("div");
  const title = document.createElement("p");
  const subtitle = document.createElement("p");
  const nav = document.createElement("nav");
  const buttons = new Map();

  sidebar.className = "sidebar";
  sidebar.setAttribute("aria-label", "Menu principal");

  brand.className = "sidebar__brand";
  mark.className = "sidebar__mark";
  mark.textContent = "SJ";
  title.className = "sidebar__title";
  title.textContent = "Sítio São Jorge";
  subtitle.className = "sidebar__subtitle";
  subtitle.textContent = "Gestão de aluguel";
  brandText.append(title, subtitle);
  brand.append(mark, brandText);

  nav.className = "sidebar__nav";

  items.forEach((item) => {
    const button = document.createElement("button");
    const icon = document.createElement("span");
    const label = document.createElement("span");

    button.className = "sidebar__link";
    button.type = "button";
    button.dataset.pageId = item.id;
    button.setAttribute("aria-current", item.id === activePageId ? "page" : "false");
    button.addEventListener("click", () => onNavigate(item.id));

    icon.className = "sidebar__icon";
    icon.textContent = item.icon;
    label.textContent = item.label;

    button.append(icon, label);
    nav.append(button);
    buttons.set(item.id, button);
  });

  sidebar.append(brand, nav);

  return {
    element: sidebar,
    updateActive(pageId) {
      buttons.forEach((button, id) => {
        const isActive = id === pageId;

        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-current", isActive ? "page" : "false");
      });
    },
  };
}
