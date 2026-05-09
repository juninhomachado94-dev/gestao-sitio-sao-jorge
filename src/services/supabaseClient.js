import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://ovanmgfqzfohwxyxrqsr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4YtCqhT_xmbA5LEvN2YtuA_IqzUYaVb";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function testSupabaseConnection() {
  const { data, error } = await supabase.from("clients").select("*").limit(1);

  return { data, error };
}
