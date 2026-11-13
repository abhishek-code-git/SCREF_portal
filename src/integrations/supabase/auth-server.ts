// Verifies the signed-in user inside Next.js route handlers (replaces the old server-function
// auth middleware). The browser sends `Authorization: Bearer <access_token>`.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { createSupabaseFetch, getPublicSupabaseConfig } from "./shared";

export async function requireSupabaseAuth(request: Request) {
  const { url, key } = getPublicSupabaseConfig();

  const match = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "");
  const token = match?.[1];
  if (!token || token.split(".").length !== 3) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient<Database>(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return { supabase, userId: data.claims.sub, claims: data.claims };
}
