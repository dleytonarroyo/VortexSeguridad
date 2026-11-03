import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

/** Indica si las dos variables de conexión están configuradas. */
export const configOk = Boolean(url && key);

export const supabase = createClient(url || "https://sin-configurar.supabase.co", key || "sin-configurar", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
});

/** Nombre del bucket privado donde se guardan imágenes y comprobantes. */
export const BUCKET = "vortex";
