import { getClients } from "../services/dataService.js";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getClientSearchText(client) {
  return normalizeText([
    client.name,
    client.phone,
    client.document,
    client.cpfCnpj,
    client.cpf,
    client.city,
  ].filter(Boolean).join(" "));
}

function getClientMeta(client) {
  return [client.phone, client.document || client.cpfCnpj || client.cpf, client.city]
    .filter(Boolean)
    .join(" • ") || "Sem telefone cadastrado";
}

function sortClients(clients) {
  return [...clients].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
}

function createOption(client, select, input, selected, results) {
  const button = document.createElement("button");
  const name = document.createElement("strong");
  const meta = document.createElement("span");

  button.className = "reservation-client-search__option";
  button.type = "button";
  name.textContent = client.name || "Cliente sem nome";
  meta.textContent = getClientMeta(client);
  button.append(name, meta);
  button.addEventListener("click", () => {
    select.value = client.id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    input.value = client.name || "";
    selected.textContent = `${client.name || "Cliente"} • ${getClientMeta(client)}`;
    results.hidden = true;
  });

  return button;
}

function enhanceClientSelect(select) {
  if (!select || select.dataset.clientSearchEnhanced === "true") {
    return;
  }

  const field = select.closest("label, .reservation-form__field");

  if (!field) {
    return;
  }

  const clients = sortClients(getClients());
  const wrapper = document.createElement("div");
  const input = document.createElement("input");
  const selected = document.createElement("small");
  const results = document.createElement("div");

  select.dataset.clientSearchEnhanced = "true";
  select.classList.add("reservation-client-search__select");
  select.hidden = true;
  select.tabIndex = -1;

  wrapper.className = "reservation-client-search";
  input.className = "reservation-client-search__input";
  input.type = "search";
  input.autocomplete = "off";
  input.placeholder = "Digite o nome, telefone ou CPF do cliente...";
  selected.className = "reservation-client-search__selected";
  selected.textContent = "Nenhum cliente selecionado";
  results.className = "reservation-client-search__results";
  results.hidden = true;

  function renderResults() {
    const query = normalizeText(input.value);
    const matches = query
      ? clients.filter((client) => getClientSearchText(client).includes(query)).slice(0, 8)
      : clients.slice(0, 8);

    results.replaceChildren();
    results.hidden = false;

    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "reservation-client-search__empty";
      empty.textContent = "Cliente não encontrado. Cadastre o cliente na aba Clientes antes de criar a reserva.";
      results.append(empty);
      return;
    }

    matches.forEach((client) => results.append(createOption(client, select, input, selected, results)));
  }

  input.addEventListener("focus", renderResults);
  input.addEventListener("click", renderResults);
  input.addEventListener("input", () => {
    select.value = "";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    selected.textContent = "Nenhum cliente selecionado";
    renderResults();
  });

  wrapper.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!wrapper.contains(document.activeElement)) {
        results.hidden = true;
      }
    }, 120);
  });

  const currentClient = clients.find((client) => client.id === select.value);

  if (currentClient) {
    input.value = currentClient.name || "";
    selected.textContent = `${currentClient.name || "Cliente"} • ${getClientMeta(currentClient)}`;
  }

  wrapper.append(input, selected, results);
  select.after(wrapper);
}

function enhanceReservationClientSearch() {
  document
    .querySelectorAll(".reservation-form select[name='clientId']")
    .forEach(enhanceClientSelect);
}

const observer = new MutationObserver(enhanceReservationClientSearch);
observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener("DOMContentLoaded", enhanceReservationClientSearch);
enhanceReservationClientSearch();
