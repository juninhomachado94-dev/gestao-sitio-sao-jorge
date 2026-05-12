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
import {
  getClients,
  getContracts,
  getOwnerSignature,
  getReservations,
  saveClients,
  saveReservations,
} from "../../services/dataService.js";
import { formatCurrency } from "../../services/privacyService.js";
import {
  createEmptySupplierCatalogItem,
  deleteSupplierCatalogItem,
  getSupplierCatalog,
  getSupplierCatalogWarning,
  loadSupplierCatalog,
  saveSupplierCatalogItem,
  supplierCategories,
  supplierUnits,
} from "../../services/supplierCatalogService.js";
import { getContractTemplates, getStoredContractTemplates } from "./contractTemplatesStore.js";
import { syncReservationRevenues } from "./financeStore.js";
import { createContractToken, saveGeneratedContract } from "./generatedContractsStore.js";

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
      <p class="budgets-page__intro">Monte propostas completas, controle custos e envie orçamentos profissionais.</p>
    </div>
    <button class="button button--primary" type="button" data-action="new-budget">Novo orçamento</button>
  `;

  const tabsHost = document.createElement("div");
  tabsHost.className = "budgets-tabs";
  const summaryHost = document.createElement("div");
  const contentHost = document.createElement("div");

  page.append(header, tabsHost, summaryHost, contentHost);
  header.querySelector("[data-action='new-budget']").addEventListener("click", () => openBudgetModal());

  Promise.allSettled([loadBudgets(), loadSupplierCatalog()]).then(([budgetsResult, catalogResult]) => {
    if (budgetsResult.status === "fulfilled" && Array.isArray(budgetsResult.value)) budgets = budgetsResult.value;
    if (catalogResult.status === "fulfilled" && Array.isArray(catalogResult.value)) catalog = catalogResult.value;
    if (budgetsResult.status === "rejected") console.error("Erro ao carregar orçamentos:", budgetsResult.reason);
    if (catalogResult.status === "rejected") console.error("Erro ao carregar catálogo:", catalogResult.reason);
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
      button.addEventListener("click", () => { activeTab = id; render(); });
      wrapper.append(button);
    });
    return wrapper;
  }

  function createBudgetSummary() {
    const sent = budgets.filter((budget) => ["enviado", "aguardando_resposta"].includes(budget.status)).length;
    const approved = budgets.filter((budget) => ["aprovado", "convertido_em_reserva"].includes(budget.status)).length;
    const refused = budgets.filter((budget) => budget.status === "recusado").length;
    const finalTotal = budgets.reduce((sum, budget) => sum + Number(budget.finalTotal || 0), 0);
    const profitTotal = budgets.reduce((sum, budget) => sum + Number(budget.grossProfit || 0), 0);
    const conversion = budgets.length ? `${((approved / budgets.length) * 100).toFixed(1)}%` : "0.0%";
    return createSummaryGrid([
      ["Orçamentos", budgets.length, "Total cadastrado"],
      ["Enviados", sent, "Enviados/aguardando retorno"],
      ["Aprovados", approved, "Aprovados/convertidos"],
      ["Recusados", refused, "Oportunidades perdidas"],
      ["Taxa de conversão", conversion, "Aprovados sobre total"],
      ["Lucro estimado", formatCurrency(profitTotal), "Controle interno"],
      ["Valor final", formatCurrency(finalTotal), "Soma das propostas"],
    ]);
  }

  function createCatalogSummary() {
    const active = catalog.filter((item) => item.isActive);
    return createSummaryGrid([
      ["Itens", catalog.length, "Produtos e serviços"],
      ["Ativos", active.length, "Disponíveis para orçamento"],
      ["Categorias", new Set(catalog.map((item) => item.category).filter(Boolean)).size, "Organização comercial"],
      ["Custo médio", formatCurrency(average(active, "costPrice")), "Itens ativos"],
      ["Venda média", formatCurrency(average(active, "suggestedSalePrice")), "Preço sugerido"],
    ]);
  }

  function createSummaryGrid(items) {
    const wrapper = document.createElement("div");
    wrapper.className = "budgets-summary";
    items.forEach(([title, value, detail]) => {
      const card = document.createElement("article");
      card.className = "budgets-summary__card";
      card.innerHTML = `<span>${escapeHtml(title)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small>`;
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
        <th>Cliente</th><th>Data</th><th>Tipo</th><th>Total</th><th>Entrada</th><th>Restante</th><th>Status</th><th>Ações</th>
      </tr></thead><tbody></tbody></table></div>`;
    const tbody = section.querySelector("tbody");
    if (!budgets.length) tbody.innerHTML = `<tr><td colspan="8">Nenhum orçamento cadastrado</td></tr>`;
    budgets.forEach((budget) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(budget.clientName || "Não informado")}</td>
        <td>${formatDate(budget.eventDate)}</td>
        <td>${escapeHtml(budget.eventType || "Não informado")}</td>
        <td>${formatCurrency(budget.finalTotal)}</td>
        <td>${formatCurrency(budget.depositValue)}</td>
        <td>${formatCurrency(budget.remainingValue)}</td>
        <td>${statusBadge(budget.status)}${flowMeta(budget)}</td>
        <td><div class="budgets-actions">
          <button class="button button--secondary" data-action="edit">Editar</button>
          <button class="button button--secondary" data-action="copy">Copiar resumo</button>
          <button class="button button--secondary" data-action="preview">Visualizar PDF</button>
          <button class="button button--secondary" data-action="pdf">Gerar PDF</button>
          <button class="button button--secondary" data-action="whatsapp">Enviar WhatsApp</button>
          <button class="button button--primary" data-action="convert">Transformar em reserva</button>
          <button class="button button--danger" data-action="delete">Excluir</button>
        </div></td>`;
      row.querySelector("[data-action='edit']").addEventListener("click", () => openBudgetModal(budget));
      row.querySelector("[data-action='copy']").addEventListener("click", () => copyBudgetMessage(budget));
      row.querySelector("[data-action='preview']").addEventListener("click", () => openBudgetPdfWindow(budget));
      row.querySelector("[data-action='pdf']").addEventListener("click", () => generateBudgetPdf(budget));
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
        <div><h3>Catálogo de fornecedores</h3><p>Cadastre custos e preços de venda para puxar direto nos orçamentos.</p></div>
        <button class="button button--primary" type="button" data-action="new-catalog">Novo fornecedor/produto</button>
      </div>
      <div class="supplier-catalog__filters"><input type="search" placeholder="Pesquisar fornecedor ou produto" /><select><option value="">Todas as categorias</option></select></div>
      <div class="supplier-catalog__table-host"></div>`;
    const warning = getSupplierCatalogWarning();
    if (warning) {
      const alert = document.createElement("div");
      alert.className = "budget-alert budget-alert--warning";
      alert.textContent = warning;
      section.insertBefore(alert, section.querySelector(".supplier-catalog__filters"));
    }
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
      if (!filtered.length) tbody.innerHTML = `<tr><td colspan="8">Nenhum item cadastrado</td></tr>`;
      filtered.forEach((item) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${escapeHtml(item.supplierName || "Não informado")}</td><td>${escapeHtml(item.category || "Outros")}</td>
          <td><strong>${escapeHtml(item.productName || "Não informado")}</strong><br><small>${escapeHtml(item.variation || "Sem variação")}</small></td>
          <td>${escapeHtml(item.unit || "unidade")}</td><td>${formatCurrency(item.costPrice)}</td><td>${formatCurrency(item.suggestedSalePrice)}</td>
          <td>${item.isActive ? "Ativo" : "Inativo"}</td><td><div class="budgets-actions">
            <button class="button button--secondary" data-action="edit">Editar</button>
            <button class="button button--secondary" data-action="toggle">${item.isActive ? "Desativar" : "Ativar"}</button>
            <button class="button button--danger" data-action="delete">Excluir</button>
          </div></td>`;
        row.querySelector("[data-action='edit']").addEventListener("click", () => openCatalogModal(item));
        row.querySelector("[data-action='toggle']").addEventListener("click", async () => {
          const saved = await saveSupplierCatalogItem({ ...item, isActive: !item.isActive });
          catalog = upsertById(catalog, saved); render();
        });
        row.querySelector("[data-action='delete']").addEventListener("click", async () => {
          if (!window.confirm("Tem certeza que deseja excluir este item do catálogo?")) return;
          await deleteSupplierCatalogItem(item.id);
          catalog = catalog.filter((catalogItem) => catalogItem.id !== item.id); render();
        });
        tbody.append(row);
      });
      host.replaceChildren(table);
    }
  }

  function openBudgetModal(existingBudget = null) {
    const budget = normalizeBudget(existingBudget || createEmptyBudget());
    const modal = document.createElement("div");
    modal.className = "budget-modal";
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
            ${field("validityDays", "Validade em dias", budget.validityDays || 3, false, "number")}
            ${selectField("status", "Status", budgetStatuses.map(formatBudgetStatus), formatBudgetStatus(budget.status))}
            ${textarea("notes", "Observações", budget.notes)}
          </div>
          <div class="budget-templates"><span>Templates rápidos</span></div>
          <section class="budget-items"><div class="budget-items__header"><h4>Itens do orçamento</h4><button class="button button--secondary" type="button" data-action="add-item">Adicionar item</button></div><div class="budget-items__host"></div></section>
          <div class="budget-form__grid budget-form__grid--financial">${field("discountValue", "Desconto em R$", budget.discountValue, false, "number")}${field("discountPercent", "Desconto em %", budget.discountPercent, false, "number")}${field("depositValue", "Entrada/sinal", budget.depositValue, false, "number")}</div>
          <div class="budget-alerts"></div><div class="budget-totals"></div><p class="budget-form__error" hidden></p>
          <div class="budget-form__actions"><button class="button button--secondary" type="button" data-action="cancel">Cancelar</button><button class="button button--primary" type="submit">Salvar orçamento</button></div>
        </form>
      </div>`;
    document.body.append(modal);
    const form = modal.querySelector("form");
    const close = () => modal.remove();
    let current = budget;
    modal.querySelector(".budget-modal__close").addEventListener("click", close);
    modal.querySelector("[data-action='cancel']").addEventListener("click", close);
    modal.querySelector("[data-action='add-item']").addEventListener("click", () => { current = normalizeBudget({ ...current, items: [...current.items, createBudgetItem()] }); renderItems(); });
    budgetTemplates.forEach((template) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "button button--secondary"; button.textContent = template.name;
      button.addEventListener("click", () => { current = normalizeBudget({ ...current, items: template.items.map((item) => normalizeBudgetItem(item)) }); renderItems(); });
      modal.querySelector(".budget-templates").append(button);
    });
    ["discountValue", "discountPercent", "depositValue"].forEach((name) => form.elements[name].addEventListener("input", renderTotals));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const nextBudget = readBudgetFromForm(current, form);
      const validation = validateBudget(nextBudget);
      const error = modal.querySelector(".budget-form__error");
      if (validation) { error.textContent = validation; error.hidden = false; return; }
      const saved = await saveBudget(nextBudget);
      budgets = upsertById(budgets, saved);
      close(); render();
    });
    renderItems();
    function renderItems() {
      modal.querySelector(".budget-items__host").replaceChildren(createItemsTable(current.items, (items) => { current = normalizeBudget({ ...current, items }); renderItems(); }));
      renderTotals();
    }
    function renderTotals() {
      current = readBudgetFromForm(current, form, false);
      const totals = calculateBudgetTotals(current);
      const totalsHost = modal.querySelector(".budget-totals"); totalsHost.innerHTML = "";
      [["Custo total", totals.totalCost], ["Venda total", totals.totalSale], ["Desconto", totals.discountValue], ["Total final", totals.finalTotal], ["Lucro bruto", totals.grossProfit], ["Restante", totals.remainingValue]].forEach(([label, value]) => {
        const card = document.createElement("article"); card.className = "budget-totals__card"; card.innerHTML = `<span>${label}</span><strong>${formatCurrency(value)}</strong>`; totalsHost.append(card);
      });
      modal.querySelector(".budget-alerts").replaceChildren(...createBudgetAlerts(current, totals));
    }
  }

  function createItemsTable(items, onChange) {
    const wrapper = document.createElement("div"); wrapper.className = "budget-items__table";
    const table = document.createElement("table"); table.innerHTML = `<thead><tr><th>Catálogo</th><th>Item</th><th>Categoria</th><th>Unidade</th><th>Qtd.</th><th>Custo unit.</th><th>Venda unit.</th><th>Margem</th><th>Custo</th><th>Venda</th><th>Lucro</th><th></th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector("tbody");
    items.forEach((item, index) => {
      const row = document.createElement("tr");
      row.append(cell(catalogSelect(item, (catalogItem) => update(index, catalogItem ? { catalogItemId: catalogItem.id, supplierName: catalogItem.supplierName, name: catalogItem.variation ? `${catalogItem.productName} - ${catalogItem.variation}` : catalogItem.productName, category: catalogItem.category, unit: catalogItem.unit, unitCost: catalogItem.costPrice, unitPrice: catalogItem.suggestedSalePrice } : { catalogItemId: "" }))), cell(input(item.name, "text", (value) => update(index, { name: value }))), cell(input(item.category, "text", (value) => update(index, { category: value }))), cell(input(item.unit, "text", (value) => update(index, { unit: value }))), cell(input(item.quantity, "number", (value) => update(index, { quantity: Number(value || 0) }))), cell(input(item.unitCost, "number", (value) => update(index, { unitCost: Number(value || 0) }))), cell(input(item.unitPrice, "number", (value) => update(index, { unitPrice: Number(value || 0) }))), cell(marginButtons(item, (margin) => update(index, { unitPrice: calculateSalePriceFromMargin(item.unitCost, margin) }))), textCell(formatCurrency(item.subtotalCost)), textCell(formatCurrency(item.subtotalSale)), textCell(formatCurrency(item.profit), item.profit < 0 ? "budget-items__negative" : ""), cell(removeButton(() => { const next = items.filter((_, itemIndex) => itemIndex !== index); onChange(next.length ? next : [createBudgetItem()]); })));
      tbody.append(row);
    });
    wrapper.append(table); return wrapper;
    function update(index, changes) { onChange(items.map((item, itemIndex) => itemIndex === index ? normalizeBudgetItem({ ...item, ...changes }) : item)); }
  }

  function catalogSelect(item, onSelect) {
    const select = document.createElement("select"); select.append(new Option("Selecionar", ""));
    catalog.filter((catalogItem) => catalogItem.isActive).forEach((catalogItem) => select.append(new Option(`${catalogItem.productName}${catalogItem.variation ? ` - ${catalogItem.variation}` : ""} (${catalogItem.supplierName})`, catalogItem.id)));
    select.value = item.catalogItemId || ""; select.addEventListener("change", () => onSelect(catalog.find((catalogItem) => catalogItem.id === select.value))); return select;
  }

  function openCatalogModal(existingItem = null) {
    const item = existingItem || createEmptySupplierCatalogItem();
    const modal = document.createElement("div"); modal.className = "budget-modal";
    modal.innerHTML = `<div class="budget-modal__dialog budget-modal__dialog--compact"><div class="budget-modal__header"><h3 class="budget-modal__title">${existingItem ? "Editar fornecedor/produto" : "Novo fornecedor/produto"}</h3><button class="budget-modal__close" type="button">×</button></div><form class="budget-form"><div class="budget-form__grid">${field("supplierName", "Nome do fornecedor", item.supplierName, true)}${selectField("category", "Categoria", supplierCategories, item.category)}${field("productName", "Produto/serviço", item.productName, true)}${field("variation", "Variação", item.variation)}${selectField("unit", "Unidade", supplierUnits, item.unit)}${field("costPrice", "Preço de custo", item.costPrice, false, "number")}${field("suggestedSalePrice", "Preço sugerido de venda", item.suggestedSalePrice, false, "number")}${textarea("notes", "Observações", item.notes)}</div><label class="budget-field"><span>Status</span><select name="isActive"><option value="true">Ativo</option><option value="false">Inativo</option></select></label><p class="budget-form__error" hidden></p><div class="budget-form__actions"><button class="button button--secondary" type="button" data-action="cancel">Cancelar</button><button class="button button--primary" type="submit">Salvar</button></div></form></div>`;
    document.body.append(modal);
    const form = modal.querySelector("form"); form.elements.isActive.value = String(item.isActive !== false);
    const close = () => modal.remove(); modal.querySelector(".budget-modal__close").addEventListener("click", close); modal.querySelector("[data-action='cancel']").addEventListener("click", close);
    form.addEventListener("submit", async (event) => { event.preventDefault(); if (!form.elements.supplierName.value.trim() || !form.elements.productName.value.trim()) { const error = modal.querySelector(".budget-form__error"); error.textContent = "Informe fornecedor e produto/serviço."; error.hidden = false; return; } const saved = await saveSupplierCatalogItem({ ...item, supplierName: form.elements.supplierName.value.trim(), category: form.elements.category.value, productName: form.elements.productName.value.trim(), variation: form.elements.variation.value.trim(), unit: form.elements.unit.value, costPrice: Number(form.elements.costPrice.value || 0), suggestedSalePrice: Number(form.elements.suggestedSalePrice.value || 0), notes: form.elements.notes.value.trim(), isActive: form.elements.isActive.value === "true" }); catalog = upsertById(catalog, saved); close(); render(); });
  }

  async function handleDeleteBudget(budgetId) { if (!window.confirm("Tem certeza que deseja excluir este orçamento?")) return; await deleteBudget(budgetId); budgets = budgets.filter((budget) => budget.id !== budgetId); render(); }
  async function copyBudgetMessage(budget) { const message = createBudgetMessage(budget); try { await navigator.clipboard.writeText(message); window.alert("Orçamento copiado."); } catch { window.prompt("Copie o orçamento abaixo:", message); } }
  async function generateBudgetPdf(budget) { const updated = normalizeBudget({ ...budget, pdfHistory: [...(Array.isArray(budget.pdfHistory) ? budget.pdfHistory : []), { action: "pdf_generated", generatedAt: new Date().toISOString() }] }); await saveBudget(updated); budgets = upsertById(budgets, updated); render(); openBudgetPdfWindow(updated, { shouldPrint: true }); }
  async function sendBudgetToWhatsApp(budget) { const phone = sanitizePhone(budget.clientPhone); if (!phone) { window.alert("Telefone do cliente não encontrado."); return; } const now = new Date().toISOString(); const updated = normalizeBudget({ ...budget, status: budget.status === "rascunho" ? "aguardando_resposta" : budget.status, flowHistory: { ...budget.flowHistory, sentAt: budget.flowHistory?.sentAt || now } }); await saveBudget(updated); budgets = upsertById(budgets, updated); render(); window.open(`https://wa.me/${phone}?text=${encodeURIComponent(createBudgetMessage(updated))}`, "_blank", "noopener,noreferrer"); }
  async function convertBudgetToReservation(budget) {
    if (budget.flowHistory?.reservationId) { window.alert("Este orçamento já foi transformado em reserva."); return; }
    if (!window.confirm("Deseja transformar este orçamento em reserva? Isso criará cliente/reserva, financeiro e contrato vinculados.")) return;
    if (!budget.clientName || !budget.eventDate || !budget.finalTotal) { window.alert("Preencha nome do cliente, data do evento e valor final antes de transformar em reserva."); return; }
    const clients = getClients(); const client = findOrCreateClient(clients, budget); const reservation = createReservationFromBudget(budget, client); const reservations = getReservations();
    if (hasActiveReservationConflict(reservations, reservation)) { window.alert("Já existe uma reserva ativa para esta data."); return; }
    const contract = await createGeneratedContractFromBudget({ budget, reservation, client });
    saveClients(upsertById(clients, client)); saveReservations([reservation, ...reservations]); syncReservationRevenues(reservation, client); if (contract) saveGeneratedContract(contract);
    const updated = await saveBudget(normalizeBudget({ ...budget, status: "aprovado", flowHistory: { ...budget.flowHistory, approvedAt: budget.flowHistory?.approvedAt || new Date().toISOString(), reservationId: reservation.id, contractId: contract?.id || "" }, notes: `${budget.notes || ""}\nConvertido em reserva ${reservation.id}.${contract?.id ? ` Contrato ${contract.id} gerado automaticamente.` : ""}`.trim() }));
    budgets = upsertById(budgets, updated); render(); window.alert("Orçamento transformado em reserva com sucesso.");
  }
}

function field(name, label, value = "", required = false, type = "text") { return `<label class="budget-field"><span>${escapeHtml(label)}</span><input name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? "required" : ""} ${type === "number" ? "min='0' step='0.01'" : ""}></label>`; }
function selectField(name, label, options, value = "") { return `<label class="budget-field"><span>${escapeHtml(label)}</span><select name="${name}">${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></label>`; }
function textarea(name, label, value = "") { return `<label class="budget-field budget-field--full"><span>${escapeHtml(label)}</span><textarea name="${name}" rows="3">${escapeHtml(value)}</textarea></label>`; }
function input(value, type, onInput) { const element = document.createElement("input"); element.type = type; element.value = value ?? ""; if (type === "number") { element.min = "0"; element.step = "0.01"; } element.addEventListener("input", () => onInput(element.value)); return element; }
function cell(child) { const td = document.createElement("td"); td.append(child); return td; }
function textCell(text, className = "") { const td = document.createElement("td"); td.textContent = text; if (className) td.className = className; return td; }
function removeButton(onClick) { const button = document.createElement("button"); button.type = "button"; button.className = "button button--danger"; button.textContent = "Remover"; button.addEventListener("click", onClick); return button; }
function marginButtons(item, onApply) { const wrapper = document.createElement("div"); wrapper.className = "budget-margin-buttons"; const value = document.createElement("span"); value.className = "budget-margin-buttons__value"; value.textContent = `${Number(item.margin || 0).toFixed(1)}%`; wrapper.append(value); [10, 20, 30, 50].forEach((margin) => { const button = document.createElement("button"); button.type = "button"; button.className = "button button--secondary"; button.textContent = `+${margin}%`; button.addEventListener("click", () => onApply(margin)); wrapper.append(button); }); return wrapper; }
function readBudgetFromForm(current, form, freshUpdate = true) { return normalizeBudget({ ...current, clientName: form.elements.clientName.value.trim(), clientPhone: form.elements.clientPhone.value.trim(), eventDate: form.elements.eventDate.value, eventType: form.elements.eventType.value, peopleCount: form.elements.peopleCount.value, validityDays: Number(form.elements.validityDays.value || 3), notes: form.elements.notes.value.trim(), discountValue: Number(form.elements.discountValue.value || 0), discountPercent: Number(form.elements.discountPercent.value || 0), depositValue: Number(form.elements.depositValue.value || 0), status: parseBudgetStatus(form.elements.status.value), updatedAt: freshUpdate ? new Date().toISOString() : current.updatedAt }); }
function createBudgetAlerts(budget, totals) { const alerts = []; if (budget.items.some((item) => Number(item.profit || 0) < 0)) alerts.push(alert("Este item está abaixo do custo.", "danger")); if (totals.finalTotal > 0 && totals.profitMargin < 20) alerts.push(alert("Margem baixa. Revise o valor antes de enviar.", "warning")); return alerts; }
function alert(message, tone) { const element = document.createElement("div"); element.className = `budget-alert budget-alert--${tone}`; element.textContent = message; return element; }
function createBudgetMessage(budget) { const items = budget.items.filter((item) => item.name).map((item) => `- ${item.name}${item.quantity ? ` (${item.quantity} ${item.unit || "un."})` : ""}`).join("\n"); return `Olá, ${budget.clientName}! Tudo bem?\n\nSegue o orçamento para sua festa no Sítio São Jorge.\n\nData: ${formatDate(budget.eventDate)}\nTipo de evento: ${budget.eventType || "Não informado"}\nQuantidade de pessoas: ${budget.peopleCount || "Não informada"}\n\nItens inclusos:\n${items || "- Itens a definir"}\n\nTotal: ${formatCurrency(budget.finalTotal)}\nEntrada: ${formatCurrency(budget.depositValue)}\nRestante: ${formatCurrency(budget.remainingValue)}\nValidade do orçamento: ${budget.validityDays || 3} dias\n\nFico à disposição para qualquer dúvida.`; }
function openBudgetPdfWindow(budget, { shouldPrint = false } = {}) { const popup = window.open("", "_blank", "noopener,noreferrer"); if (!popup) { window.alert("Não foi possível abrir a visualização do PDF. Verifique o bloqueador de pop-ups."); return; } popup.document.open(); popup.document.write(createBudgetPdfHtml(budget, { shouldPrint })); popup.document.close(); }
function createBudgetPdfHtml(budget, { shouldPrint = false } = {}) { const items = budget.items.filter((item) => item.name).map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.unit || "unidade")}</td><td>${escapeHtml(item.quantity || 0)}</td><td>${formatCurrency(item.subtotalSale)}</td></tr>`).join(""); return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Orçamento - Sítio São Jorge</title><style>*{box-sizing:border-box}body{margin:0;color:#17231c;background:#f8f5ef;font-family:Inter,Arial,sans-serif;line-height:1.5}.page{width:min(900px,calc(100vw - 24px));margin:24px auto;padding:36px;border:1px solid #e3d8c8;border-radius:22px;background:#fff;box-shadow:0 20px 60px rgba(16,37,28,.10)}.header{display:flex;justify-content:space-between;gap:24px;padding-bottom:22px;border-bottom:2px solid #e3d8c8}.logo{display:inline-flex;align-items:center;justify-content:center;width:54px;height:54px;margin-bottom:12px;border:1px solid #b9955b;border-radius:16px;color:#fff;background:#10251c;font-weight:900}h1,h2,p{margin:0}h1{font-size:2rem}.muted{color:#66756b}.status{align-self:flex-start;padding:8px 14px;border-radius:999px;color:#14532d;background:#dcfce7;font-size:.82rem;font-weight:900}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:26px 0}.card{padding:16px;border:1px solid #e3d8c8;border-radius:16px;background:#fbf8f2}.card span{display:block;color:#66756b;font-size:.75rem;font-weight:900;letter-spacing:.05em;text-transform:uppercase}.card strong{display:block;margin-top:6px;font-size:1.05rem}table{width:100%;margin-top:14px;border-collapse:collapse;border:1px solid #e3d8c8;border-radius:16px;overflow:hidden}th,td{padding:12px 14px;border-bottom:1px solid #eee6da;text-align:left}th{color:#526157;background:#f8f5ef;font-size:.75rem;text-transform:uppercase}.totals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:22px}.total-final{color:#fff;background:#2f6b4f;border-color:#2f6b4f}.notes{margin-top:24px;padding:18px;border-left:4px solid #b9955b;border-radius:14px;background:#fbf8f2;white-space:pre-wrap}.footer{margin-top:30px;padding-top:18px;border-top:1px solid #e3d8c8;color:#66756b;font-size:.9rem}.actions{display:flex;justify-content:flex-end;margin:18px auto;width:min(900px,calc(100vw - 24px))}button{border:0;border-radius:12px;background:#2f6b4f;color:#fff;cursor:pointer;font-weight:800;padding:12px 18px}@media print{body{background:#fff}.page{width:100%;margin:0;border:0;box-shadow:none}.actions{display:none}}@media(max-width:640px){.page{padding:22px;border-radius:18px}.header,.grid,.totals{grid-template-columns:1fr;flex-direction:column}h1{font-size:1.55rem}th,td{padding:10px;font-size:.9rem}}</style></head><body><div class="actions"><button onclick="window.print()">Salvar / imprimir PDF</button></div><main class="page"><header class="header"><div><div class="logo">SJ</div><h1>Orçamento - Sítio São Jorge</h1><p class="muted">Proposta comercial para locação e evento</p></div><div class="status">${escapeHtml(formatBudgetStatus(budget.status))}</div></header><section class="grid"><div class="card"><span>Cliente</span><strong>${escapeHtml(budget.clientName || "Não informado")}</strong></div><div class="card"><span>Telefone</span><strong>${escapeHtml(budget.clientPhone || "Não informado")}</strong></div><div class="card"><span>Data do evento</span><strong>${escapeHtml(formatDate(budget.eventDate))}</strong></div><div class="card"><span>Tipo de evento</span><strong>${escapeHtml(budget.eventType || "Não informado")}</strong></div><div class="card"><span>Pessoas</span><strong>${escapeHtml(budget.peopleCount || "Não informado")}</strong></div><div class="card"><span>Validade</span><strong>${escapeHtml(budget.validityDays || 3)} dias</strong></div></section><section><h2>Itens inclusos</h2><table><thead><tr><th>Item</th><th>Unidade</th><th>Qtd.</th><th>Subtotal</th></tr></thead><tbody>${items || `<tr><td colspan="4">Itens a definir</td></tr>`}</tbody></table></section><section class="totals"><div class="card"><span>Total</span><strong>${formatCurrency(budget.finalTotal)}</strong></div><div class="card"><span>Entrada/sinal</span><strong>${formatCurrency(budget.depositValue)}</strong></div><div class="card total-final"><span>Restante</span><strong>${formatCurrency(budget.remainingValue)}</strong></div></section>${budget.notes ? `<section class="notes"><strong>Observações</strong><br>${escapeHtml(budget.notes)}</section>` : ""}<footer class="footer">Orçamento válido por ${escapeHtml(budget.validityDays || 3)} dias. Valores sujeitos à disponibilidade da data.</footer></main>${shouldPrint ? `<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300));</script>` : ""}</body></html>`; }
function findOrCreateClient(clients, budget) { const phone = sanitizePhoneDigits(budget.clientPhone); const existing = clients.find((client) => sanitizePhoneDigits(client.phone) === phone || client.name?.trim().toLowerCase() === budget.clientName.trim().toLowerCase()); return existing || { id: createSafeId("cliente"), name: budget.clientName, phone: budget.clientPhone, document: "", address: "", city: "", notes: `Criado a partir do orçamento ${budget.id}.` }; }
function createReservationFromBudget(budget, client) { return { id: `reserva-${Date.now()}`, clientId: client.id, clientName: client.name, dataEntrada: budget.eventDate, horaEntrada: "09:00", dataSaida: budget.eventDate, horaSaida: "18:00", eventType: budget.eventType || "Outro", totalValue: Number(budget.finalTotal || 0), depositValue: Number(budget.depositValue || 0), remainingValue: Number(budget.remainingValue || 0), paymentMethod: "Pix", paymentStatus: Number(budget.depositValue || 0) > 0 ? "Sinal pago" : "Pendente", reservationStatus: "Pré-reserva", notes: `Criada a partir do orçamento ${budget.id}. ${budget.notes || ""}`.trim() }; }
async function createGeneratedContractFromBudget({ budget, reservation, client }) { try { const templates = await loadContractTemplates(); const template = templates.find((item) => item.status === "padrão") || templates[0]; if (!template?.content) return null; const ownerSignature = getOwnerSignature(); const content = fillTemplate(template.content, buildContractVariables(reservation, client, Boolean(ownerSignature))); return { id: `contrato-${Date.now()}`, token: createContractToken(getContracts()), clientId: client.id, clientName: client.name, reservationId: reservation.id, contractModelId: template.id, templateId: template.id, client: client.name, reservation: `${formatDate(reservation.dataEntrada)} ${reservation.horaEntrada} até ${formatDate(reservation.dataSaida)} ${reservation.horaSaida}`, status: "gerado", generatedAt: new Date().toISOString(), content, contractText: content, ownerSignature, clientPhone: client.phone, source: "orcamento", budgetId: budget.id }; } catch (error) { console.error("Erro ao gerar contrato automático do orçamento:", error); return null; } }
async function loadContractTemplates() { try { const templates = await getContractTemplates(); return Array.isArray(templates) && templates.length ? templates : getStoredContractTemplates(); } catch { return getStoredContractTemplates(); } }
function fillTemplate(content, variables) { return Object.entries(variables).reduce((text, [key, value]) => text.replaceAll(key, value), content || ""); }
function buildContractVariables(reservation, client, hasOwnerSignature) { return { "{{nome_cliente}}": client.name || "Não informado", "{{cpf_cliente}}": getClientDocument(client) || "Não informado", "{{telefone_cliente}}": client.phone || "Não informado", "{{data_entrada}}": formatDate(reservation.dataEntrada), "{{hora_entrada}}": reservation.horaEntrada || "Não informado", "{{data_saida}}": formatDate(reservation.dataSaida), "{{hora_saida}}": reservation.horaSaida || "Não informado", "{{tipo_evento}}": reservation.eventType || "Não informado", "{{valor_total}}": formatPlainMoney(reservation.totalValue), "{{valor_sinal}}": formatPlainMoney(reservation.depositValue), "{{valor_restante}}": formatPlainMoney(reservation.remainingValue), "{{forma_pagamento}}": reservation.paymentMethod || "Pix", "{{status_pagamento}}": reservation.paymentStatus || "Pendente", "{{nome_sitio}}": "Sítio São Jorge", "{{assinatura_proprietario}}": hasOwnerSignature ? "Assinatura do locador anexada" : "Assinatura do locador pendente", "{{assinatura_cliente}}": "Assinatura do locatário pendente", "{{data_assinatura}}": "Data da assinatura pendente" }; }
function getClientDocument(client) { return client?.cpfCnpj || client?.cpf_cnpj || client?.document || client?.cpf || ""; }
function formatPlainMoney(value) { return Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function hasActiveReservationConflict(reservations, nextReservation) { return reservations.some((reservation) => { if (reservation.reservationStatus === "Cancelada") return false; const start = createDateTime(reservation.dataEntrada, reservation.horaEntrada); const end = createDateTime(reservation.dataSaida, reservation.horaSaida); const nextStart = createDateTime(nextReservation.dataEntrada, nextReservation.horaEntrada); const nextEnd = createDateTime(nextReservation.dataSaida, nextReservation.horaSaida); return start && end && nextStart && nextEnd && nextStart < end && nextEnd > start; }); }
function createDateTime(date, time) { if (!date || !time) return null; const value = new Date(`${date}T${time}`); return Number.isNaN(value.getTime()) ? null : value; }
function validateBudget(budget) { if (!budget.clientName) return "Informe o nome do cliente."; if (!budget.eventDate) return "Informe a data do evento."; if (!budget.items.some((item) => item.name && Number(item.quantity) > 0)) return "Adicione pelo menos um item válido ao orçamento."; return ""; }
function calculateSalePriceFromMargin(cost, margin) { return Number(cost || 0) * (1 + Number(margin || 0) / 100); }
function statusBadge(status) { return `<span class="budget-status budget-status--${status}">${formatBudgetStatus(status)}</span>`; }
function flowMeta(budget) { const history = budget.flowHistory || {}; const details = [history.createdAt ? `Criado: ${formatDateTime(history.createdAt)}` : "", history.sentAt ? `Enviado: ${formatDateTime(history.sentAt)}` : "", history.approvedAt ? `Aprovado: ${formatDateTime(history.approvedAt)}` : ""].filter(Boolean); return details.length ? `<small class="budget-flow-meta">${escapeHtml(details.join(" | "))}</small>` : ""; }
function formatBudgetStatus(status) { const labels = { rascunho: "Rascunho", enviado: "Enviado", aguardando_resposta: "Aguardando resposta", aprovado: "Aprovado", recusado: "Recusado", cancelado: "Cancelado", convertido_em_reserva: "Convertido em reserva" }; return labels[status] || status; }
function parseBudgetStatus(label) { return budgetStatuses.find((status) => formatBudgetStatus(status) === label) || "rascunho"; }
function formatDate(value) { if (!value) return "Não informado"; const [year, month, day] = value.split("-"); return year && month && day ? `${day}/${month}/${year}` : value; }
function formatDateTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? formatDate(value) : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
function sanitizePhone(value) { const digits = sanitizePhoneDigits(value); return digits ? (digits.startsWith("55") ? digits : `55${digits}`) : ""; }
function sanitizePhoneDigits(value) { return String(value || "").replace(/\D/g, ""); }
function upsertById(items, nextItem) { return items.some((item) => item.id === nextItem.id) ? items.map((item) => item.id === nextItem.id ? nextItem : item) : [nextItem, ...items]; }
function average(items, key) { return items.length ? items.reduce((sum, item) => sum + Number(item[key] || 0), 0) / items.length : 0; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char])); }
function createSafeId(prefix) { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
