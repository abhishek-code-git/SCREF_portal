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
    .from("memberships").select("role,master_franchise_id,franchise_id,school_id").eq("user_id", caller.userId);
  if (callerError) return fail("Unable to verify your access.", 403);
  const callerIsCentral = callerMemberships.some((m) => m.role === "central_super_admin" || m.role === "central_ops_admin");
  const callerIsSuper = callerMemberships.some((m) => m.role === "central_super_admin");
  const ownerMasterIds = callerMemberships.filter((m) => m.role === "franchise_owner" && m.master_franchise_id).map((m) => m.master_franchise_id!);
  const ownerFranchiseIds = callerMemberships.filter((m) => m.role === "franchise_owner" && m.franchise_id).map((m) => m.franchise_id!);
  const principalSchoolIds = callerMemberships.filter((m) => m.role === "school_principal" && m.school_id).map((m) => m.school_id!);
  if (!callerIsCentral && ownerMasterIds.length === 0 && ownerFranchiseIds.length === 0 && principalSchoolIds.length === 0) return fail("Your account is not authorized to invite users.", 403);
  if (callerIsCentral && centralRole && !callerIsSuper) return fail("Only a Central Super Admin can invite Central Admin accounts.", 403);

  const staffRoles = ["teacher", "admissions_staff", "accountant", "transport_manager"] as const;
  if (!callerIsCentral && ownerFranchiseIds.length > 0) {
    const allowed = payload.scope_kind === "school" && !!payload.scope_id
      && ((payload.role === "school_principal" || staffRoles.includes(payload.role as typeof staffRoles[number])));
    if (!allowed) return fail("Franchise Owners may invite principals and school staff only to their own franchise schools.", 403);
    const { data: school, error } = await caller.supabase.from("schools").select("id,franchise_id,status").eq("id", payload.scope_id!).maybeSingle();
    if (error || !school?.franchise_id || !ownerFranchiseIds.includes(school.franchise_id)) return fail("That school is outside your authorized franchise.", 403);
    const { data: open } = await caller.supabase.rpc("franchise_is_open", { _franchise_id: school.franchise_id });
    if (school.status !== "active" || !open) return fail("Invitations are available only for schools in an active franchise and master franchise.", 403);
  } else if (!callerIsCentral && principalSchoolIds.length > 0) {
    if (payload.scope_kind !== "school" || !payload.scope_id || !staffRoles.includes(payload.role as typeof staffRoles[number]) || !principalSchoolIds.includes(payload.scope_id)) return fail("Principals may invite school staff only to their own school.", 403);
    const { data: writable } = await caller.supabase.rpc("school_is_writable", { _school_id: payload.scope_id });
    if (!writable) return fail("Invitations are disabled while this school or its franchise is suspended or inactive.", 403);
  } else if (!callerIsCentral) {
    const allowedKind = (payload.role === "franchise_owner" && payload.scope_kind === "franchise")
      || (payload.role === "school_principal" && payload.scope_kind === "school");
    if (!allowedKind || !payload.scope_id) return fail("Master Franchise Owners may invite only franchise owners to a franchise or principals to a school in their own network.", 403);
    if (payload.role === "franchise_owner") {
      const { data: franchise, error } = await caller.supabase.from("franchises").select("id,master_franchise_id,status").eq("id", payload.scope_id).maybeSingle();
      if (error || !franchise || !ownerMasterIds.includes(franchise.master_franchise_id)) return fail("That franchise is outside your authorized master franchise.", 403);
      const { data: master } = await caller.supabase.from("master_franchises").select("status").eq("id", franchise.master_franchise_id).maybeSingle();
      if (franchise.status !== "active" || master?.status !== "active") return fail("Owners can be invited only to an active franchise in an active master franchise.", 403);
    } else {
      const { data: school, error } = await caller.supabase.from("schools").select("id,franchise_id,status").eq("id", payload.scope_id).maybeSingle();
      if (error || !school?.franchise_id) return fail("That school is outside your authorized master franchise.", 403);
      const { data: franchise } = await caller.supabase.from("franchises").select("master_franchise_id,status").eq("id", school.franchise_id).maybeSingle();
      const { data: master } = franchise ? await caller.supabase.from("master_franchises").select("status").eq("id", franchise.master_franchise_id).maybeSingle() : { data: null };
      if (!franchise || !ownerMasterIds.includes(franchise.master_franchise_id)) return fail("That school is outside your authorized master franchise.", 403);
      if (school.status !== "active" || franchise.status !== "active" || master?.status !== "active") return fail("Principals can be invited only to an active school in an active network.", 403);
    }
  }

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
