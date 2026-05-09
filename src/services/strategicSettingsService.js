import { supabase } from "./supabaseClient.js";

const STORAGE_KEY = "sitio-sao-jorge-strategic-settings";
const SETTINGS_ID = "default";

export const defaultStrategicSettings = {
  averageWeekdayPrice: 0,
  averageFridayPrice: 0,
  averageSaturdayPrice: 0,
  averageSundayPrice: 0,
  averageHolidayPrice: 0,
  averageComboPrice: 0,
  monthlyGoal: 0,
};

export async function getStrategicSettings() {
  try {
    const { data, error } = await supabase
      .from("strategic_settings")
      .select("id,average_weekday_price,average_friday_price,average_saturday_price,average_sunday_price,average_holiday_price,average_combo_price,monthly_goal")
      .eq("id", SETTINGS_ID)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar configurações estratégicas:", error);
      return getLocalStrategicSettings();
    }

    if (!data) {
      return getLocalStrategicSettings();
    }

    const settings = mapSettingsFromSupabase(data);
    saveLocalStrategicSettings(settings);
    return settings;
  } catch (error) {
    console.error("Erro ao conectar com Supabase para configurações estratégicas:", error);
    return getLocalStrategicSettings();
  }
}

export async function saveStrategicSettings(settings) {
  const normalizedSettings = normalizeSettings(settings);
  saveLocalStrategicSettings(normalizedSettings);

  try {
    const { error } = await supabase
      .from("strategic_settings")
      .upsert(mapSettingsToSupabase(normalizedSettings), { onConflict: "id" });

    if (error) {
      console.error("Erro ao salvar configurações estratégicas:", error);
      return { ok: false, error };
    }

    return { ok: true, error: null };
  } catch (error) {
    console.error("Erro ao conectar com Supabase para salvar configurações estratégicas:", error);
    return { ok: false, error };
  }
}

function getLocalStrategicSettings() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeSettings(JSON.parse(stored)) : { ...defaultStrategicSettings };
  } catch {
    return { ...defaultStrategicSettings };
  }
}

function saveLocalStrategicSettings(settings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
}

function normalizeSettings(settings = {}) {
  return {
    averageWeekdayPrice: Number(settings.averageWeekdayPrice || 0),
    averageFridayPrice: Number(settings.averageFridayPrice || 0),
    averageSaturdayPrice: Number(settings.averageSaturdayPrice || 0),
    averageSundayPrice: Number(settings.averageSundayPrice || 0),
    averageHolidayPrice: Number(settings.averageHolidayPrice || 0),
    averageComboPrice: Number(settings.averageComboPrice || 0),
    monthlyGoal: Number(settings.monthlyGoal || 0),
  };
}

function mapSettingsFromSupabase(settings) {
  return normalizeSettings({
    averageWeekdayPrice: settings.average_weekday_price,
    averageFridayPrice: settings.average_friday_price,
    averageSaturdayPrice: settings.average_saturday_price,
    averageSundayPrice: settings.average_sunday_price,
    averageHolidayPrice: settings.average_holiday_price,
    averageComboPrice: settings.average_combo_price,
    monthlyGoal: settings.monthly_goal,
  });
}

function mapSettingsToSupabase(settings) {
  return {
    id: SETTINGS_ID,
    average_weekday_price: settings.averageWeekdayPrice,
    average_friday_price: settings.averageFridayPrice,
    average_saturday_price: settings.averageSaturdayPrice,
    average_sunday_price: settings.averageSundayPrice,
    average_holiday_price: settings.averageHolidayPrice,
    average_combo_price: settings.averageComboPrice,
    monthly_goal: settings.monthlyGoal,
    updated_at: new Date().toISOString(),
  };
}
