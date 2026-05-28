import { createClient } from "@supabase/supabase-js";

export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
    global: {
      // Next.js 14 patches global fetch to cache by default, which freezes
      // Supabase query results at their first response (so newly created
      // pools/brackets never show up). Force every DB read/write to bypass
      // the Next.js data cache.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" })
    }
  });
}
