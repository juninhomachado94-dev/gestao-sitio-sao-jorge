import {
  getAuthSession,
  onAuthSessionChange,
  signInWithEmailPassword,
  signOutAuth,
} from "../../services/authService.js";

const SESSION_KEY = "usuario_logado";

export function createAuthGate({ createProtectedApp }) {
  const root = document.createElement("div");
  let currentSession = null;
  let protectedAppVisible = false;

  root.className = "auth-gate";
  root.replaceChildren(createLoadingScreen());

  initializeAuth();

  return root;

  async function initializeAuth() {
    currentSession = await getAuthSession();
    renderBySession(currentSession);

    onAuthSessionChange((session) => {
      currentSession = session;
      renderBySession(currentSession);
    });
  }

  function renderBySession(session) {
    if (session) {
      window.localStorage.setItem(SESSION_KEY, "true");
      renderProtectedApp();
      return;
    }

    window.localStorage.removeItem(SESSION_KEY);
    protectedAppVisible = false;
    root.replaceChildren(createLoginScreen({ onLogin: renderProtectedApp }));
  }

  function renderProtectedApp() {
    if (protectedAppVisible) {
      return;
    }

    protectedAppVisible = true;
    root.replaceChildren(createProtectedApp({
      onLogout: async () => {
        await signOutAuth();
        window.localStorage.removeItem(SESSION_KEY);
        protectedAppVisible = false;
        root.replaceChildren(createLoginScreen({ onLogin: renderProtectedApp }));
      },
    }));
  }
}

function createLoginScreen({ onLogin }) {
  const form = createAuthShell({
    eyebrow: "Acesso restrito",
    title: "Entrar no sistema",
    description: "Informe seu email e senha para acessar a gestão do Sítio São Jorge.",
    buttonLabel: "Entrar",
  });
  const emailField = createAuthField("Email", "email", "email");
  const passwordField = createAuthField("Senha", "password", "senha");

  form.fields.append(emailField.wrapper, passwordField.wrapper);
  form.element.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailField.input.value.trim();
    const password = passwordField.input.value;

    if (!email || !password) {
      showAuthError(form.error, "Preencha email e senha.");
      return;
    }

    form.button.disabled = true;
    form.button.textContent = "Entrando...";
    form.error.hidden = true;

    const { data, error } = await signInWithEmailPassword(email, password);

    form.button.disabled = false;
    form.button.textContent = "Entrar";

    if (error || !data.session) {
      console.error("Erro no login Supabase:", error);
      showAuthError(form.error, "Email ou senha incorretos.");
      return;
    }

    window.localStorage.setItem(SESSION_KEY, "true");
    onLogin();
  });

  return form.wrapper;
}

function createLoadingScreen() {
  const wrapper = document.createElement("section");
  const card = document.createElement("div");
  const brand = document.createElement("div");
  const mark = document.createElement("div");
  const brandText = document.createElement("div");
  const brandName = document.createElement("strong");
  const brandSub = document.createElement("span");
  const content = document.createElement("div");
  const title = document.createElement("h1");
  const description = document.createElement("p");

  wrapper.className = "auth-screen";
  card.className = "auth-card";
  brand.className = "auth-brand";
  mark.className = "auth-brand__mark";
  mark.textContent = "SJ";
  brandName.textContent = "Sítio São Jorge";
  brandSub.textContent = "Gestão de aluguel";
  brandText.append(brandName, brandSub);
  brand.append(mark, brandText);

  content.className = "auth-card__content";
  title.className = "auth-card__title";
  title.textContent = "Carregando acesso";
  description.className = "auth-card__description";
  description.textContent = "Verificando sua sessão com segurança.";

  content.append(title, description);
  card.append(brand, content);
  wrapper.append(card);

  return wrapper;
}

function createAuthShell({ eyebrow, title, description, buttonLabel }) {
  const wrapper = document.createElement("section");
  const card = document.createElement("form");
  const brand = document.createElement("div");
  const mark = document.createElement("div");
  const brandText = document.createElement("div");
  const brandName = document.createElement("strong");
  const brandSub = document.createElement("span");
  const content = document.createElement("div");
  const eyebrowElement = document.createElement("p");
  const titleElement = document.createElement("h1");
  const descriptionElement = document.createElement("p");
  const fields = document.createElement("div");
  const error = document.createElement("p");
  const button = document.createElement("button");

  wrapper.className = "auth-screen";
  card.className = "auth-card";
  card.noValidate = true;

  brand.className = "auth-brand";
  mark.className = "auth-brand__mark";
  mark.textContent = "SJ";
  brandName.textContent = "Sítio São Jorge";
  brandSub.textContent = "Gestão de aluguel";
  brandText.append(brandName, brandSub);
  brand.append(mark, brandText);

  content.className = "auth-card__content";
  eyebrowElement.className = "auth-card__eyebrow";
  eyebrowElement.textContent = eyebrow;
  titleElement.className = "auth-card__title";
  titleElement.textContent = title;
  descriptionElement.className = "auth-card__description";
  descriptionElement.textContent = description;
  content.append(eyebrowElement, titleElement, descriptionElement);

  fields.className = "auth-fields";

  error.className = "auth-error";
  error.hidden = true;

  button.className = "button button--primary auth-submit";
  button.type = "submit";
  button.textContent = buttonLabel;

  card.append(brand, content, fields, error, button);
  wrapper.append(card);

  return {
    wrapper,
    element: card,
    fields,
    error,
    button,
  };
}

function createAuthField(label, type, name) {
  const wrapper = document.createElement("label");
  const labelText = document.createElement("span");
  const input = document.createElement("input");

  wrapper.className = "auth-field";
  labelText.textContent = label;
  input.type = type;
  input.name = name;
  input.autocomplete = type === "password" ? "current-password" : "email";

  wrapper.append(labelText, input);

  return { wrapper, input };
}

function showAuthError(element, message) {
  element.textContent = message;
  element.hidden = false;
}
