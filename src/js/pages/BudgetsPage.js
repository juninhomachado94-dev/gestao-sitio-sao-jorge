import {
  budgetStatuses,
  budgetTemplates,
  calculateBudgetTotals,
  createBudgetItem,
  createEmptyBudget,
  deleteBudget,
  getBudgets,
  loadBudgets,
  normalizeBudget,
  normalizeBudgetItem,
  saveBudget,
} from "../../services/budgetsService.js";
import { getClients, getReservations, saveClients, saveReservations } from "../../services/dataService.js";
import { formatCurrency } from "../../services/privacyService.js";
import {
  createEmptySupplierCatalogItem,
  deleteSupplierCatalogItem,
  getSupplierCatalog,
  loadSupplierCatalog,
  saveSupplierCatalogItem,
  supplierCategories,
  supplierUnits,
} from "../../services/supplierCatalogService.js";
import { syncReservationRevenues } from "./financeStore.js";

const eventTypes = ["Aniversário infantil", "Aniversário adulto", "Confraternização de empresa", "Casamento", "Lazer", "Outro"];

export function createBudgetsPage() {
  let budgets = getBudgets();
  let catalog = getSupplierCatalog();
  let activeTab = "budgets";

  const page = document.createElement("section");
  page.className = "budgets-page";
  page.setAttribute("aria-labelledby", "budgets-title");

  const header = document.createElement("div");
  header.className = "budgets-page__header";
  header.innerHTML = `
    <div class="budgets-page__header-text">
      <p class="page-panel__kicker">Sítio São Jorge</p>
      <h2 class="budgets-page__title" id="budgets-title">Orçamentos</h2>
      <p class="budgets-page__intro">Monte propostas completas, controle custos, margem e fornecedores antes de transformar em reserva.</p>
    </div>
    <button class="button button--primary" type="button" data-action="new-budget">Novo orçamento</button>
  `;

  const tabsHost = document.createElement("div");
  tabsHost.className = "budgets-tabs";
  const summaryHost = document.createElement("div");
  summaryHost.className = "budgets-page__summary";
  const contentHost = document.createElement("div");
  contentHost.className = "budgets-page__content";

  page.append(header, tabsHost, summaryHost, contentHost);
  header.querySelector("[data-action='new-budget']").addEventListener("click", () => openBudgetModal());

  Promise.all([loadBudgets(), loadSupplierCatalog()]).then(([loadedBudgets, loadedCatalog]) => {
    budgets = loadedBudgets;
    catalog = loadedCatalog;
    render();
  });

  render();
  return page;

  function render() {
    tabsHost.replaceChildren(createTabs());
    if (activeTab === "catalog") {
      summaryHost.replaceChildren(createCatalogSummary());
      contentHost.replaceChildren(createCatalogSection());
      return;
    }
    summaryHost.replaceChildren(createBudgetSummary());
    contentHost.replaceChildren(createBudgetsList());
  }

  function createTabs() {
    const wrapper = document.createElement("div");
    wrapper.className = "budgets-tabs__inner";
    [["budgets", "Orçamentos"], ["catalog", "Catálogo de fornecedores"]].forEach(([id, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `budgets-tabs__button${activeTab === id ? " is-active" : ""}`;
      button.textContent = label;
      button.addEventListener("click", () => {
        activeTab = id;
        render();
      });
      wrapper.append(button);
    });
    return wrapper;
  }

  function createBudgetSummary() {
    const sent = budgets.filter((budget) => budget.status === "enviado").length;
    const approved = budgets.filter((budget) => ["aprovado", "convertido_em_reserva"].includes(budget.status)).length;
    const finalTotal = budgets.reduce((sum, budget) => sum + Number(budget.finalTotal || 0), 0);
    const profitTotal = budgets.reduce((sum, budget) => sum + Number(budget.grossProfit || 0), 0);
    return createSummaryGrid([
      ["Orçamentos", budgets.length, "Total cadastrado"],
      ["Enviados", sent, "Aguardando retorno"],
      ["Aprovados", approved, "Aprovados/convertidos"],
      ["Valor final", formatCurrency(finalTotal), "Soma das propostas"],
      ["Lucro bruto", formatCurrency(profitTotal), "Estimativa de margem"],
    ]);
  }

  function createCatalogSummary() {
    const active = catalog.filter((item) => item.isActive);
    const averageCost = active.length ? active.reduce((sum, item) => sum + Number(item.costPrice || 0), 0) / active.length : 0;
    const averageSale = active.length ? active.reduce((sum, item) => sum + Number(item.suggestedSalePrice || 0), 0) / active.length : 0;
    return createSummaryGrid([
      ["Itens", catalog.length, "Produtos e serviços"],
      ["Ativos", active.length, "Disponíveis para orçamento"],
      ["Categorias", new Set(catalog.map((item) => item.category).filter(Boolean)).size, "Organização comercial"],
      ["Custo médio", formatCurrency(averageCost), "Itens ativos"],
      ["Venda média", formatCurrency(averageSale), "Preço sugerido"],
    ]);
  }

  function createSummaryGrid(items) {
    const wrapper = document.createElement("div");
    wrapper.className = "budgets-summary";
    items.forEach(([title, value, detail]) => {
      const card = document.createElement("article");
      card.className = "budgets-summary__card";
      card.innerHTML = `<span>${title}</span><strong>${value}</strong><small>${detail}</small>`;
      wrapper.append(card);
    });
    return wrapper;
  }

  function createBudgetsList() {
    const section = document.createElement("section");
    section.className = "budgets-list";
    section.innerHTML = `
      <div class="budgets-list__header"><h3>Orçamentos cadastrados</h3></div>
      <div class="budgets-list__table-wrapper"><table><thead><tr>
        <th>Cliente</th><th>Data</th><th>Tipo</th><th>Total</th><th>Custo</th><th>Lucro</th><th>Status</th><th>Ações</th>
      </tr></thead><tbody></tbody></table></div>
    `;
    const tbody = section.querySelector("tbody");
    if (!budgets.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="8">Nenhum orçamento cadastrado</td>`;
      tbody.append(row);
      return section;
    }
    budgets.forEach((budget) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${budget.clientName || "Não informado"}</td>
        <td>${formatDate(budget.eventDate)}</td>
        <td>${budget.eventType || "Não informado"}</td>
        <td>${formatCurrency(budget.finalTotal)}</td>
        <td>${formatCurrency(budget.totalCost)}</td>
        <td>${formatCurrency(budget.grossProfit)}</td>
        <td>${statusBadge(budget.status)}</td>
        <td><div class="budgets-actions">
          <button class="button button--secondary" data-action="edit">Editar</button>
          <button class="button button--secondary" data-action="copy">Copiar</button>
          <button class="button button--secondary" data-action="whatsapp">WhatsApp</button>
          <button class="button button--secondary" data-action="convert">Transformar em reserva</button>
          <button class="button button--danger" data-action="delete">Excluir</button>
        </div></td>
      `;
      row.querySelector("[data-action='edit']").addEventListener("click", () => openBudgetModal(budget));
      row.querySelector("[data-action='copy']").addEventListener("click", () => copyBudgetMessage(budget));
      row.querySelector("[data-action='whatsapp']").addEventListener("click", () => sendBudgetToWhatsApp(budget));
      row.querySelector("[data-action='convert']").addEventListener("click", () => convertBudgetToReservation(budget));
      row.querySelector("[data-action='delete']").addEventListener("click", () => handleDeleteBudget(budget.id));
      tbody.append(row);
    });
    return section;
  }

  function createCatalogSection() {
    const section = document.createElement("section");
    section.className = "supplier-catalog";
    section.innerHTML = `
      <div class="supplier-catalog__header">
        <div><h3>Catálogo de fornecedores</h3><p>Cadastre fornecedores, custos e preços de venda para puxar direto nos orçamentos.</p></div>
        <button class="button button--primary" type="button" data-action="new-catalog">Novo fornecedor/produto</button>
      </div>
      <div class="supplier-catalog__filters">
        <input type="search" placeholder="Pesquisar por fornecedor, produto ou variação" />
        <select><option value="">Todas as categorias</option></select>
      </div>
      <div class="supplier-catalog__table-host"></div>
    `;
    const search = section.querySelector("input");
    const select = section.querySelector("select");
    const host = section.querySelector(".supplier-catalog__table-host");
    supplierCategories.forEach((category) => select.append(new Option(category, category)));
    section.querySelector("[data-action='new-catalog']").addEventListener("click", () => openCatalogModal());
    search.addEventListener("input", renderTable);
    select.addEventListener("change", renderTable);
    renderTable();
    return section;

    function renderTable() {
      const query = search.value.trim().toLowerCase();
      const category = select.value;
      const filtered = catalog.filter((item) => {
        const text = `${item.supplierName} ${item.productName} ${item.variation} ${item.category}`.toLowerCase();
        return (!category || item.category === category) && (!query || text.includes(query));
      });
      const table = document.createElement("table");
      table.innerHTML = `<thead><tr><th>Fornecedor</th><th>Categoria</th><th>Produto/serviço</th><th>Unidade</th><th>Custo</th><th>Venda sugerida</th><th>Status</th><th>Ações</th></tr></thead><tbody></tbody>`;
      const tbody = table.querySelector("tbody");
      if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="8">Nenhum item cadastrado</td></tr>`;
      }
      filtered.forEach((item) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${item.supplierName || "Não informado"}</td>
          <td>${item.category || "Não informado"}</td>
          <td><strong>${item.productName || "Não informado"}</strong><br><small>${item.variation || "Sem variação"}</small></td>
          <td>${item.unit || "unidade"}</td>
          <td>${formatCurrency(item.costPrice)}</td>
          <td>${formatCurrency(item.suggestedSalePrice)}</td>
          <td>${item.isActive ? "Ativo" : "Inativo"}</td>
          <td><div class="budgets-actions">
            <button class="button button--secondary" data-action="edit">Editar</button>
            <button class="button button--secondary" data-action="toggle">${item.isActive ? "Desativar" : "Ativar"}</button>
            <button class="button button--danger" data-action="delete">Excluir</button>
          </div></td>`;
        row.querySelector("[data-action='edit']").addEventListener("click", () => openCatalogModal(item));
        row.querySelector("[data-action='toggle']").addEventListener("click", async () => {
          const saved = await saveSupplierCatalogItem({ ...item, isActive: !item.isActive });
          catalog = upsertById(catalog, saved);
          render();
        });
        row.querySelector("[data-action='delete']").addEventListener("click", async () => {
          if (!window.confirm("Tem certeza que deseja excluir este item do catálogo?")) return;
          await deleteSupplierCatalogItem(item.id);
          catalog = catalog.filter((catalogItem) => catalogItem.id !== item.id);
          render();
        });
        tbody.append(row);
      });
      host.replaceChildren(table);
    }
  }

  function openBudgetModal(existingBudget = null) {
    const modal = document.createElement("div");
    modal.className = "budget-modal";
    const budget = normalizeBudget(existingBudget || createEmptyBudget());
    modal.innerHTML = `
      <div class="budget-modal__dialog" role="dialog" aria-modal="true">
        <div class="budget-modal__header"><h3 class="budget-modal__title">${existingBudget ? "Editar orçamento" : "Novo orçamento"}</h3><button class="budget-modal__close" type="button">×</button></div>
        <form class="budget-form">
          <div class="budget-form__grid">
            ${field("clientName", "Nome do cliente", budget.clientName, true)}
            ${field("clientPhone", "Telefone", budget.clientPhone)}
            ${field("eventDate", "Data do evento", budget.eventDate, true, "date")}
            ${selectField("eventType", "Tipo de evento", eventTypes, budget.eventType)}
            ${field("peopleCount", "Quantidade de pessoas", budget.peopleCount, false, "number")}
            ${selectField("status", "Status", budgetStatuses.map(formatBudgetStatus), formatBudgetStatus(budget.status))}
            ${textarea("notes", "Observações", budget.notes)}
          </div>
          <div class="budget-templates"><span>Templates rápidos</span></div>
          <section class="budget-items"><div class="budget-items__header"><h4>Itens do orçamento</h4><button class="button button--secondary" type="button" data-action="add-item">Adicionar item</button></div><div class="budget-items__host"></div></section>
          <div class="budget-form__grid budget-form__grid--financial">
            ${field("discountValue", "Desconto em R$", budget.discountValue, false, "number")}
            ${field("discountPercent", "Desconto em %", budget.discountPercent, false, "number")}
            ${field("depositValue", "Entrada/sinal", budget.depositValue, false, "number")}
          </div>
          <div class="budget-alerts"></div>
          <div class="budget-totals"></div>
          <p class="budget-form__error" hidden></p>
          <div class="budget-form__actions"><button class="button button--secondary" type="button" data-action="cancel">Cancelar</button><button class="button button--primary" type="submit">Salvar orçamento</button></div>
        </form>
      </div>`;
    document.body.append(modal);

    const form = modal.querySelector("form");
    const close = () => modal.remove();
    modal.querySelector(".budget-modal__close").addEventListener("click", close);
    modal.querySelector("[data-action='cancel']").addEventListener("click", close);

    let current = budget;
    const templatesBar = modal.querySelector(".budget-templates");
    budgetTemplates.forEach((template) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button--secondary";
      button.textContent = template.name;
      button.addEventListener("click", () => {
        current = normalizeBudget({ ...current, items: template.items.map((item) => normalizeBudgetItem(item)) });
        renderItems();
      });
      templatesBar.append(button);
    });

    modal.querySelector("[data-action='add-item']").addEventListener("click", () => {
      current = normalizeBudget({ ...current, items: [...current.items, createBudgetItem()] });
      renderItems();
    });
    ["discountValue", "discountPercent", "depositValue"].forEach((name) => form.elements[name].addEventListener("input", renderTotals));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const nextBudget = readBudgetFromForm(current, form);
      const validation = validateBudget(nextBudget);
      const error = modal.querySelector(".budget-form__error");
      if (validation) {
        error.textContent = validation;
        error.hidden = false;
        return;
      }
      const saved = await saveBudget(nextBudget);
      budgets = upsertById(budgets, saved);
      close();
      render();
    });

    renderItems();

    function renderItems() {
      const host = modal.querySelector(".budget-items__host");
      host.replaceChildren(createItemsTable(current.items, (items) => {
        current = normalizeBudget({ ...current, items });
        renderItems();
      }));
      renderTotals();
    }

    function renderTotals() {
      current = readBudgetFromForm(current, form, false);
      const totals = calculateBudgetTotals(current);
      const totalsHost = modal.querySelector(".budget-totals");
      totalsHost.innerHTML = "";
      [["Custo total", totals.totalCost], ["Venda total", totals.totalSale], ["Desconto", totals.discountValue], ["Total final", totals.finalTotal], ["Lucro bruto", totals.grossProfit], ["Restante", totals.remainingValue]].forEach(([label, value]) => {
        const card = document.createElement("article");
        card.className = "budget-totals__card";
        card.innerHTML = `<span>${label}</span><strong>${formatCurrency(value)}</strong>`;
        totalsHost.append(card);
      });
      const alerts = modal.querySelector(".budget-alerts");
      alerts.replaceChildren(...createBudgetAlerts(current, totals));
    }
  }

  function createItemsTable(items, onChange) {
    const wrapper = document.createElement("div");
    wrapper.className = "budget-items__table";
    const table = document.createElement("table");
    table.innerHTML = `<thead><tr><th>Catálogo</th><th>Item</th><th>Categoria</th><th>Unidade</th><th>Qtd.</th><th>Custo unit.</th><th>Venda unit.</th><th>Margem</th><th>Custo</th><th>Venda</th><th>Lucro</th><th></th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector("tbody");
    items.forEach((item, index) => {
      const row = document.createElement("tr");
      row.append(
        cell(catalogSelect(item, (catalogItem) => update(index, catalogItem ? {
          catalogItemId: catalogItem.id,
          supplierName: catalogItem.supplierName,
          name: catalogItem.variation ? `${catalogItem.productName} - ${catalogItem.variation}` : catalogItem.productName,
          category: catalogItem.category,
          unit: catalogItem.unit,
          unitCost: catalogItem.costPrice,
          unitPrice: catalogItem.suggestedSalePrice,
        } : { catalogItemId: "" }))),
        cell(input(item.name, "text", (value) => update(index, { name: value }))),
        cell(input(item.category, "text", (value) => update(index, { category: value }))),
        cell(input(item.unit, "text", (value) => update(index, { unit: value }))),
        cell(input(item.quantity, "number", (value) => update(index, { quantity: Number(value || 0) }))),
        cell(input(item.unitCost, "number", (value) => update(index, { unitCost: Number(value || 0) }))),
        cell(input(item.unitPrice, "number", (value) => update(index, { unitPrice: Number(value || 0) }))),
        cell(marginButtons(item, (margin) => update(index, { unitPrice: calculateSalePriceFromMargin(item.unitCost, margin) }))),
        textCell(formatCurrency(item.subtotalCost)),
        textCell(formatCurrency(item.subtotalSale)),
        textCell(formatCurrency(item.profit), item.profit < 0 ? "budget-items__negative" : ""),
        cell(removeButton(() => {
          const next = items.filter((_, itemIndex) => itemIndex !== index);
          onChange(next.length ? next : [createBudgetItem()]);
        })),
      );
      tbody.append(row);
    });
    wrapper.append(table);
    return wrapper;

    function update(index, changes) {
      onChange(items.map((item, itemIndex) => itemIndex === index ? normalizeBudgetItem({ ...item, ...changes }) : item));
    }
  }

  function catalogSelect(item, onSelect) {
    const select = document.createElement("select");
    select.append(new Option("Selecionar", ""));
    catalog.filter((catalogItem) => catalogItem.isActive).forEach((catalogItem) => {
      select.append(new Option(`${catalogItem.productName}${catalogItem.variation ? ` - ${catalogItem.variation}` : ""} (${catalogItem.supplierName})`, catalogItem.id));
    });
    select.value = item.catalogItemId || "";
    select.addEventListener("change", () => onSelect(catalog.find((catalogItem) => catalogItem.id === select.value)));
    return select;
  }

  function openCatalogModal(existingItem = null) {
    const item = existingItem || createEmptySupplierCatalogItem();
    const modal = document.createElement("div");
    modal.className = "budget-modal";
    modal.innerHTML = `<div class="budget-modal__dialog budget-modal__dialog--compact"><div class="budget-modal__header"><h3 class="budget-modal__title">${existingItem ? "Editar fornecedor/produto" : "Novo fornecedor/produto"}</h3><button class="budget-modal__close" type="button">×</button></div><form class="budget-form"><div class="budget-form__grid">${field("supplierName", "Nome do fornecedor", item.supplierName, true)}${selectField("category", "Categoria", supplierCategories, item.category)}${field("productName", "Produto/serviço", item.productName, true)}${field("variation", "Variação", item.variation)}${selectField("unit", "Unidade", supplierUnits, item.unit)}${field("costPrice", "Preço de custo", item.costPrice, false, "number")}${field("suggestedSalePrice", "Preço sugerido de venda", item.suggestedSalePrice, false, "number")}${textarea("notes", "Observações", item.notes)}</div><label class="budget-field"><span>Status</span><select name="isActive"><option value="true">Ativo</option><option value="false">Inativo</option></select></label><p class="budget-form__error" hidden></p><div class="budget-form__actions"><button class="button button--secondary" type="button" data-action="cancel">Cancelar</button><button class="button button--primary" type="submit">Salvar</button></div></form></div>`;
    document.body.append(modal);
    const form = modal.querySelector("form");
    form.elements.isActive.value = String(item.isActive !== false);
    const close = () => modal.remove();
    modal.querySelector(".budget-modal__close").addEventListener("click", close);
    modal.querySelector("[data-action='cancel']").addEventListener("click", close);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.elements.supplierName.value.trim() || !form.elements.productName.value.trim()) {
        const error = modal.querySelector(".budget-form__error");
        error.textContent = "Informe fornecedor e produto/serviço.";
        error.hidden = false;
        return;
      }
      const saved = await saveSupplierCatalogItem({
        ...item,
        supplierName: form.elements.supplierName.value.trim(),
        category: form.elements.category.value,
        productName: form.elements.productName.value.trim(),
        variation: form.elements.variation.value.trim(),
        unit: form.elements.unit.value,
        costPrice: Number(form.elements.costPrice.value || 0),
        suggestedSalePrice: Number(form.elements.suggestedSalePrice.value || 0),
        notes: form.elements.notes.value.trim(),
        isActive: form.elements.isActive.value === "true",
      });
      catalog = upsertById(catalog, saved);
      close();
      render();
    });
  }

  async function handleDeleteBudget(budgetId) {
    if (!window.confirm("Tem certeza que deseja excluir este orçamento?")) return;
    await deleteBudget(budgetId);
    budgets = budgets.filter((budget) => budget.id !== budgetId);
    render();
  }

  async function copyBudgetMessage(budget) {
    const message = createBudgetMessage(budget);
    try {
      await navigator.clipboard.writeText(message);
      window.alert("Orçamento copiado.");
    } catch {
      window.prompt("Copie o orçamento abaixo:", message);
    }
  }

  async function sendBudgetToWhatsApp(budget) {
    const phone = sanitizePhone(budget.clientPhone);
    if (!phone) {
      window.alert("Telefone do cliente não encontrado.");
      return;
    }
    const updated = normalizeBudget({ ...budget, status: budget.status === "rascunho" ? "enviado" : budget.status });
    await saveBudget(updated);
    budgets = upsertById(budgets, updated);
    render();
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(createBudgetMessage(updated))}`, "_blank", "noopener,noreferrer");
  }

  async function convertBudgetToReservation(budget) {
    if (!window.confirm("Deseja transformar este orçamento em reserva? Isso criará cliente/reserva e lançamentos financeiros vinculados.")) return;
    if (!budget.clientName || !budget.eventDate || !budget.finalTotal) {
      window.alert("Preencha nome do cliente, data do evento e valor final antes de transformar em reserva.");
      return;
    }
    const clients = getClients();
    const client = findOrCreateClient(clients, budget);
    const reservation = createReservationFromBudget(budget, client);
    const reservations = getReservations();
    if (hasActiveReservationConflict(reservations, reservation)) {
      window.alert("Já existe uma reserva ativa para esta data.");
      return;
    }
    saveClients(upsertById(clients, client));
    saveReservations([reservation, ...reservations]);
    syncReservationRevenues(reservation, client);
    const updated = await saveBudget(normalizeBudget({ ...budget, status: "convertido_em_reserva", notes: `${budget.notes || ""}\nConvertido em reserva ${reservation.id}.`.trim() }));
    budgets = upsertById(budgets, updated);
    render();
    window.alert("Orçamento transformado em reserva com sucesso.");
  }
}

function field(name, label, value = "", required = false, type = "text") {
  return `<label class="budget-field"><span>${label}</span><input name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? "required" : ""} ${type === "number" ? "min='0' step='0.01'" : ""}></label>`;
}

function selectField(name, label, options, value = "") {
  const opts = options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("");
  return `<label class="budget-field"><span>${label}</span><select name="${name}">${opts}</select></label>`;
}

function textarea(name, label, value = "") {
  return `<label class="budget-field budget-field--full"><span>${label}</span><textarea name="${name}" rows="3">${escapeHtml(value)}</textarea></label>`;
}

function input(value, type, onInput) {
  const element = document.createElement("input");
  element.type = type;
  element.value = value ?? "";
  if (type === "number") {
    element.min = "0";
    element.step = "0.01";
  }
  element.addEventListener("input", () => onInput(element.value));
  return element;
}

function cell(child) {
  const td = document.createElement("td");
  td.append(child);
  return td;
}

function textCell(text, className = "") {
  const td = document.createElement("td");
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function removeButton(onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button--danger";
  button.textContent = "Remover";
  button.addEventListener("click", onClick);
  return button;
}

function marginButtons(item, onApply) {
  const wrapper = document.createElement("div");
  wrapper.className = "budget-margin-buttons";
  const value = document.createElement("span");
  value.className = "budget-margin-buttons__value";
  value.textContent = `${Number(item.margin || 0).toFixed(1)}%`;
  wrapper.append(value);
  [10, 20, 30, 50].forEach((margin) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button--secondary";
    button.textContent = `+${margin}%`;
    button.addEventListener("click", () => onApply(margin));
    wrapper.append(button);
  });
  const custom = document.createElement("button");
  custom.type = "button";
  custom.className = "button button--secondary";
  custom.textContent = "Personalizado";
  custom.addEventListener("click", () => {
    const margin = Number(String(window.prompt("Informe a margem desejada em %:", Number(item.margin || 0).toFixed(1)) || "").replace(",", "."));
    if (Number.isNaN(margin)) return window.alert("Margem inválida.");
    onApply(margin);
  });
  wrapper.append(custom);
  return wrapper;
}

function readBudgetFromForm(current, form, freshUpdate = true) {
  return normalizeBudget({
    ...current,
    clientName: form.elements.clientName.value.trim(),
    clientPhone: form.elements.clientPhone.value.trim(),
    eventDate: form.elements.eventDate.value,
    eventType: form.elements.eventType.value,
    peopleCount: form.elements.peopleCount.value,
    notes: form.elements.notes.value.trim(),
    discountValue: Number(form.elements.discountValue.value || 0),
    discountPercent: Number(form.elements.discountPercent.value || 0),
    depositValue: Number(form.elements.depositValue.value || 0),
    status: parseBudgetStatus(form.elements.status.value),
    updatedAt: freshUpdate ? new Date().toISOString() : current.updatedAt,
  });
}

function createBudgetAlerts(budget, totals) {
  const alerts = [];
  if (budget.items.some((item) => Number(item.profit || 0) < 0)) alerts.push(alert("Este item está abaixo do custo.", "danger"));
  if (totals.finalTotal > 0 && totals.profitMargin < 20) alerts.push(alert("Margem baixa. Revise o valor antes de enviar.", "warning"));
  return alerts;
}

function alert(message, tone) {
  const element = document.createElement("div");
  element.className = `budget-alert budget-alert--${tone}`;
  element.textContent = message;
  return element;
}

function createBudgetMessage(budget) {
  const includedItems = budget.items.filter((item) => item.name).map((item) => `- ${item.name}${item.quantity ? ` (${item.quantity})` : ""}`).join("\n");
  return `Olá, ${budget.clientName}! Segue o orçamento para sua festa no Sítio São Jorge:

Data: ${formatDate(budget.eventDate)}
Tipo de evento: ${budget.eventType || "Não informado"}
Quantidade de pessoas: ${budget.peopleCount || "Não informada"}

Itens inclusos:
${includedItems || "- Itens a definir"}

Total: ${formatCurrency(budget.finalTotal)}
Entrada: ${formatCurrency(budget.depositValue)}
Restante: ${formatCurrency(budget.remainingValue)}

Fico à disposição para qualquer dúvida.`;
}

function findOrCreateClient(clients, budget) {
  const phone = sanitizePhoneDigits(budget.clientPhone);
  const existing = clients.find((client) => sanitizePhoneDigits(client.phone) === phone || client.name?.trim().toLowerCase() === budget.clientName.trim().toLowerCase());
  return existing || { id: crypto.randomUUID(), name: budget.clientName, phone: budget.clientPhone, document: "", address: "", city: "", notes: `Criado a partir do orçamento ${budget.id}.` };
}

function createReservationFromBudget(budget, client) {
  return {
    id: `reserva-${Date.now()}`,
    clientId: client.id,
    clientName: client.name,
    dataEntrada: budget.eventDate,
    horaEntrada: "09:00",
    dataSaida: budget.eventDate,
    horaSaida: "18:00",
    eventType: budget.eventType || "Outro",
    totalValue: Number(budget.finalTotal || 0),
    depositValue: Number(budget.depositValue || 0),
    remainingValue: Number(budget.remainingValue || 0),
    paymentMethod: "Pix",
    paymentStatus: Number(budget.depositValue || 0) > 0 ? "Sinal pago" : "Pendente",
    reservationStatus: "Pré-reserva",
    notes: `Criada a partir do orçamento ${budget.id}. ${budget.notes || ""}`.trim(),
  };
}

function hasActiveReservationConflict(reservations, nextReservation) {
  return reservations.some((reservation) => {
    if (reservation.reservationStatus === "Cancelada") return false;
    const start = createDateTime(reservation.dataEntrada, reservation.horaEntrada);
    const end = createDateTime(reservation.dataSaida, reservation.horaSaida);
    const nextStart = createDateTime(nextReservation.dataEntrada, nextReservation.horaEntrada);
    const nextEnd = createDateTime(nextReservation.dataSaida, nextReservation.horaSaida);
    return start && end && nextStart && nextEnd && nextStart < end && nextEnd > start;
  });
}

function createDateTime(date, time) {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function validateBudget(budget) {
  if (!budget.clientName) return "Informe o nome do cliente.";
  if (!budget.eventDate) return "Informe a data do evento.";
  if (!budget.items.some((item) => item.name && Number(item.quantity) > 0)) return "Adicione pelo menos um item válido ao orçamento.";
  return "";
}

function calculateSalePriceFromMargin(cost, margin) {
  return Number(cost || 0) * (1 + Number(margin || 0) / 100);
}

function statusBadge(status) {
  return `<span class="budget-status budget-status--${status}">${formatBudgetStatus(status)}</span>`;
}

function formatBudgetStatus(status) {
  const labels = { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", recusado: "Recusado", convertido_em_reserva: "Convertido em reserva" };
  return labels[status] || status;
}

function parseBudgetStatus(label) {
  return budgetStatuses.find((status) => formatBudgetStatus(status) === label) || "rascunho";
}

function formatDate(value) {
  if (!value) return "Não informado";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function sanitizePhone(value) {
  const digits = sanitizePhoneDigits(value);
  return digits ? (digits.startsWith("55") ? digits : `55${digits}`) : "";
}

function sanitizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function upsertById(items, nextItem) {
  return items.some((item) => item.id === nextItem.id) ? items.map((item) => item.id === nextItem.id ? nextItem : item) : [nextItem, ...items];
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
}
