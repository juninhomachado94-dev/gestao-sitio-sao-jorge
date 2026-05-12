const BUDGETS_STORAGE_KEY = "sitio-sao-jorge-budgets";

export const budgetStatuses = [
  "rascunho",
  "enviado",
  "aprovado",
  "recusado",
  "convertido_em_reserva",
];

export const budgetItemSuggestions = [
  "Salão/Sítio",
  "Bolo",
  "Docinhos",
  "Salgados fritos",
  "Salgados assados",
  "Decoração",
  "Arco de balão",
  "Garçom",
  "Monitor infantil",
  "Refrigerante",
  "Água",
  "Toalhas",
  "DJ",
  "Fotos/vídeos",
  "Outros",
];

export const budgetTemplates = [
  {
    id: "basico",
    name: "Combo Básico",
    items: [
      createBudgetItem({ name: "Salão/Sítio", quantity: 1, unitPrice: 800, unitCost: 250 }),
      createBudgetItem({ name: "Toalhas", quantity: 10, unitPrice: 8, unitCost: 4 }),
      createBudgetItem({ name: "Água", quantity: 2, unitPrice: 35, unitCost: 22 }),
    ],
  },
  {
    id: "completo",
    name: "Combo Completo",
    items: [
      createBudgetItem({ name: "Salão/Sítio", quantity: 1, unitPrice: 1100, unitCost: 300 }),
      createBudgetItem({ name: "Bolo", quantity: 1, unitPrice: 280, unitCost: 170 }),
      createBudgetItem({ name: "Docinhos", quantity: 100, unitPrice: 1.4, unitCost: 0.75 }),
      createBudgetItem({ name: "Salgados fritos", quantity: 100, unitPrice: 1.6, unitCost: 0.9 }),
      createBudgetItem({ name: "Decoração", quantity: 1, unitPrice: 350, unitCost: 210 }),
    ],
  },
  {
    id: "premium",
    name: "Combo Premium",
    items: [
      createBudgetItem({ name: "Salão/Sítio", quantity: 1, unitPrice: 1500, unitCost: 420 }),
      createBudgetItem({ name: "Bolo", quantity: 1, unitPrice: 380, unitCost: 230 }),
      createBudgetItem({ name: "Docinhos", quantity: 150, unitPrice: 1.6, unitCost: 0.85 }),
      createBudgetItem({ name: "Salgados assados", quantity: 150, unitPrice: 1.9, unitCost: 1.1 }),
      createBudgetItem({ name: "Decoração", quantity: 1, unitPrice: 600, unitCost: 360 }),
      createBudgetItem({ name: "Arco de balão", quantity: 1, unitPrice: 280, unitCost: 150 }),
      createBudgetItem({ name: "Garçom", quantity: 2, unitPrice: 180, unitCost: 130 }),
      createBudgetItem({ name: "Fotos/vídeos", quantity: 1, unitPrice: 550, unitCost: 350 }),
    ],
  },
  {
    id: "personalizado",
    name: "Combo Personalizado",
    items: [createBudgetItem({ name: "Salão/Sítio", quantity: 1, unitPrice: 0, unitCost: 0 })],
  },
];

export function getBudgets() {
  const localBudgets = readBudgets();
  syncBudgetsFromSupabase();
  return localBudgets;
}

export async function loadBudgets() {
  await syncBudgetsFromSupabase(true);
  return readBudgets();
}

export async function saveBudget(budget) {
  const normalizedBudget = normalizeBudget(budget);
  const budgets = readBudgets();
  const exists = budgets.some((item) => item.id === normalizedBudget.id);
  const nextBudgets = exists
    ? budgets.map((item) => (item.id === normalizedBudget.id ? normalizedBudget : item))
    : [normalizedBudget, ...budgets];

  writeBudgets(nextBudgets);
  await upsertBudgetToSupabase(normalizedBudget);

  return normalizedBudget;
}

export async function deleteBudget(budgetId) {
  if (!budgetId) {
    return;
  }

  writeBudgets(readBudgets().filter((budget) => budget.id !== budgetId));
  await deleteBudgetFromSupabase(budgetId);
}

export function createBudgetItem({
  name = "",
  category = "",
  unit = "unidade",
  supplierName = "",
  catalogItemId = "",
  quantity = 1,
  unitPrice = 0,
  unitCost = 0,
} = {}) {
  return normalizeBudgetItem({
    id: createSafeId("orcamento-item"),
    name,
    category,
    unit,
    supplierName,
    catalogItemId,
    quantity,
    unitPrice,
    unitCost,
  });
}

export function createEmptyBudget() {
  return normalizeBudget({
    id: `orcamento-${Date.now()}`,
    clientName: "",
    clientPhone: "",
    eventDate: "",
    eventType: "",
    peopleCount: "",
    items: [createBudgetItem({ name: "Salão/Sítio" })],
    discountValue: 0,
    discountPercent: 0,
    depositValue: 0,
    status: "rascunho",
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function normalizeBudget(budget = {}) {
  const items = Array.isArray(budget.items) ? budget.items.map(normalizeBudgetItem) : [];
  const totals = calculateBudgetTotals({
    items,
    discountValue: budget.discountValue ?? budget.discount_value,
    discountPercent: budget.discountPercent ?? budget.discount_percent,
    depositValue: budget.depositValue ?? budget.deposit_value,
  });

  return {
    id: budget.id || `orcamento-${Date.now()}`,
    clientName: budget.clientName ?? budget.client_name ?? "",
    clientPhone: budget.clientPhone ?? budget.client_phone ?? "",
    eventDate: budget.eventDate ?? budget.event_date ?? "",
    eventType: budget.eventType ?? budget.event_type ?? "",
    peopleCount: Number(budget.peopleCount ?? budget.people_count ?? 0),
    items,
    totalSale: totals.totalSale,
    totalCost: totals.totalCost,
    grossProfit: totals.grossProfit,
    profitMargin: totals.profitMargin,
    discountValue: totals.discountValue,
    discountPercent: totals.discountPercent,
    finalTotal: totals.finalTotal,
    depositValue: totals.depositValue,
    remainingValue: totals.remainingValue,
    status: budgetStatuses.includes(budget.status) ? budget.status : "rascunho",
    notes: budget.notes ?? "",
    createdAt: budget.createdAt ?? budget.created_at ?? new Date().toISOString(),
    updatedAt: budget.updatedAt ?? budget.updated_at ?? new Date().toISOString(),
  };
}

export function normalizeBudgetItem(item = {}) {
  const quantity = Number(item.quantity ?? 0);
  const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
  const unitCost = Number(item.unitCost ?? item.unit_cost ?? 0);
  const subtotalSale = quantity * unitPrice;
  const subtotalCost = quantity * unitCost;

  return {
    id: item.id || createSafeId("orcamento-item"),
    name: item.name ?? item.item ?? "",
    category: item.category ?? "",
    unit: item.unit ?? "unidade",
    supplierName: item.supplierName ?? item.supplier_name ?? "",
    catalogItemId: item.catalogItemId ?? item.catalog_item_id ?? "",
    quantity,
    unitPrice,
    unitCost,
    subtotalSale,
    subtotalCost,
    profit: subtotalSale - subtotalCost,
    margin: subtotalSale > 0 ? ((subtotalSale - subtotalCost) / subtotalSale) * 100 : 0,
  };
}

export function calculateBudgetTotals({ items = [], discountValue = 0, discountPercent = 0, depositValue = 0 } = {}) {
  const normalizedItems = Array.isArray(items) ? items.map(normalizeBudgetItem) : [];
  const totalSale = normalizedItems.reduce((sum, item) => sum + item.subtotalSale, 0);
  const totalCost = normalizedItems.reduce((sum, item) => sum + item.subtotalCost, 0);
  const numericDiscountPercent = clamp(Number(discountPercent || 0), 0, 100);
  const percentDiscountValue = totalSale * (numericDiscountPercent / 100);
  const manualDiscountValue = Number(discountValue || 0);
  const effectiveDiscountValue = manualDiscountValue > 0 ? manualDiscountValue : percentDiscountValue;
  const finalTotal = Math.max(totalSale - effectiveDiscountValue, 0);
  const numericDepositValue = Math.min(Number(depositValue || 0), finalTotal);
  const grossProfit = finalTotal - totalCost;

  return {
    totalSale,
    totalCost,
    grossProfit,
    profitMargin: finalTotal > 0 ? (grossProfit / finalTotal) * 100 : 0,
    discountValue: effectiveDiscountValue,
    discountPercent: totalSale > 0 ? (effectiveDiscountValue / totalSale) * 100 : 0,
    finalTotal,
    depositValue: numericDepositValue,
    remainingValue: Math.max(finalTotal - numericDepositValue, 0),
  };
}

function readBudgets() {
  try {
    const stored = window.localStorage.getItem(BUDGETS_STORAGE_KEY);
    const budgets = stored ? JSON.parse(stored) : [];
    return Array.isArray(budgets) ? budgets.map(normalizeBudget) : [];
  } catch (error) {
    console.error("Erro ao ler orçamentos locais:", error);
    return [];
  }
}

function writeBudgets(budgets) {
  window.localStorage.setItem(BUDGETS_STORAGE_KEY, JSON.stringify(
    Array.isArray(budgets) ? budgets.map(normalizeBudget) : [],
  ));
}

async function syncBudgetsFromSupabase(forceReplace = false) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("budgets")
      .select("id,client_name,client_phone,event_date,event_type,people_count,items,total_sale,total_cost,gross_profit,profit_margin,discount_value,discount_percent,final_total,deposit_value,remaining_value,status,notes,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar orçamentos no Supabase:", error);
      return;
    }

    if (!Array.isArray(data)) {
      return;
    }

    const budgets = data.map(mapBudgetFromSupabase).map(normalizeBudget);

    if (forceReplace || budgets.length || !readBudgets().length) {
      writeBudgets(budgets);
    }
  } catch (error) {
    console.error("Erro ao conectar com Supabase para buscar orçamentos:", error);
  }
}

async function upsertBudgetToSupabase(budget) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("budgets")
      .upsert(mapBudgetToSupabase(budget), { onConflict: "id" })
      .select("id")
      .maybeSingle();

    console.log("Orçamento salvo no Supabase:", data);

    if (error) {
      console.error("Erro ao salvar orçamento no Supabase:", error);
      window.alert("Erro ao salvar orçamento no banco online. Ele continuará salvo neste navegador.");
    }
  } catch (error) {
    console.error("Erro ao conectar com Supabase para salvar orçamento:", error);
  }
}

async function deleteBudgetFromSupabase(budgetId) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("budgets")
      .delete()
      .eq("id", budgetId)
      .select("id");

    console.log("Orçamento removido do Supabase:", data);

    if (error) {
      console.error("Erro ao excluir orçamento no Supabase:", error);
    }
  } catch (error) {
    console.error("Erro ao conectar com Supabase para excluir orçamento:", error);
  }
}

async function getSupabaseClient() {
  const { supabase } = await import("./supabaseClient.js");
  return supabase;
}

function mapBudgetToSupabase(budget) {
  const normalizedBudget = normalizeBudget(budget);
  return {
    id: normalizedBudget.id,
    client_name: normalizedBudget.clientName,
    client_phone: normalizedBudget.clientPhone,
    event_date: normalizedBudget.eventDate || null,
    event_type: normalizedBudget.eventType,
    people_count: normalizedBudget.peopleCount,
    items: normalizedBudget.items,
    total_sale: normalizedBudget.totalSale,
    total_cost: normalizedBudget.totalCost,
    gross_profit: normalizedBudget.grossProfit,
    profit_margin: normalizedBudget.profitMargin,
    discount_value: normalizedBudget.discountValue,
    discount_percent: normalizedBudget.discountPercent,
    final_total: normalizedBudget.finalTotal,
    deposit_value: normalizedBudget.depositValue,
    remaining_value: normalizedBudget.remainingValue,
    status: normalizedBudget.status,
    notes: normalizedBudget.notes,
    updated_at: normalizedBudget.updatedAt,
  };
}

function mapBudgetFromSupabase(budget) {
  return {
    id: budget.id,
    clientName: budget.client_name ?? "",
    clientPhone: budget.client_phone ?? "",
    eventDate: budget.event_date ?? "",
    eventType: budget.event_type ?? "",
    peopleCount: Number(budget.people_count ?? 0),
    items: Array.isArray(budget.items) ? budget.items : [],
    totalSale: Number(budget.total_sale ?? 0),
    totalCost: Number(budget.total_cost ?? 0),
    grossProfit: Number(budget.gross_profit ?? 0),
    profitMargin: Number(budget.profit_margin ?? 0),
    discountValue: Number(budget.discount_value ?? 0),
    discountPercent: Number(budget.discount_percent ?? 0),
    finalTotal: Number(budget.final_total ?? 0),
    depositValue: Number(budget.deposit_value ?? 0),
    remainingValue: Number(budget.remaining_value ?? 0),
    status: budget.status ?? "rascunho",
    notes: budget.notes ?? "",
    createdAt: budget.created_at ?? "",
    updatedAt: budget.updated_at ?? "",
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value || 0), min), max);
}

function createSafeId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
