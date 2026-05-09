import { navigationItems } from "../data/navigation.js";
import { pageRegistry } from "../pages/pageRegistry.js";
import { subscribeToRealtimeChanges } from "../../services/dataService.js";
import { startMessageAutomationScheduler } from "../../services/messageAutomationService.js";
import { subscribeToMoneyPrivacyChange } from "../../services/privacyService.js";
import { createHeader } from "./Header.js";
import { createSidebar } from "./Sidebar.js";

export function createAppLayout({ onLogout } = {}) {
  const shell = document.createElement("div");
  const content = document.createElement("main");
  const currentPage = getInitialPage();
  let activePageId = currentPage;

  shell.className = "app-shell";
  content.className = "content";
  content.id = "main-content";

  const renderPage = (pageId) => {
    const page = pageRegistry[pageId] ?? pageRegistry.dashboard;

    activePageId = pageId;
    content.replaceChildren(page());
    sidebar.updateActive(pageId);
    shell.classList.remove("is-menu-open");
  };

  const openMenu = () => shell.classList.add("is-menu-open");
  const closeMenu = () => shell.classList.remove("is-menu-open");

  const sidebar = createSidebar({
    items: navigationItems,
    activePageId: currentPage,
    onNavigate: renderPage,
  });

  const overlay = document.createElement("button");
  overlay.className = "mobile-overlay";
  overlay.type = "button";
  overlay.setAttribute("aria-label", "Fechar menu");
  overlay.addEventListener("click", closeMenu);

  shell.append(
    sidebar.element,
    overlay,
    createMainArea({
      header: createHeader({ onMenuClick: openMenu }),
      onLogout,
      content,
    }),
  );

  renderPage(currentPage);
  startMessageAutomationScheduler();
  subscribeToMoneyPrivacyChange(() => {
    renderPage(activePageId);
  });
  subscribeToRealtimeChanges(() => {
    renderPage(activePageId);
  }).catch((error) => {
    console.error("Não foi possível iniciar o Supabase Realtime:", error);
  });

  return shell;
}

function createMainArea({ header, onLogout, content }) {
  const area = document.createElement("div");
  const headerWrapper = document.createElement("div");

  area.className = "main-area";
  headerWrapper.className = "main-header-wrap";
  headerWrapper.append(header);

  if (onLogout) {
    const logoutButton = document.createElement("button");

    logoutButton.className = "button button--secondary header__logout";
    logoutButton.type = "button";
    logoutButton.textContent = "Sair";
    logoutButton.addEventListener("click", onLogout);
    header.append(logoutButton);
  }

  area.append(headerWrapper, content);
  return area;
}

function getInitialPage() {
  return navigationItems[0].id;
}
