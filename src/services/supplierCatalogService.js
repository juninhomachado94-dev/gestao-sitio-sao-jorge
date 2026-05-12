const SUPPLIER_CATALOG_STORAGE_KEY = "sitio-sao-jorge-supplier-catalog";
let supplierCatalogWarning = "";

export const supplierCategories = [
  "Bolo",
  "Docinhos",
  "Salgados",
  "Decoração",
  "Refrigerante",
  "Cerveja",
  "Chopp",
  "Fotografia",
  "DJ",
  "Garçom",
  "Monitor infantil",
  "Toalhas",
  "Outros",
];

export const supplierUnits = [
  "unidade",
  "cento",
  "kg",
  "litro",
  "diária",
  "hora",
  "pacote",
  "serviço",
];

export function getSupplierCatalog() {
  const catalog = readSupplierCatalog();
  syncSupplierCatalogFromSupabase();
  return catalog;
}

export function getSupplierCatalogWarning() {
  return supplierCatalogWarning;
}

export async function loadSupplierCatalog() {
  await syncSupplierCatalogFromSupabase(true);
  return readSupplierCatalog();
}

export async function saveSupplierCatalogItem(item) {
  const normalizedItem = normalizeSupplierCatalogItem(item);
  const catalog = readSupplierCatalog();
  const exists = catalog.some((catalogItem) => catalogItem.id === normalizedItem.id);
  const nextCatalog = exists
    ? catalog.map((catalogItem) => (catalogItem.id === normalizedItem.id ? normalizedItem : catalogItem))
    : [normalizedItem, ...catalog];

  writeSupplierCatalog(nextCatalog);
  await upsertSupplierCatalogItemToSupabase(normalizedItem);
  return normalizedItem;
}

export async function deleteSupplierCatalogItem(itemId) {
  if (!itemId) {
    return;
  }

  writeSupplierCatalog(readSupplierCatalog().filter((item) => item.id !== itemId));
  await deleteSupplierCatalogItemFromSupabase(itemId);
}

export function createEmptySupplierCatalogItem() {
  return normalizeSupplierCatalogItem({
    id: createSafeId("fornecedor"),
    supplierName: "",
    category: "Outros",
    productName: "",
    variation: "",
    unit: "unidade",
    costPrice: 0,
    suggestedSalePrice: 0,
    notes: "",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function normalizeSupplierCatalogItem(item = {}) {
  return {
    id: item.id || createSafeId("fornecedor"),
    supplierName: item.supplierName ?? item.supplier_name ?? "",
    category: item.category ?? "Outros",
    productName: item.productName ?? item.product_name ?? "",
    variation: item.variation ?? "",
    unit: item.unit ?? "unidade",
    costPrice: Number(item.costPrice ?? item.cost_price ?? 0),
    suggestedSalePrice: Number(item.suggestedSalePrice ?? item.suggested_sale_price ?? 0),
    notes: item.notes ?? "",
    isActive: Boolean(item.isActive ?? item.is_active ?? true),
    createdAt: item.createdAt ?? item.created_at ?? new Date().toISOString(),
    updatedAt: item.updatedAt ?? item.updated_at ?? new Date().toISOString(),
  };
}

function readSupplierCatalog() {
  try {
    const stored = window.localStorage.getItem(SUPPLIER_CATALOG_STORAGE_KEY);
    const catalog = stored ? JSON.parse(stored) : [];
    return Array.isArray(catalog) ? catalog.map(normalizeSupplierCatalogItem) : [];
  } catch (error) {
    console.error("Erro ao ler catálogo de fornecedores local:", error);
    return [];
  }
}

function writeSupplierCatalog(catalog) {
  window.localStorage.setItem(SUPPLIER_CATALOG_STORAGE_KEY, JSON.stringify(
    Array.isArray(catalog) ? catalog.map(normalizeSupplierCatalogItem) : [],
  ));
}

async function syncSupplierCatalogFromSupabase(forceReplace = false) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("supplier_catalog")
      .select("id,supplier_name,category,product_name,variation,unit,cost_price,suggested_sale_price,notes,is_active,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar catálogo de fornecedores no Supabase:", error);
      supplierCatalogWarning = createSupplierCatalogWarning(error);
      return;
    }

    supplierCatalogWarning = "";

    if (!Array.isArray(data)) {
      return;
    }

    const catalog = data.map(mapSupplierCatalogItemFromSupabase).map(normalizeSupplierCatalogItem);

    if (forceReplace || catalog.length || !readSupplierCatalog().length) {
      writeSupplierCatalog(catalog);
    }
  } catch (error) {
    console.error("Erro ao conectar com Supabase para buscar catálogo de fornecedores:", error);
    supplierCatalogWarning = "Não foi possível conectar ao banco online de fornecedores.";
  }
}

async function upsertSupplierCatalogItemToSupabase(item) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("supplier_catalog")
      .upsert(mapSupplierCatalogItemToSupabase(item), { onConflict: "id" })
      .select("id")
      .maybeSingle();

    console.log("Item de fornecedor salvo no Supabase:", data);

    if (error) {
      console.error("Erro ao salvar item de fornecedor no Supabase:", error);
      supplierCatalogWarning = createSupplierCatalogWarning(error);
      window.alert(`${supplierCatalogWarning} O item continuará salvo neste navegador.`);
    }
  } catch (error) {
    console.error("Erro ao conectar com Supabase para salvar fornecedor/produto:", error);
    supplierCatalogWarning = "Não foi possível conectar ao banco online de fornecedores.";
  }
}

async function deleteSupplierCatalogItemFromSupabase(itemId) {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("supplier_catalog")
      .delete()
      .eq("id", itemId)
      .select("id");

    console.log("Item de fornecedor removido do Supabase:", data);

    if (error) {
      console.error("Erro ao excluir item de fornecedor no Supabase:", error);
      supplierCatalogWarning = createSupplierCatalogWarning(error);
    }
  } catch (error) {
    console.error("Erro ao conectar com Supabase para excluir fornecedor/produto:", error);
    supplierCatalogWarning = "Não foi possível conectar ao banco online de fornecedores.";
  }
}

async function getSupabaseClient() {
  const { supabase } = await import("./supabaseClient.js");
  return supabase;
}

function mapSupplierCatalogItemToSupabase(item) {
  const normalizedItem = normalizeSupplierCatalogItem(item);
  return {
    id: normalizedItem.id,
    supplier_name: normalizedItem.supplierName,
    category: normalizedItem.category,
    product_name: normalizedItem.productName,
    variation: normalizedItem.variation,
    unit: normalizedItem.unit,
    cost_price: normalizedItem.costPrice,
    suggested_sale_price: normalizedItem.suggestedSalePrice,
    notes: normalizedItem.notes,
    is_active: normalizedItem.isActive,
    updated_at: normalizedItem.updatedAt,
  };
}

function mapSupplierCatalogItemFromSupabase(item) {
  return {
    id: item.id,
    supplierName: item.supplier_name ?? "",
    category: item.category ?? "Outros",
    productName: item.product_name ?? "",
    variation: item.variation ?? "",
    unit: item.unit ?? "unidade",
    costPrice: Number(item.cost_price ?? 0),
    suggestedSalePrice: Number(item.suggested_sale_price ?? 0),
    notes: item.notes ?? "",
    isActive: Boolean(item.is_active ?? true),
    createdAt: item.created_at ?? "",
    updatedAt: item.updated_at ?? "",
  };
}

function createSupplierCatalogWarning(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");

  if (code === "42P01" || message.toLowerCase().includes("supplier_catalog")) {
    return "Tabela de fornecedores ainda não configurada no Supabase.";
  }

  return "Não foi possível carregar o catálogo de fornecedores no Supabase.";
}

function createSafeId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
