import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { createSupabaseFetch, getPublicSupabaseConfig } from "./shared";

function createSupabaseClient() {
  const { url, key } = getPublicSupabaseConfig();

  return createClient<Database>(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
// It is created lazily on first use, so builds do not need the environment variables.
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
