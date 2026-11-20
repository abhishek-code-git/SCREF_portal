import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const roles = ["central_super_admin", "central_ops_admin", "franchise_owner", "school_principal", "admissions_staff", "teacher", "accountant", "transport_manager", "parent", "student"] as const;
const bodySchema = z.object({
  email: z.string().trim().email().max(320),
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional(),
  role: z.enum(roles),
  scope_kind: z.enum(["global", "school", "master", "franchise"]),
  scope_id: z.string().uuid().optional(),
});

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  let caller: Awaited<ReturnType<typeof requireSupabaseAuth>>;
  try { caller = await requireSupabaseAuth(request); } catch (cause) { return cause instanceof Response ? cause : fail("Unauthorized", 401); }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid invitation details.", 400);
  const payload = parsed.data;
  const centralRole = payload.role === "central_super_admin" || payload.role === "central_ops_admin";
  const validScope = centralRole
    ? payload.scope_kind === "global" && !payload.scope_id
    : payload.role === "franchise_owner"
      ? ["master", "franchise"].includes(payload.scope_kind) && !!payload.scope_id
      : payload.scope_kind === "school" && !!payload.scope_id;
  if (!validScope) return fail("The selected role requires a different organization scope.", 400);

  const { data: callerMemberships, error: callerError } = await caller.supabase
    .from("memberships").select("role").eq("user_id", caller.userId);
  if (callerError) return fail("Unable to verify your access.", 403);
  const callerIsCentral = callerMemberships.some((m) => m.role === "central_super_admin" || m.role === "central_ops_admin");
  const callerIsSuper = callerMemberships.some((m) => m.role === "central_super_admin");
  if (!callerIsCentral) return fail("Only Central Admin accounts can invite users.", 403);
  if (centralRole && !callerIsSuper) return fail("Only a Central Super Admin can invite Central Admin accounts.", 403);

  if (payload.scope_id) {
    const table = payload.scope_kind === "school" ? "schools" : payload.scope_kind === "master" ? "master_franchises" : "franchises";
    const { data: scope, error: scopeError } = await caller.supabase.from(table).select("id").eq("id", payload.scope_id).maybeSingle();
    if (scopeError || !scope) return fail("The selected organization scope was not found or is not authorized for your account.", 403);
  }

  let userId: string | null = null;
  try {
    const { data, error } = await supabaseAdmin.rpc("admin_find_user_by_email", { _email: payload.email });
    if (error) throw error;
    userId = data;
  } catch { return fail("Unable to look up the user account. Confirm the service-role key and migration are configured.", 500); }

  let invited = false;
  if (!userId) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(payload.email, {
      data: { full_name: payload.full_name, phone: payload.phone ?? "", invited_by_admin: true },
      redirectTo: `${siteUrl}/reset-password`,
    });
    if (error || !data.user) return fail(error?.message ?? "Unable to send the invitation email.", 400);
    userId = data.user.id; invited = true;
  }

  const membership = {
    user_id: userId,
    role: payload.role,
    school_id: payload.scope_kind === "school" ? payload.scope_id ?? null : null,
    master_franchise_id: payload.scope_kind === "master" ? payload.scope_id ?? null : null,
    franchise_id: payload.scope_kind === "franchise" ? payload.scope_id ?? null : null,
  };
  const { error: insertError } = await caller.supabase.from("memberships").insert(membership);
  if (insertError) {
    if (insertError.code === "23505") return fail("This person already has that role in that scope.", 409);
    return fail(insertError.message, 400);
  }
  return NextResponse.json({ ok: true, user_id: userId, invited });
}
