import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function readDotEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const file = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(file)) return out;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[t.slice(0, eq).trim()] = val;
    }
  } catch {
    /* ignore */
  }
  return out;
}

function env(name: string): string {
  return (process.env[name] ?? readDotEnv()[name] ?? "").trim();
}

let admin: SupabaseClient | null = null;

/** Server-only Supabase client (service_role). Never import from client components. */
export function getSupabaseAdmin(): SupabaseClient {
  const url = (env("SUPABASE_URL") || env("VITE_SUPABASE_URL")).replace(/\/$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis côté serveur (jamais de préfixe VITE_ pour service_role).",
    );
  }
  if (!admin) {
    admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
