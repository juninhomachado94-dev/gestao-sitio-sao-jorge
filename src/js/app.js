import { createAuthGate } from "./auth/AuthGate.js";
import { createAppLayout } from "./layout/AppLayout.js";
import { createPublicContractSigningPage } from "./pages/PublicContractSigningPage.js";

const appRoot = document.querySelector("#app");
const publicSigningMatch = window.location.pathname.match(/^\/assinar-contrato\/([^/]+)$/);

if (publicSigningMatch) {
  appRoot.append(createPublicContractSigningPage(decodeURIComponent(publicSigningMatch[1])));
} else {
  appRoot.append(createAuthGate({
    createProtectedApp: ({ onLogout }) => createAppLayout({ onLogout }),
  }));
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    registerServiceWorker();
  });
}

function registerServiceWorker() {
  let refreshing = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) {
      return;
    }

    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.register("/sw.js")
    .then((registration) => {
      if (registration.waiting) {
        showUpdateNotice(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;

        if (!newWorker) {
          return;
        }

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateNotice(newWorker);
          }
        });
      });
    })
    .catch(() => {});
}

function showUpdateNotice(worker) {
  if (document.querySelector(".pwa-update")) {
    return;
  }

  const notice = document.createElement("div");
  const text = document.createElement("span");
  const button = document.createElement("button");

  notice.className = "pwa-update";
  text.textContent = "Nova versão disponível. Atualizar agora";
  button.className = "pwa-update__button";
  button.type = "button";
  button.textContent = "Atualizar";
  button.addEventListener("click", () => {
    worker.postMessage({ type: "SKIP_WAITING" });
  });

  notice.append(text, button);
  document.body.append(notice);
}
