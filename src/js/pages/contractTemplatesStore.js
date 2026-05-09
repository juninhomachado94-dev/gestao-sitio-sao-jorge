import { supabase } from "../../services/supabaseClient.js";
import { contractTemplates } from "./contractTemplates.js";

const CONTRACT_TEMPLATES_STORAGE_KEY = "sitio-sao-jorge-contract-templates";
let templatesChannel = null;
const templatesSubscribers = new Set();

export function getStoredContractTemplates() {
  const storedTemplates = readStoredTemplates();

  if (storedTemplates.length) {
    return storedTemplates;
  }

  // O modelo padrão só deve ser criado quando não houver nenhum modelo salvo.
  return getDefaultContractTemplates();
}

export async function getContractTemplates() {
  try {
    const { data, error } = await supabase
      .from("contract_templates")
      .select("id,name,content,is_default,created_at,updated_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao carregar modelos de contrato no Supabase:", error);
      return getStoredContractTemplates();
    }

    if (Array.isArray(data) && data.length) {
      const templates = normalizeTemplates(data.map(mapTemplateFromSupabase));
      saveStoredContractTemplates(templates);
      return templates;
    }

    const localTemplates = readStoredTemplates();

    if (localTemplates.length) {
      await saveContractTemplatesBackup(localTemplates);
      return localTemplates;
    }

    const initialTemplates = getDefaultContractTemplates();
    await saveContractTemplatesBackup(initialTemplates);
    return initialTemplates;
  } catch (error) {
    console.error("Erro ao conectar com Supabase para modelos de contrato:", error);
    return getStoredContractTemplates();
  }
}

export async function saveContractTemplate(template) {
  const normalizedTemplate = normalizeTemplate(template);

  saveStoredContractTemplates(upsertLocalTemplate(normalizedTemplate));

  try {
    const { error } = await supabase
      .from("contract_templates")
      .upsert(mapTemplateToSupabase(normalizedTemplate), { onConflict: "id" });

    if (error) {
      console.error("Erro ao salvar modelo de contrato no Supabase:", error);
      return { ok: false, error };
    }

    return { ok: true, error: null };
  } catch (error) {
    console.error("Erro ao conectar com Supabase para salvar modelo de contrato:", error);
    return { ok: false, error };
  }
}

export async function deleteContractTemplate(templateId) {
  const nextTemplates = readStoredTemplates().filter((template) => template.id !== templateId);
  saveStoredContractTemplates(nextTemplates);

  try {
    const { error } = await supabase
      .from("contract_templates")
      .delete()
      .eq("id", templateId);

    if (error) {
      console.error("Erro ao excluir modelo de contrato no Supabase:", error);
      return { ok: false, error };
    }

    return { ok: true, error: null };
  } catch (error) {
    console.error("Erro ao conectar com Supabase para excluir modelo de contrato:", error);
    return { ok: false, error };
  }
}

export async function setDefaultContractTemplate(templateId, templates) {
  const nextTemplates = normalizeTemplates(templates).map((template) => ({
    ...template,
    status: template.id === templateId ? "padrão" : "inativo",
    updatedAt: template.id === templateId ? getTodayKey() : template.updatedAt,
  }));

  saveStoredContractTemplates(nextTemplates);

  try {
    const { error } = await supabase
      .from("contract_templates")
      .upsert(nextTemplates.map(mapTemplateToSupabase), { onConflict: "id" });

    if (error) {
      console.error("Erro ao definir modelo padrão no Supabase:", error);
      return { ok: false, error, templates: nextTemplates };
    }

    return { ok: true, error: null, templates: nextTemplates };
  } catch (error) {
    console.error("Erro ao conectar com Supabase para definir modelo padrão:", error);
    return { ok: false, error, templates: nextTemplates };
  }
}

export async function saveContractTemplatesBackup(templates) {
  const normalizedTemplates = normalizeTemplates(templates);
  saveStoredContractTemplates(normalizedTemplates);

  if (!normalizedTemplates.length) {
    return { ok: true, error: null };
  }

  try {
    const { error } = await supabase
      .from("contract_templates")
      .upsert(normalizedTemplates.map(mapTemplateToSupabase), { onConflict: "id" });

    if (error) {
      console.error("Erro ao restaurar modelos de contrato no Supabase:", error);
      return { ok: false, error };
    }

    return { ok: true, error: null };
  } catch (error) {
    console.error("Erro ao conectar com Supabase para restaurar modelos de contrato:", error);
    return { ok: false, error };
  }
}

export function saveStoredContractTemplates(templates) {
  window.localStorage.setItem(CONTRACT_TEMPLATES_STORAGE_KEY, JSON.stringify(normalizeTemplates(templates)));
}

export function subscribeToContractTemplates(onChange) {
  templatesSubscribers.add(onChange);

  if (templatesChannel) {
    return templatesChannel;
  }

  templatesChannel = supabase
    .channel("contract-templates-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "contract_templates" }, async () => {
      const templates = await getContractTemplates();
      templatesSubscribers.forEach((callback) => callback(templates));
    })
    .subscribe((status) => {
      console.log("Status Realtime modelos de contrato:", status);
    });

  return templatesChannel;
}

function upsertLocalTemplate(template) {
  const templates = readStoredTemplates();
  const baseTemplates = templates.length ? templates : getDefaultContractTemplates();
  const exists = baseTemplates.some((item) => item.id === template.id);

  return exists
    ? baseTemplates.map((item) => (item.id === template.id ? template : item))
    : [template, ...baseTemplates];
}

function getDefaultContractTemplates() {
  return normalizeTemplates(contractTemplates.templates.map((template) => ({ ...template })));
}

function readStoredTemplates() {
  try {
    const stored = window.localStorage.getItem(CONTRACT_TEMPLATES_STORAGE_KEY);
    const templates = stored ? JSON.parse(stored) : [];

    return Array.isArray(templates) ? normalizeTemplates(templates) : [];
  } catch {
    return [];
  }
}

function normalizeTemplates(templates) {
  const normalizedTemplates = Array.isArray(templates)
    ? templates
        .filter((template) => template?.id && template?.name && template?.content)
        .map(normalizeTemplate)
    : [];

  if (!normalizedTemplates.some((template) => template.status === "padrão") && normalizedTemplates[0]) {
    normalizedTemplates[0].status = "padrão";
  }

  return normalizedTemplates;
}

function normalizeTemplate(template) {
  return {
    id: template.id,
    name: template.name,
    content: template.content,
    status: template.status === "padrão" || template.isDefault || template.is_default ? "padrão" : "inativo",
    updatedAt: template.updatedAt || template.updated_at || template.createdAt || template.created_at || getTodayKey(),
    createdAt: template.createdAt || template.created_at || "",
  };
}

function mapTemplateFromSupabase(template) {
  return normalizeTemplate({
    id: template.id,
    name: template.name,
    content: template.content,
    isDefault: template.is_default,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  });
}

function mapTemplateToSupabase(template) {
  const normalizedTemplate = normalizeTemplate(template);

  return {
    id: normalizedTemplate.id,
    name: normalizedTemplate.name,
    content: normalizedTemplate.content,
    is_default: normalizedTemplate.status === "padrão",
    updated_at: new Date().toISOString(),
  };
}

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
