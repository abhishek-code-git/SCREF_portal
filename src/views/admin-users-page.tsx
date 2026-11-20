"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, useSchoolContext, type AppRole } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";
import { inviteUser } from "@/lib/admin-api";

type ScopeKind = "global" | "school" | "master" | "franchise";
type Profile = { user_id: string; full_name: string | null; phone: string };
type Membership = { id: string; user_id: string; role: AppRole; school_id: string | null; master_franchise_id: string | null; franchise_id: string | null };
const ROLES: AppRole[] = ["central_super_admin", "central_ops_admin", "franchise_owner", "school_principal", "admissions_staff", "teacher", "accountant", "transport_manager", "parent", "student"];

export function AdminUsersPage() {
  const { memberships: callerMemberships } = useSchoolContext();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [schools, setSchools] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [masters, setMasters] = useState<Array<{ id: string; name: string }>>([]);
  const [franchises, setFranchises] = useState<Array<{ id: string; name: string }>>([]);
  const [email, setEmail] = useState(""); const [fullName, setFullName] = useState(""); const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole>("franchise_owner"); const [scopeKind, setScopeKind] = useState<ScopeKind>("master"); const [scopeId, setScopeId] = useState("");
  const [search, setSearch] = useState(""); const [page, setPage] = useState(0); const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const pageSize = 25;
  const isSuperAdmin = callerMemberships.some((item) => item.role === "central_super_admin");
  const allowedRoles = isSuperAdmin ? ROLES : ROLES.filter((item) => item !== "central_super_admin" && item !== "central_ops_admin");

  const load = useCallback(async () => {
    setLoading(true);
    let profilesQuery = supabase.from("profiles").select("user_id,full_name,phone", { count: "exact" }).order("created_at", { ascending: false });
    if (search.trim()) profilesQuery = profilesQuery.ilike("full_name", `%${search.trim()}%`);
    const [profileResult, schoolsResult, mastersResult, franchisesResult] = await Promise.all([
      profilesQuery.range(page * pageSize, (page + 1) * pageSize - 1),
      supabase.from("schools").select("id,name,code").order("name"),
      supabase.from("master_franchises").select("id,name").order("name"),
      supabase.from("franchises").select("id,name").order("name"),
    ]);
    const ids = (profileResult.data ?? []).map((item) => item.user_id);
    const membershipResult = ids.length ? await supabase.from("memberships").select("id,user_id,role,school_id,master_franchise_id,franchise_id").in("user_id", ids) : { data: [], error: null };
    const problem = profileResult.error ?? schoolsResult.error ?? mastersResult.error ?? franchisesResult.error ?? membershipResult.error;
    if (problem) setError(problem.message); else {
      setProfiles((profileResult.data ?? []) as Profile[]); setMemberships((membershipResult.data ?? []) as Membership[]); setTotal(profileResult.count ?? 0);
      setSchools(schoolsResult.data ?? []); setMasters(mastersResult.data ?? []); setFranchises(franchisesResult.data ?? []);
    }
    setLoading(false);
  }, [page, search]);
  useEffect(() => { void load(); }, [load]);
  const scopeOptions: Array<{ id: string; label?: string; name?: string }> = scopeKind === "school" ? schools.map((item) => ({ id: item.id, label: `${item.name} (${item.code})` })) : scopeKind === "master" ? masters : scopeKind === "franchise" ? franchises : [];
  const chooseRole = (next: AppRole) => { setRole(next); setScopeId(""); setScopeKind(next === "central_super_admin" || next === "central_ops_admin" ? "global" : next === "franchise_owner" ? "master" : "school"); };
  const submit = async () => {
    const global = role === "central_super_admin" || role === "central_ops_admin";
    if (!email.trim() || !fullName.trim()) { setError("Enter the person's email address and full name."); return; }
    if (!global && !scopeId) { setError("Choose the organization or school scope."); return; }
    setBusy(true); setError(null);
    try {
      const result = await inviteUser({ email: email.trim(), full_name: fullName.trim(), phone: phone.trim() || undefined, role, scope_kind: scopeKind, scope_id: global ? undefined : scopeId });
      setEmail(""); setFullName(""); setPhone("");
      setError(result.invited ? "Invitation sent. The user will set their password from the email link." : "Access was assigned to the existing account.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to invite this person."); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Remove this membership? The Auth account is retained.")) return;
    const { error: removeError } = await supabase.from("memberships").delete().eq("id", id);
    if (removeError) setError(removeError.message); else await load();
  };
  const scopeNames = useMemo(() => new Map([...schools.map((item) => [item.id, item.name] as const), ...masters.map((item) => [item.id, item.name] as const), ...franchises.map((item) => [item.id, item.name] as const)]), [schools, masters, franchises]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <AppShell title="Users & Access" subtitle="Invite users and assign database-backed organization scopes">
    <div className="space-y-5">
      {error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{error}</div>}
      <section className="surface-panel space-y-4 p-5"><div><h2 className="font-display font-semibold">Invite a user and assign access</h2><p className="mt-1 text-sm text-muted-foreground">New email addresses receive a secure invitation. Existing Auth accounts receive the selected scope.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Input aria-label="Email address" type="email" placeholder="person@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /><Input aria-label="Full name" placeholder="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} /><Input aria-label="Phone" placeholder="Phone (optional)" value={phone} onChange={(event) => setPhone(event.target.value)} /><select aria-label="Role" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={role} onChange={(event) => chooseRole(event.target.value as AppRole)}>{allowedRoles.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}</select><select aria-label="Scope kind" disabled={role === "central_super_admin" || role === "central_ops_admin"} className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50" value={scopeKind} onChange={(event) => { setScopeKind(event.target.value as ScopeKind); setScopeId(""); }}><option value="global">Global</option><option value="school">School</option>{role === "franchise_owner" && <><option value="master">Master franchise</option><option value="franchise">Franchise</option></>}</select>{scopeKind !== "global" && <select aria-label="Scope" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={scopeId} onChange={(event) => setScopeId(event.target.value)}><option value="">Select scope</option>{scopeOptions.map((item) => <option key={item.id} value={item.id}>{item.label ?? item.name}</option>)}</select>}</div><Button disabled={busy} onClick={() => void submit()}>{busy ? "Sending…" : "Invite and grant access"}</Button></section>
      <section className="surface-panel overflow-hidden"><div className="flex flex-col gap-3 border-b p-5 sm:flex-row"><Input aria-label="Search users" placeholder="Search by name" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} className="sm:max-w-md" /><span className="self-center text-sm text-muted-foreground">{total.toLocaleString("en-IN")} accounts</span></div>{loading ? <p className="p-5 text-sm text-muted-foreground">Loading users and permissions…</p> : profiles.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No matching profiles found.</p> : <div className="divide-y">{profiles.map((profile) => <article key={profile.user_id} className="space-y-3 p-5"><div><p className="font-medium">{profile.full_name || "Name not provided"}</p><p className="text-xs text-muted-foreground">{profile.phone || profile.user_id}</p></div>{memberships.filter((item) => item.user_id === profile.user_id).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><p className="text-sm font-medium">{ROLE_LABELS[item.role]}</p><p className="text-xs text-muted-foreground">{item.school_id ? scopeNames.get(item.school_id) : item.master_franchise_id ? scopeNames.get(item.master_franchise_id) : item.franchise_id ? scopeNames.get(item.franchise_id) : "Global"}</p></div><Button size="sm" variant="outline" onClick={() => void remove(item.id)}>Remove access</Button></div>) || <p className="text-sm text-muted-foreground">No application membership.</p>}</article>)}</div>}<div className="flex items-center justify-between border-t px-5 py-3 text-sm"><span className="text-muted-foreground">Page {page + 1} of {pages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div></section>
    </div>
  </AppShell>;
}
