import { supabase } from "./supabaseClient.js";

const STORAGE_KEY = "sitio-sao-jorge-fixed-expenses";
let hasStartedSync = false;

export function getFixedExpenses() {
  const localExpenses = readFixedExpenses();

  syncFixedExpensesFromSupabase();

  return localExpenses;
}

export async function saveFixedExpense(expense) {
  const normalizedExpense = normalizeExpense(expense);
  const expenses = upsertLocalExpense(normalizedExpense);

  writeFixedExpenses(expenses);

  try {
    const { error } = await supabase
      .from("fixed_expenses")
      .upsert(mapExpenseToSupabase(normalizedExpense), { onConflict: "id" });

    if (error) {
      console.error("Erro ao salvar conta fixa no Supabase:", error);
      return { ok: false, error, expense: normalizedExpense };
    }

    return { ok: true, error: null, expense: normalizedExpense };
  } catch (error) {
    console.error("Erro ao conectar com Supabase para salvar conta fixa:", error);
    return { ok: false, error, expense: normalizedExpense };
  }
}

export async function deleteFixedExpense(expenseId) {
  writeFixedExpenses(readFixedExpenses().filter((expense) => expense.id !== expenseId));

  try {
    const { error } = await supabase
      .from("fixed_expenses")
      .delete()
      .eq("id", expenseId);

    if (error) {
      console.error("Erro ao excluir conta fixa no Supabase:", error);
      return { ok: false, error };
    }

    return { ok: true, error: null };
  } catch (error) {
    console.error("Erro ao conectar com Supabase para excluir conta fixa:", error);
    return { ok: false, error };
  }
}

export async function markFixedExpenseAsPaid(expense) {
  const paidExpense = normalizeExpense({
    ...expense,
    status: "pago",
    paidAt: new Date().toISOString(),
  });
  const nextExpense = createNextRecurringExpense(paidExpense);

  await saveFixedExpense(paidExpense);

  if (nextExpense && !hasExistingNextExpense(paidExpense, nextExpense.dueDate)) {
    await saveFixedExpense(nextExpense);
  }

  return { paidExpense, nextExpense };
}

export function buildFixedExpenseAlerts(referenceDate = new Date()) {
  const today = stripTime(referenceDate);
  const tomorrow = addDays(today, 1);
  const inTwoDays = addDays(today, 2);
  const weekLimit = addDays(today, 7);
  const pendingExpenses = getFixedExpenses().filter((expense) => expense.status !== "pago");
  const overdue = pendingExpenses.filter((expense) => buildDate(expense.dueDate) < today);
  const dueTomorrow = pendingExpenses.filter((expense) => sameDay(buildDate(expense.dueDate), tomorrow));
  const dueInTwoDays = pendingExpenses.filter((expense) => sameDay(buildDate(expense.dueDate), inTwoDays));
  const dueThisWeek = pendingExpenses.filter((expense) => {
    const dueDate = buildDate(expense.dueDate);
    return dueDate >= today && dueDate <= weekLimit;
  });
  const alerts = [
    ...dueTomorrow.map((expense) => ({
      type: "finance",
      message: `Conta de ${expense.name} vence amanhã`,
    })),
    ...dueInTwoDays.map((expense) => ({
      type: "finance",
      message: `Conta de ${expense.name} vence em 2 dias`,
    })),
    ...overdue.map((expense) => ({
      type: "finance",
      message: `${expense.name} está atrasada`,
    })),
  ];

  if (dueThisWeek.length >= 3) {
    alerts.unshift({
      type: "finance",
      message: `${dueThisWeek.length} contas vencem esta semana`,
    });
  }

  return alerts;
}

export function calculateFixedExpensesSummary(expenses, selectedMonth) {
  const monthExpenses = expenses.filter((expense) => isDateInMonth(expense.dueDate, selectedMonth));
  const total = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const paid = monthExpenses
    .filter((expense) => expense.status === "pago")
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const pending = monthExpenses
    .filter((expense) => expense.status !== "pago")
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const overdue = monthExpenses.filter((expense) => (
    expense.status !== "pago" && buildDate(expense.dueDate) < stripTime(new Date())
  ));

  return {
    total,
    paid,
    pending,
    overdue: overdue.length,
    monthExpenses,
  };
}

async function syncFixedExpensesFromSupabase() {
  if (hasStartedSync) {
    return;
  }

  hasStartedSync = true;

  try {
    const { data, error } = await supabase
      .from("fixed_expenses")
      .select("id,name,category,amount,due_date,recurrence,notes,status,paid_at,parent_id,created_at,updated_at")
      .order("due_date", { ascending: true });

    if (error) {
      console.error("Erro ao carregar contas fixas no Supabase:", error);
      return;
    }

    if (Array.isArray(data)) {
      writeFixedExpenses(data.map(mapExpenseFromSupabase));
    }
  } catch (error) {
    console.error("Erro ao conectar com Supabase para carregar contas fixas:", error);
  } finally {
    window.setTimeout(() => {
      hasStartedSync = false;
    }, 5000);
  }
}

function createNextRecurringExpense(expense) {
  const nextDueDate = getNextDueDate(expense.dueDate, expense.recurrence);

  if (!nextDueDate) {
    return null;
  }

  return normalizeExpense({
    id: `conta-fixa-${Date.now()}`,
    name: expense.name,
    category: expense.category,
    amount: expense.amount,
    dueDate: nextDueDate,
    recurrence: expense.recurrence,
    notes: expense.notes,
    status: "pendente",
    parentId: expense.parentId || expense.id,
  });
}

function getNextDueDate(value, recurrence) {
  if (!value) {
    return "";
  }

  const date = buildDate(value);

  if (recurrence === "semanal") {
    date.setDate(date.getDate() + 7);
  } else if (recurrence === "anual") {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    date.setMonth(date.getMonth() + 1);
  }

  return toDateInputValue(date);
}

function hasExistingNextExpense(expense, dueDate) {
  return readFixedExpenses().some((item) => (
    item.id !== expense.id
    && (item.parentId === expense.parentId || item.parentId === expense.id || item.name === expense.name)
    && item.dueDate === dueDate
  ));
}

function upsertLocalExpense(expense) {
  const expenses = readFixedExpenses();
  const exists = expenses.some((item) => item.id === expense.id);

  return exists
    ? expenses.map((item) => (item.id === expense.id ? expense : item))
    : [expense, ...expenses];
}

function normalizeExpense(expense = {}) {
  return {
    id: expense.id || `conta-fixa-${Date.now()}`,
    name: expense.name || expense.nome || "",
    category: expense.category || "outros",
    amount: Number(expense.amount ?? expense.value ?? 0),
    dueDate: expense.dueDate || expense.due_date || "",
    recurrence: expense.recurrence || "mensal",
    notes: expense.notes || expense.observation || expense.observacao || "",
    status: expense.status || "pendente",
    paidAt: expense.paidAt || expense.paid_at || "",
    parentId: expense.parentId || expense.parent_id || "",
    createdAt: expense.createdAt || expense.created_at || "",
    updatedAt: expense.updatedAt || expense.updated_at || "",
  };
}

function mapExpenseToSupabase(expense) {
  const normalizedExpense = normalizeExpense(expense);

  return {
    id: normalizedExpense.id,
    name: normalizedExpense.name,
    category: normalizedExpense.category,
    amount: normalizedExpense.amount,
    due_date: normalizedExpense.dueDate,
    recurrence: normalizedExpense.recurrence,
    notes: normalizedExpense.notes,
    status: normalizedExpense.status,
    paid_at: normalizedExpense.paidAt || null,
    parent_id: normalizedExpense.parentId || null,
    updated_at: new Date().toISOString(),
  };
}

function mapExpenseFromSupabase(expense) {
  return normalizeExpense({
    id: expense.id,
    name: expense.name,
    category: expense.category,
    amount: expense.amount,
    dueDate: expense.due_date,
    recurrence: expense.recurrence,
    notes: expense.notes,
    status: expense.status,
    paidAt: expense.paid_at,
    parentId: expense.parent_id,
    createdAt: expense.created_at,
    updatedAt: expense.updated_at,
  });
}

function readFixedExpenses() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const expenses = stored ? JSON.parse(stored) : [];

    return Array.isArray(expenses) ? expenses.map(normalizeExpense) : [];
  } catch {
    return [];
  }
}

function writeFixedExpenses(expenses) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses.map(normalizeExpense)));
}

function isDateInMonth(value, selectedMonth) {
  if (!value) {
    return false;
  }

  const date = buildDate(value);

  return date.getFullYear() === selectedMonth.getFullYear()
    && date.getMonth() === selectedMonth.getMonth();
}

function buildDate(value) {
  return new Date(`${value}T00:00:00`);
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function sameDay(first, second) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
