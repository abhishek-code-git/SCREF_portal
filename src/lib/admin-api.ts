import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/use-school";

export type InviteUserPayload = {
  email: string;
  full_name: string;
  phone?: string | undefined;
  role: AppRole;
  scope_kind: "global" | "school" | "master" | "franchise";
  scope_id?: string | undefined;
};

export async function inviteUser(payload: InviteUserPayload): Promise<{ ok: true; user_id: string; invited: boolean }> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Your session has expired. Sign in again and retry.");
  const response = await fetch("/api/admin/invite-user", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({})) as { error?: string; ok?: true; user_id?: string; invited?: boolean };
  if (!response.ok || !result.ok || !result.user_id || typeof result.invited !== "boolean") throw new Error(result.error ?? "Unable to invite this person.");
  return { ok: true, user_id: result.user_id, invited: result.invited };
}
