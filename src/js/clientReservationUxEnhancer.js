import { getClients, saveClients } from "../services/dataService.js";

const state = {
  clientSearch: "",
  clientPage: 1,
  clientPageSize: 25,
  clientSortKey: "name",
  clientSortDirection: "asc",
};

let scheduled = false;

function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    enhanceClientsPage();
    enhanceReservationClientSelects();
  });
}

function enhanceClientsPage() {
  const page = document.querySelector(".clients-page");
  const tableSection = page?.querySelector(".clients-table");
  const table = tableSection?.querySelector("table");
  const tbody = table?.querySelector("tbody");

  if (!page || !tableSection || !table || !tbody) return;
  if (tableSection.dataset.uxEnhanced === "true") {
    renderClientTableView(tableSection);
    return;
  }

  tableSection.dataset.uxEnhanced = "true";
  tableSection.prepend(createClientsToolbar());
  enhanceClientHeaders(table);
  renderClientTableView(tableSection);
}

function createClientsToolbar() {
  const toolbar = document.createElement("div");
  const search = document.createElement("label");
  const searchLabel = document.createElement("span");
  const searchInput = document.createElement("input");
  const meta = document.createElement("div");
  const total = document.createElement("strong");
  const range = document.createElement("span");
  const pageSize = document.createElement("label");
  const pageSizeLabel = document.createElement("span");
  const pageSizeSelect = document.createElement("select");

  toolbar.className = "clients-table__toolbar ux-clients-toolbar";
  search.className = "clients-table__search";
  meta.className = "clients-table__meta ux-clients-meta";
  pageSize.className = "clients-table__page-size";
  searchLabel.textContent = "Buscar cliente";
  searchInput.type = "search";
  searchInput.placeholder = "Nome, telefone, CPF, cidade ou observação";
  searchInput.value = state.clientSearch;
  searchInput.addEventListener("input", () => {
    state.clientSearch = searchInput.value;
    state.clientPage = 1;
    renderClientTableView(toolbar.closest(".clients-table"));
  });

  total.dataset.role = "total";
  range.dataset.role = "range";
  pageSizeLabel.textContent = "Por página";
  [10, 25, 50].forEach((amount) => {
    const option = document.createElement("option");
    option.value = String(amount);
    option.textContent = `${amount} por página`;
    option.selected = amount === state.clientPageSize;
    pageSizeSelect.append(option);
  });
  pageSizeSelect.addEventListener("change", () => {
    state.clientPageSize = Number(pageSizeSelect.value);
    state.clientPage = 1;
    renderClientTableView(toolbar.closest(".clients-table"));
  });

  search.append(searchLabel, searchInput);
  meta.append(total, range);
  pageSize.append(pageSizeLabel, pageSizeSelect);
  toolbar.append(search, meta, pageSize);
  return toolbar;
}

function enhanceClientHeaders(table) {
  const sortableHeaders = [
    { index: 0, key: "name", label: "Nome" },
    { index: 1, key: "phone", label: "Telefone/WhatsApp" },
    { index: 2, key: "document", label: "CPF/CNPJ" },
    { index: 3, key: "city", label: "Cidade" },
  ];

  sortableHeaders.forEach((header) => {
    const cell = table.querySelector(`thead th:nth-child(${header.index + 1})`);
    if (!cell || cell.querySelector("button")) return;

    const button = document.createElement("button");
    button.className = "clients-table__sort ux-client-sort";
    button.type = "button";
    button.dataset.sortKey = header.key;
    button.addEventListener("click", () => {
      if (state.clientSortKey === header.key) {
        state.clientSortDirection = state.clientSortDirection === "asc" ? "desc" : "asc";
      } else {
        state.clientSortKey = header.key;
        state.clientSortDirection = "asc";
      }
      state.clientPage = 1;
      renderClientTableView(table.closest(".clients-table"));
    });
    cell.textContent = "";
    cell.append(button);
  });
}

function renderClientTableView(tableSection) {
  const table = tableSection?.querySelector("table");
  const tbody = table?.querySelector("tbody");
  if (!table || !tbody) return;

  const clients = sortClients(filterClients(getClients(), state.clientSearch));
  const allClients = getClients();
  const rows = Array.from(tbody.querySelectorAll("tr")).filter((row) => row.querySelectorAll("td").length > 1);
  const totalPages = Math.max(1, Math.ceil(clients.length / state.clientPageSize));
  state.clientPage = Math.min(state.clientPage, totalPages);
  const start = (state.clientPage - 1) * state.clientPageSize;
  const visibleClients = clients.slice(start, start + state.clientPageSize);
  const rowsByClient = new Map();

  rows.forEach((row) => {
    const name = normalizeText(row.children[0]?.textContent);
    const phone = onlyNumbers(row.children[1]?.textContent);
    const document = onlyNumbers(row.children[2]?.textContent);
    const client = allClients.find((item) => normalizeText(item.name) === name && (!phone || onlyNumbers(item.phone) === phone))
      || allClients.find((item) => normalizeText(item.name) === name && (!document || onlyNumbers(item.document || item.cpfCnpj || item.cpf_cnpj) === document));
    if (client) rowsByClient.set(client.id, row);
  });

  tbody.replaceChildren();

  if (!visibleClients.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = table.querySelectorAll("thead th").length || 6;
    cell.textContent = state.clientSearch ? "Nenhum cliente encontrado para essa busca." : "Nenhum cliente cadastrado";
    row.append(cell);
    tbody.append(row);
  } else {
    visibleClients.forEach((client) => {
      const row = rowsByClient.get(client.id);
      if (row) tbody.append(row);
    });
  }

  updateClientsMeta(tableSection, allClients.length, clients.length, start, visibleClients.length, totalPages);
  updateSortButtons(table);
}

function updateClientsMeta(tableSection, totalCount, filteredCount, start, visibleCount, totalPages) {
  const total = tableSection.querySelector(".ux-clients-meta [data-role='total']");
  const range = tableSection.querySelector(".ux-clients-meta [data-role='range']");
  if (total) total.textContent = `Clientes cadastrados: ${totalCount}`;
  if (range) {
    range.textContent = filteredCount
      ? `Exibindo ${start + 1}-${start + visibleCount} de ${filteredCount}`
      : state.clientSearch
        ? "Nenhum resultado para a busca"
        : "Nenhum cliente cadastrado";
  }

  let pagination = tableSection.querySelector(".ux-clients-pagination");
  if (!pagination) {
    pagination = document.createElement("div");
    pagination.className = "clients-table__pagination ux-clients-pagination";
    tableSection.append(pagination);
  }

  pagination.replaceChildren();
  const previous = document.createElement("button");
  const indicator = document.createElement("span");
  const next = document.createElement("button");

  previous.className = "button button--secondary";
  previous.type = "button";
  previous.textContent = "Anterior";
  previous.disabled = state.clientPage <= 1;
  previous.addEventListener("click", () => {
    state.clientPage = Math.max(1, state.clientPage - 1);
    renderClientTableView(tableSection);
  });
  indicator.className = "clients-table__page-indicator";
  indicator.textContent = `Página ${state.clientPage} de ${totalPages}`;
  next.className = "button button--secondary";
  next.type = "button";
  next.textContent = "Próxima";
  next.disabled = state.clientPage >= totalPages;
  next.addEventListener("click", () => {
    state.clientPage = Math.min(totalPages, state.clientPage + 1);
    renderClientTableView(tableSection);
  });

  pagination.append(previous, indicator, next);
}

function updateSortButtons(table) {
  table.querySelectorAll(".ux-client-sort").forEach((button) => {
    const key = button.dataset.sortKey;
    const labels = {
      name: "Nome",
      phone: "Telefone/WhatsApp",
      document: "CPF/CNPJ",
      city: "Cidade",
    };
    button.textContent = `${labels[key]}${state.clientSortKey === key ? (state.clientSortDirection === "asc" ? " ↑" : " ↓") : ""}`;
    button.classList.toggle("is-active", state.clientSortKey === key);
  });
}

function enhanceReservationClientSelects() {
  document.querySelectorAll(".reservation-form select[name='clientId']").forEach((select) => {
    if (select.dataset.uxEnhanced === "true") return;
    select.dataset.uxEnhanced = "true";
    select.hidden = true;

    const field = select.closest(".reservation-form__field");
    if (!field) return;

    const control = document.createElement("div");
    const input = document.createElement("input");
    const selected = document.createElement("small");
    const results = document.createElement("div");
    const quickForm = createQuickClientForm((client) => {
      saveClients([client, ...getClients()]);
      refreshSelectOptions(select);
      selectClient(select, input, selected, results, client);
      quickForm.hidden = true;
    });

    control.className = "client-autocomplete ux-reservation-client-autocomplete";
    input.className = "client-autocomplete__input";
    input.type = "search";
    input.placeholder = "Digite o nome, telefone ou CPF do cliente...";
    input.autocomplete = "off";
    selected.className = "client-autocomplete__selected";
    results.className = "client-autocomplete__results";
    results.hidden = true;
    quickForm.hidden = true;

    const currentClient = getClients().find((client) => client.id === select.value);
    selected.textContent = currentClient ? formatSelectedClient(currentClient) : "Nenhum cliente selecionado";
    input.value = currentClient?.name || "";

    input.addEventListener("focus", () => renderAutocompleteResults(select, input, selected, results, quickForm));
    input.addEventListener("click", () => renderAutocompleteResults(select, input, selected, results, quickForm));
    input.addEventListener("input", () => {
      select.value = "";
      selected.textContent = "Nenhum cliente selecionado";
      renderAutocompleteResults(select, input, selected, results, quickForm);
    });
    control.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (!control.contains(document.activeElement)) results.hidden = true;
      }, 120);
    });

    control.append(input, selected, results, quickForm);
    field.append(control);
  });
}

function renderAutocompleteResults(select, input, selected, results, quickForm) {
  const clients = filterClients(getClients(), input.value).slice(0, 8);
  results.replaceChildren();
  results.hidden = false;

  if (!clients.length) {
    const empty = document.createElement("p");
    empty.className = "client-autocomplete__empty";
    empty.textContent = input.value.trim() ? "Nenhum cliente encontrado" : "Digite para buscar ou cadastre um novo cliente";
    results.append(empty);
  }

  clients.forEach((client) => {
    const option = document.createElement("button");
    const name = document.createElement("strong");
    const meta = document.createElement("span");
    option.className = "client-autocomplete__option";
    option.type = "button";
    name.textContent = client.name || "Cliente sem nome";
    meta.textContent = formatClientMeta(client);
    option.append(name, meta);
    option.addEventListener("click", () => selectClient(select, input, selected, results, client));
    results.append(option);
  });

  const createButton = document.createElement("button");
  createButton.className = "client-autocomplete__new";
  createButton.type = "button";
  createButton.textContent = "+ Cadastrar novo cliente";
  createButton.addEventListener("click", () => {
    quickForm.querySelector("input[name='name']").value = input.value.trim();
    results.hidden = true;
    quickForm.hidden = false;
    quickForm.querySelector("input[name='name']").focus();
  });
  results.append(createButton);
}

function createQuickClientForm(onCreate) {
  const form = document.createElement("div");
  form.className = "client-autocomplete__quick-form";
  form.innerHTML = `
    <strong>Cadastrar novo cliente</strong>
    <div class="client-autocomplete__quick-grid">
      <label class="client-autocomplete__quick-field"><span>Nome</span><input name="name" type="text"></label>
      <label class="client-autocomplete__quick-field"><span>Telefone/WhatsApp</span><input name="phone" type="tel"></label>
      <label class="client-autocomplete__quick-field"><span>CPF/CNPJ</span><input name="document" type="text"></label>
      <label class="client-autocomplete__quick-field"><span>Cidade</span><input name="city" type="text"></label>
    </div>
    <p class="client-autocomplete__quick-error" hidden></p>
    <div class="client-autocomplete__quick-actions">
      <button class="button button--secondary" type="button" data-action="cancel">Cancelar</button>
      <button class="button button--primary" type="button" data-action="save">Salvar e selecionar</button>
    </div>
  `;
  form.querySelector("[data-action='cancel']").addEventListener("click", () => {
    form.hidden = true;
  });
  form.querySelector("[data-action='save']").addEventListener("click", () => {
    const error = form.querySelector(".client-autocomplete__quick-error");
    const client = {
      id: crypto.randomUUID(),
      name: form.querySelector("input[name='name']").value.trim(),
      phone: form.querySelector("input[name='phone']").value.trim(),
      document: form.querySelector("input[name='document']").value.trim(),
      city: form.querySelector("input[name='city']").value.trim(),
      address: "",
      notes: "",
    };
    if (!client.name || !client.phone) {
      error.textContent = "Informe nome e telefone para cadastrar o cliente.";
      error.hidden = false;
      return;
    }
    error.hidden = true;
    onCreate(client);
    form.querySelectorAll("input").forEach((field) => { field.value = ""; });
  });
  return form;
}

function selectClient(select, input, selected, results, client) {
  refreshSelectOptions(select);
  select.value = client.id;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  input.value = client.name || "";
  selected.textContent = formatSelectedClient(client);
  results.hidden = true;
}

function refreshSelectOptions(select) {
  const currentValue = select.value;
  select.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Selecione uma opção";
  select.append(empty);
  getClients().forEach((client) => {
    const option = document.createElement("option");
    option.value = client.id;
    option.textContent = client.name || "Cliente sem nome";
    select.append(option);
  });
  select.value = currentValue;
}

function filterClients(clients, term) {
  const query = normalizeText(term);
  const filtered = query
    ? clients.filter((client) => normalizeText([
      client.name,
      client.phone,
      client.document,
      client.cpfCnpj,
      client.cpf_cnpj,
      client.city,
      client.notes,
      client.observations,
    ].join(" ")).includes(query))
    : clients;
  return sortClients(filtered);
}

function sortClients(clients) {
  const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
  const direction = state.clientSortDirection === "desc" ? -1 : 1;
  return [...clients].sort((a, b) => collator.compare(getSortValue(a), getSortValue(b)) * direction);
}

function getSortValue(client) {
  if (state.clientSortKey === "document") return client.document || client.cpfCnpj || client.cpf_cnpj || "";
  return client[state.clientSortKey] || "";
}

function formatSelectedClient(client) {
  return `Selecionado: ${client.name || "Cliente"} • ${formatClientMeta(client)}`;
}

function formatClientMeta(client) {
  return [
    client.phone || "Sem telefone",
    client.document || client.cpfCnpj || client.cpf_cnpj || "Sem CPF/CNPJ",
    client.city || "Cidade não informada",
  ].join(" • ");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function onlyNumbers(value) {
  return String(value || "").replace(/\D/g, "");
}

const styles = document.createElement("style");
styles.textContent = `
.clients-table__toolbar{display:grid;grid-template-columns:minmax(260px,1fr) auto auto;align-items:end;gap:16px;padding:18px;border-bottom:1px solid rgba(228,222,209,.72);background:rgba(248,245,239,.72)}
.clients-table__search,.clients-table__page-size{display:grid;gap:7px;color:var(--color-muted);font-size:.76rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.clients-table__search input,.clients-table__page-size select{min-height:44px;border:1px solid var(--color-line);border-radius:8px;background:var(--color-white);color:var(--color-ink);font:inherit;letter-spacing:0;text-transform:none}.clients-table__search input{width:100%;padding:0 14px}.clients-table__page-size select{padding:0 34px 0 12px}.clients-table__meta{display:grid;gap:4px;color:var(--color-muted);font-size:.86rem;white-space:nowrap}.clients-table__meta strong{color:var(--color-forest-950)}.clients-table__sort{padding:0;border:0;background:transparent;color:inherit;cursor:pointer;font:inherit;font-weight:800;letter-spacing:inherit;text-align:left;text-transform:uppercase}.clients-table__sort:hover,.clients-table__sort:focus-visible,.clients-table__sort.is-active{color:var(--color-forest-800)}.clients-table__pagination{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:16px 18px;border-top:1px solid rgba(228,222,209,.72);background:rgba(255,255,255,.92)}.clients-table__page-indicator{color:var(--color-muted);font-size:.9rem;font-weight:700}
.client-autocomplete{position:relative;display:grid;gap:8px}.client-autocomplete__input{padding:0 12px}.client-autocomplete__selected{color:var(--color-muted);font-size:.82rem;font-weight:600;line-height:1.4}.client-autocomplete__results{position:absolute;top:calc(100% + 6px);right:0;left:0;z-index:8;max-height:320px;overflow:auto;border:1px solid rgba(228,222,209,.95);border-radius:10px;background:var(--color-white);box-shadow:0 18px 42px rgba(20,32,25,.16)}.client-autocomplete__option,.client-autocomplete__new{display:grid;width:100%;gap:4px;padding:12px 14px;border:0;border-bottom:1px solid rgba(228,222,209,.64);background:var(--color-white);color:var(--color-forest-950);cursor:pointer;font:inherit;text-align:left}.client-autocomplete__option:hover,.client-autocomplete__new:hover{background:var(--color-stone-100)}.client-autocomplete__option span{color:var(--color-muted);font-size:.82rem;font-weight:600}.client-autocomplete__new{border-bottom:0;color:var(--color-forest-800);font-weight:800}.client-autocomplete__empty{margin:0;padding:12px 14px;color:var(--color-muted);font-size:.9rem}.client-autocomplete__quick-form{display:grid;gap:14px;padding:16px;border:1px solid rgba(185,149,91,.32);border-radius:12px;background:rgba(248,245,239,.86)}.client-autocomplete__quick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.client-autocomplete__quick-field{display:grid;gap:7px}.client-autocomplete__quick-field input{padding:0 12px}.client-autocomplete__quick-error{margin:0;padding:10px 12px;border:1px solid rgba(176,64,55,.24);border-radius:8px;background:#fff5f3;color:#a4332b;font-size:.86rem;font-weight:700}.client-autocomplete__quick-actions{display:flex;justify-content:flex-end;gap:10px}
@media (max-width:860px){.clients-table__toolbar{grid-template-columns:1fr;align-items:stretch}.clients-table__meta{white-space:normal}.clients-table__pagination{align-items:stretch;flex-direction:column}.clients-table__pagination .button{width:100%}.clients-table__page-indicator{text-align:center}.client-autocomplete__results{position:static;max-height:260px}.client-autocomplete__quick-grid{grid-template-columns:1fr}.client-autocomplete__quick-actions{align-items:stretch;flex-direction:column}.client-autocomplete__quick-actions .button{width:100%}}
`;
document.head.append(styles);

scheduleEnhance();
new MutationObserver(scheduleEnhance).observe(document.body, { childList: true, subtree: true });
window.addEventListener("storage", scheduleEnhance);
