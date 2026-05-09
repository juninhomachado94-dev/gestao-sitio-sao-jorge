import { supabase } from "./supabaseClient.js";

const CHECKLIST_STORAGE_KEY = "sitio-sao-jorge-checkout-checklists";
const OCCURRENCES_STORAGE_KEY = "sitio-sao-jorge-checkout-occurrences";
const CHECKOUT_PHOTOS_BUCKET = "checkout-photos";
const MAX_CHECKOUT_PHOTO_SIZE = 8 * 1024 * 1024;

export const checkoutItems = [
  { key: "trashCollected", label: "Lixo recolhido" },
  { key: "trashDisposed", label: "Lixo descartado na caçamba azul" },
  { key: "lightsOff", label: "Luzes desligadas" },
  { key: "keysReturned", label: "Chaves devolvidas" },
  { key: "grillClean", label: "Churrasqueira limpa" },
  { key: "bathroomsOk", label: "Banheiros em ordem" },
  { key: "poolOk", label: "Piscina em ordem" },
  { key: "gateClosed", label: "Portão fechado" },
  { key: "noVisibleDamage", label: "Sem danos aparentes" },
];

export const occurrenceTypes = [
  "dano",
  "sujeira excessiva",
  "atraso na saída",
  "som alto",
  "objeto quebrado",
  "multa",
  "outros",
];

export function getCheckoutChecklists() {
  syncChecklistsFromSupabase();
  return readList(CHECKLIST_STORAGE_KEY).map(normalizeChecklist);
}

export function getCheckoutOccurrences() {
  syncOccurrencesFromSupabase();
  return readList(OCCURRENCES_STORAGE_KEY).map(normalizeOccurrence);
}

export async function saveCheckoutChecklist(checklist) {
  const normalized = normalizeChecklist(checklist);
  writeList(CHECKLIST_STORAGE_KEY, upsertById(readList(CHECKLIST_STORAGE_KEY), normalized));

  try {
    const { error } = await supabase
      .from("checkout_checklists")
      .upsert(mapChecklistToSupabase(normalized), { onConflict: "id" });

    if (error) {
      console.error("Erro ao salvar checklist de saída no Supabase:", error);
      return { ok: false, error, checklist: normalized };
    }

    return { ok: true, error: null, checklist: normalized };
  } catch (error) {
    console.error("Erro ao conectar com Supabase para checklist de saída:", error);
    return { ok: false, error, checklist: normalized };
  }
}

export async function saveCheckoutOccurrence(occurrence) {
  const normalized = normalizeOccurrence(occurrence);
  writeList(OCCURRENCES_STORAGE_KEY, upsertById(readList(OCCURRENCES_STORAGE_KEY), normalized));

  try {
    const { error } = await supabase
      .from("checkout_occurrences")
      .upsert(mapOccurrenceToSupabase(normalized), { onConflict: "id" });

    if (error) {
      console.error("Erro ao salvar ocorrência de checkout no Supabase:", error);
      return { ok: false, error, occurrence: normalized };
    }

    return { ok: true, error: null, occurrence: normalized };
  } catch (error) {
    console.error("Erro ao conectar com Supabase para ocorrência de checkout:", error);
    return { ok: false, error, occurrence: normalized };
  }
}

export async function uploadCheckoutPhoto({ reservationId, occurrenceId, file }) {
  if (!file?.type?.startsWith("image/")) {
    return { ok: false, error: new Error("Arquivo inválido. Envie apenas imagens.") };
  }

  if (file.size > MAX_CHECKOUT_PHOTO_SIZE) {
    return { ok: false, error: new Error("A imagem é muito grande. Envie uma foto de até 8 MB.") };
  }

  const safeReservationId = sanitizePathSegment(reservationId || "reserva");
  const safeOccurrenceId = sanitizePathSegment(occurrenceId || "ocorrencia");
  const fileName = sanitizePathSegment(file.name || "foto.jpg");
  const path = `${safeReservationId}/${safeOccurrenceId}/${new Date().toISOString().replace(/[:.]/g, "-")}-${fileName}`;

  try {
    const { error } = await supabase.storage
      .from(CHECKOUT_PHOTOS_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Erro ao enviar foto da vistoria:", error);
      return { ok: false, error };
    }

    const { data } = supabase.storage
      .from(CHECKOUT_PHOTOS_BUCKET)
      .getPublicUrl(path);

    return {
      ok: true,
      error: null,
      photo: {
        url: data.publicUrl,
        path,
        name: file.name,
      },
    };
  } catch (error) {
    console.error("Erro ao conectar com Supabase Storage para foto da vistoria:", error);
    return { ok: false, error };
  }
}

export async function removeCheckoutPhoto(path) {
  if (!path) {
    return { ok: true, error: null };
  }

  try {
    const { error } = await supabase.storage
      .from(CHECKOUT_PHOTOS_BUCKET)
      .remove([path]);

    if (error) {
      console.error("Erro ao remover foto da vistoria:", error);
      return { ok: false, error };
    }

    return { ok: true, error: null };
  } catch (error) {
    console.error("Erro ao conectar com Supabase Storage para remover foto:", error);
    return { ok: false, error };
  }
}

export function getChecklistStatus(checklist) {
  if (!checklist) {
    return "pendente";
  }

  if (checklist.status === "concluído") {
    return "concluído";
  }

  const checkedCount = countCheckedItems(checklist.items);

  return checkedCount > 0 ? "em andamento" : "pendente";
}

export function buildReservationCheckoutSummary(reservation, checklists, occurrences) {
  const checklist = checklists.find((item) => item.reservationId === reservation.id);
  const reservationOccurrences = occurrences.filter((item) => item.reservationId === reservation.id);
  const totalDamage = reservationOccurrences.reduce((sum, occurrence) => sum + Number(occurrence.damageValue || 0), 0);

  return {
    checklist,
    status: getChecklistStatus(checklist),
    occurrencesCount: reservationOccurrences.length,
    totalDamage,
    inspectionStatus: checklist?.status === "concluído" && !reservationOccurrences.length
      ? "Vistoria sem ocorrências"
      : reservationOccurrences.length
        ? "Vistoria com ocorrência"
        : "Vistoria pendente",
  };
}

export function buildCheckoutStrategicIndicators({ occurrences, selectedMonth }) {
  const monthOccurrences = occurrences.filter((occurrence) => isDateInMonth(occurrence.occurrenceDate, selectedMonth));
  const damageTotal = monthOccurrences.reduce((sum, occurrence) => sum + Number(occurrence.damageValue || 0), 0);
  const clients = countBy(monthOccurrences, "clientId");
  const types = countBy(monthOccurrences, "type");
  const delays = monthOccurrences.filter((occurrence) => occurrence.type === "atraso na saída").length;

  return {
    monthOccurrences,
    damageTotal,
    recurrentDelays: delays,
    topClients: Array.from(clients.entries()).sort((a, b) => b[1] - a[1]),
    commonTypes: Array.from(types.entries()).sort((a, b) => b[1] - a[1]),
  };
}

async function syncChecklistsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from("checkout_checklists")
      .select("id,reservation_id,client_id,items,status,finalized_at,responsible_user,created_at,updated_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao carregar checklists de saída no Supabase:", error);
      return;
    }

    writeList(CHECKLIST_STORAGE_KEY, Array.isArray(data) ? data.map(mapChecklistFromSupabase) : []);
  } catch (error) {
    console.error("Erro ao conectar com Supabase para carregar checklists:", error);
  }
}

async function syncOccurrencesFromSupabase() {
  try {
    const { data, error } = await supabase
      .from("checkout_occurrences")
      .select("id,reservation_id,client_id,type,title,description,damage_value,photo_urls,occurrence_date,responsible_user,created_at,updated_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao carregar ocorrências de checkout no Supabase:", error);
      return;
    }

    writeList(OCCURRENCES_STORAGE_KEY, Array.isArray(data) ? data.map(mapOccurrenceFromSupabase) : []);
  } catch (error) {
    console.error("Erro ao conectar com Supabase para carregar ocorrências:", error);
  }
}

function normalizeChecklist(checklist = {}) {
  return {
    id: checklist.id || `checkout-${Date.now()}`,
    reservationId: checklist.reservationId || checklist.reservation_id || "",
    clientId: checklist.clientId || checklist.client_id || "",
    items: normalizeChecklistItems(checklist.items),
    status: checklist.status || "pendente",
    finalizedAt: checklist.finalizedAt || checklist.finalized_at || "",
    responsibleUser: checklist.responsibleUser || checklist.responsible_user || "",
    createdAt: checklist.createdAt || checklist.created_at || "",
    updatedAt: checklist.updatedAt || checklist.updated_at || "",
  };
}

function normalizeOccurrence(occurrence = {}) {
  return {
    id: occurrence.id || `ocorrencia-${Date.now()}`,
    reservationId: occurrence.reservationId || occurrence.reservation_id || "",
    clientId: occurrence.clientId || occurrence.client_id || "",
    type: occurrence.type || "outros",
    title: occurrence.title || "",
    description: occurrence.description || "",
    damageValue: Number(occurrence.damageValue ?? occurrence.damage_value ?? 0),
    photoUrls: normalizePhotoUrls(occurrence.photoUrls || occurrence.photo_urls),
    occurrenceDate: occurrence.occurrenceDate || occurrence.occurrence_date || toDateInputValue(new Date()),
    responsibleUser: occurrence.responsibleUser || occurrence.responsible_user || "",
    createdAt: occurrence.createdAt || occurrence.created_at || "",
    updatedAt: occurrence.updatedAt || occurrence.updated_at || "",
  };
}

function normalizeChecklistItems(items = {}) {
  return checkoutItems.reduce((acc, item) => {
    acc[item.key] = Boolean(items?.[item.key]);
    return acc;
  }, {});
}

function normalizePhotoUrls(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split("\n").map((url) => url.trim()).filter(Boolean);
  }

  return [];
}

function mapChecklistToSupabase(checklist) {
  const normalized = normalizeChecklist(checklist);

  return {
    id: normalized.id,
    reservation_id: normalized.reservationId,
    client_id: normalized.clientId,
    items: normalized.items,
    status: normalized.status,
    finalized_at: normalized.finalizedAt || null,
    responsible_user: normalized.responsibleUser,
    updated_at: new Date().toISOString(),
  };
}

function mapChecklistFromSupabase(checklist) {
  return normalizeChecklist(checklist);
}

function mapOccurrenceToSupabase(occurrence) {
  const normalized = normalizeOccurrence(occurrence);

  return {
    id: normalized.id,
    reservation_id: normalized.reservationId,
    client_id: normalized.clientId,
    type: normalized.type,
    title: normalized.title,
    description: normalized.description,
    damage_value: normalized.damageValue,
    photo_urls: normalized.photoUrls,
    occurrence_date: normalized.occurrenceDate,
    responsible_user: normalized.responsibleUser,
    updated_at: new Date().toISOString(),
  };
}

function mapOccurrenceFromSupabase(occurrence) {
  return normalizeOccurrence(occurrence);
}

function upsertById(items, item) {
  const exists = items.some((current) => current.id === item.id);

  return exists
    ? items.map((current) => (current.id === item.id ? item : current))
    : [item, ...items];
}

function countCheckedItems(items) {
  return Object.values(normalizeChecklistItems(items)).filter(Boolean).length;
}

function countBy(items, key) {
  return items.reduce((map, item) => {
    const value = item[key] || "não informado";
    map.set(value, (map.get(value) || 0) + 1);
    return map;
  }, new Map());
}

function isDateInMonth(value, selectedMonth) {
  if (!value) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);
  return date.getFullYear() === selectedMonth.getFullYear() && date.getMonth() === selectedMonth.getMonth();
}

function readList(key) {
  try {
    const stored = window.localStorage.getItem(key);
    const list = stored ? JSON.parse(stored) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeList(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function sanitizePathSegment(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "arquivo";
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
