"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionUser } from "@/hooks/use-session";
import { ROLE_LABELS, useSchoolContext, type AppRole } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";
import { inviteUser } from "@/lib/admin-api";
import { AdminUsersPage } from "@/views/admin-users-page";

type ScopeKind = "global" | "school" | "master" | "franchise";
type Profile = { user_id: string; full_name: string | null; phone: string };
type Membership = { id: string; user_id: string; role: AppRole; school_id: string | null; master_franchise_id: string | null; franchise_id: string | null };
type School = { id: string; name: string; code: string; city: string; academic_year: string; status: string; franchise_id: string | null; created_at: string };
type Master = { id: string; name: string; status: string; created_at: string };
type Franchise = { id: string; master_franchise_id: string; name: string; status: string; created_at: string };
type AuditEntry = { id: string; actor_user_id: string | null; action: string; entity_table: string; entity_id: string | null; details: Record<string, unknown>; created_at: string };

const ROLES: AppRole[] = ["central_super_admin", "central_ops_admin", "franchise_owner", "school_principal", "admissions_staff", "teacher", "accountant", "transport_manager", "parent", "student"];
const ROLE_NAMES = ROLE_LABELS;
const applyError = (message: string) => /does not exist|schema cache|could not find/i.test(message)
  ? `${message} Apply migrations through 20261120000001_central_admin_hardening.sql in timestamp order, then reload.`
  : message;
const scopeDescription = (m: Membership, schools: Map<string, string>, masters: Map<string, string>, franchises: Map<string, string>) => m.school_id ? schools.get(m.school_id) ?? "School scope" : m.master_franchise_id ? masters.get(m.master_franchise_id) ?? "Master franchise scope" : m.franchise_id ? franchises.get(m.franchise_id) ?? "Franchise scope" : "Global";

export function AdminToolsPage({ section }: { section: string }) {
  if (section === "users") return <AdminUsersPage />;
  if (section === "reports") return <NetworkReportsPage />;
  if (section === "onboarding") return <OnboardingPage />;
  if (section === "audit") return <AuditLogsPage />;
  return <NetworkSettingsPage />;
}

function UsersAccessPage() {
  const { memberships: callerMemberships } = useSchoolContext();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [schools, setSchools] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [masters, setMasters] = useState<Array<{ id: string; name: string }>>([]);
  const [franchises, setFranchises] = useState<Array<{ id: string; name: string }>>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<AppRole>("franchise_owner");
  const [scopeKind, setScopeKind] = useState<ScopeKind>("master");
  const [scopeId, setScopeId] = useState("");
  const PAGE_SIZE = 25;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    let query = supabase.from("profiles").select("user_id,full_name,phone", { count: "exact" }).order("created_at", { ascending: false });
    if (search.trim()) {
      const term = search.trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term)) query = query.eq("user_id", term);
      else query = query.ilike("full_name", `%${term}%`);
    }
    const p = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const [s, m, f] = await Promise.all([
      supabase.from("schools").select("id,name,code"),
      supabase.from("master_franchises").select("id,name"),
      supabase.from("franchises").select("id,name"),
    ]);
    const ids = (p.data ?? []).map((x) => x.user_id);
    const memberResult = ids.length ? await supabase.from("memberships").select("id,user_id,role,school_id,master_franchise_id,franchise_id").in("user_id", ids) : { data: [], error: null };
    const err = p.error ?? s.error ?? m.error ?? f.error ?? memberResult.error;
    if (err) setError(applyError(err.message));
    else {
      setProfiles((p.data ?? []) as Profile[]); setTotal(p.count ?? 0); setMemberships((memberResult.data ?? []) as Membership[]);
      setSchools((s.data ?? []) as typeof schools); setMasters((m.data ?? []) as typeof masters); setFranchises((f.data ?? []) as typeof franchises);
    }
    setLoading(false);
  }, [page, search]);
  useEffect(() => { void load(); }, [load]);

  const scopeOptions = scopeKind === "school" ? schools.map((x) => ({ id: x.id, label: `${x.name} (${x.code})` })) : scopeKind === "master" ? masters.map((x) => ({ id: x.id, label: x.name })) : scopeKind === "franchise" ? franchises.map((x) => ({ id: x.id, label: x.name })) : [];
  const isSuperAdmin = callerMemberships.some((membership) => membership.role === "central_super_admin");
  const availableRoles = isSuperAdmin ? ROLES : ROLES.filter((item) => item !== "central_super_admin" && item !== "central_ops_admin");
  const createMembership = async () => {
    if (!email.trim() || !fullName.trim()) { setError("Enter the person's email address and full name."); return; }
    const globalRole = role === "central_super_admin" || role === "central_ops_admin";
    if (!globalRole && scopeKind === "global") { setError("Choose the organization or school scope for this role."); return; }
    if (!globalRole && !scopeId) { setError("Select a scope for this membership."); return; }
    setBusy(true); setError(null);
    try {
      const result = await inviteUser({ email: email.trim(), full_name: fullName.trim(), phone: phone.trim() || undefined, role, scope_kind: scopeKind, scope_id: globalRole ? undefined : scopeId });
      setEmail(""); setFullName(""); setPhone("");
      setError(result.invited ? "Invitation sent. The user will set their password from the email link." : "Access was assigned to the existing account.");
      await load();
    } catch (cause) { setError(applyError(cause instanceof Error ? cause.message : "Unable to assign this account.")); }
    finally { setBusy(false); }
  };
  const removeMembership = async (membershipId: string) => {
    if (!window.confirm("Remove this membership? The user loses this role and scope. Their Auth account is not deleted.")) return;
    const { error: deleteError } = await supabase.from("memberships").delete().eq("id", membershipId);
    if (deleteError) setError(applyError(deleteError.message)); else await load();
  };
  const schoolNames = useMemo(() => new Map(schools.map((x) => [x.id, x.name])), [schools]);
  const masterNames = useMemo(() => new Map(masters.map((x) => [x.id, x.name])), [masters]);
  const franchiseNames = useMemo(() => new Map(franchises.map((x) => [x.id, x.name])), [franchises]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return <AppShell title="Users & Access" subtitle="Assign database-backed roles and organization scopes">
    <div className="space-y-5">
      {error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{error}</div>}
      <section className="surface-panel space-y-4 p-5"><div><h2 className="font-display font-semibold">Grant access to an existing Auth account</h2><p className="mt-1 text-sm text-muted-foreground">Memberships determine the role and dashboard after login. This workflow does not create or delete Auth accounts.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Input aria-label="Auth user UUID" placeholder="Existing Auth user UUID" value={userId} onChange={(e) => setUserId(e.target.value)} /><select aria-label="Role" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={role} onChange={(e) => { const next = e.target.value as AppRole; setRole(next); setScopeKind(next === "central_super_admin" || next === "central_ops_admin" ? "global" : next === "franchise_owner" ? "master" : "school"); setScopeId(""); }}>{ROLES.map((r) => <option value={r} key={r}>{ROLE_NAMES[r]}</option>)}</select><select aria-label="Scope kind" disabled={role === "central_super_admin" || role === "central_ops_admin"} className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50" value={scopeKind} onChange={(e) => { setScopeKind(e.target.value as ScopeKind); setScopeId(""); }}><option value="global">Global</option><option value="school">School</option>{role === "franchise_owner" && <><option value="master">Master franchise</option><option value="franchise">Franchise</option></>}</select>{scopeKind !== "global" && <select aria-label="Scope" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={scopeId} onChange={(e) => setScopeId(e.target.value)}><option value="">Select scope</option>{scopeOptions.map((x) => <option value={x.id} key={x.id}>{x.label}</option>)}</select>}</div><Button disabled={busy} onClick={() => void createMembership()}>{busy ? "Assigning…" : "Grant access"}</Button></section>
      <section className="surface-panel overflow-hidden"><div className="flex flex-col gap-3 border-b p-5 sm:flex-row"><Input aria-label="Search users" placeholder="Search name or paste full UUID" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="sm:max-w-md" /><span className="self-center text-sm text-muted-foreground">{total.toLocaleString("en-IN")} accounts</span></div>{loading ? <p className="p-5 text-sm text-muted-foreground">Loading users and permissions…</p> : profiles.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No matching profiles found. Accounts must be created through the existing Auth signup or invitation process.</p> : <div className="divide-y">{profiles.map((profile) => <article key={profile.user_id} className="space-y-3 p-5"><div><p className="font-medium">{profile.full_name || "Name not provided"}</p><p className="break-all text-xs text-muted-foreground">{profile.user_id}{profile.phone ? ` · ${profile.phone}` : ""}</p></div>{memberships.filter((m) => m.user_id === profile.user_id).length ? memberships.filter((m) => m.user_id === profile.user_id).map((m) => <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><p className="text-sm font-medium">{ROLE_NAMES[m.role]}</p><p className="text-xs text-muted-foreground">{scopeDescription(m, schoolNames, masterNames, franchiseNames)}</p></div><Button size="sm" variant="outline" onClick={() => void removeMembership(m.id)}>Remove access</Button></div>) : <p className="text-sm text-muted-foreground">No memberships: this account has no application dashboard access.</p>}</article>)}</div>}<div className="flex items-center justify-between border-t px-5 py-3 text-sm"><span className="text-muted-foreground">Page {page + 1} of {pages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((x) => x - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((x) => x + 1)}>Next</Button></div></div></section>
    </div>
  </AppShell>;
}

function NetworkReportsPage() {
  const [masters, setMasters] = useState<Master[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [students, setStudents] = useState<Array<{ school_id: string }>>([]);
  const [classes, setClasses] = useState<Array<{ school_id: string }>>([]);
  const [memberships, setMemberships] = useState<Array<{ user_id: string; school_id: string | null; role: AppRole }>>([]);
  const [year, setYear] = useState("all");
  const [masterFilter, setMasterFilter] = useState("all");
  const [franchiseFilter, setFranchiseFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [m, f, s, st, c, mb] = await Promise.all([
      supabase.from("master_franchises").select("id,name,status,created_at").order("name"),
      supabase.from("franchises").select("id,master_franchise_id,name,status,created_at").order("name"),
      supabase.from("schools").select("id,name,code,city,academic_year,status,franchise_id,created_at").order("name"),
      supabase.from("students").select("school_id"),
      supabase.from("classes").select("school_id"),
      supabase.from("memberships").select("user_id,school_id,role").in("role", ["teacher", "school_principal"]),
    ]);
    const err = m.error ?? f.error ?? s.error ?? st.error ?? c.error ?? mb.error;
    if (err) setError(applyError(err.message));
    else { setMasters((m.data ?? []) as Master[]); setFranchises((f.data ?? []) as Franchise[]); setSchools((s.data ?? []) as School[]); setStudents((st.data ?? []) as Array<{ school_id: string }>); setClasses((c.data ?? []) as Array<{ school_id: string }>); setMemberships((mb.data ?? []) as Array<{ user_id: string; school_id: string | null; role: AppRole }>); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const years = [...new Set(schools.map((s) => s.academic_year).filter(Boolean))].sort();
  const filteredSchools = schools.filter((s) => (year === "all" || s.academic_year === year) && (franchiseFilter === "all" || s.franchise_id === franchiseFilter) && (masterFilter === "all" || franchises.find((f) => f.id === s.franchise_id)?.master_franchise_id === masterFilter));
  const schoolIdSet = new Set(filteredSchools.map((s) => s.id));
  const rows = franchises.filter((f) => (franchiseFilter === "all" || f.id === franchiseFilter) && (masterFilter === "all" || f.master_franchise_id === masterFilter)).map((f) => {
    const networkSchools = filteredSchools.filter((s) => s.franchise_id === f.id);
    const ids = new Set(networkSchools.map((s) => s.id));
    const people = (r: AppRole) => new Set(memberships.filter((m) => m.role === r && m.school_id && ids.has(m.school_id)).map((m) => m.user_id)).size;
    return { id: f.id, name: f.name, parent: masters.find((m) => m.id === f.master_franchise_id)?.name ?? "Master franchise unavailable", schools: networkSchools.length, active: networkSchools.filter((s) => s.status === "active").length, students: students.filter((s) => ids.has(s.school_id)).length, classes: classes.filter((c) => ids.has(c.school_id)).length, teachers: people("teacher"), principals: people("school_principal") };
  });
  const unassigned = filteredSchools.filter((s) => !s.franchise_id);
  const totalStudents = students.filter((s) => schoolIdSet.has(s.school_id)).length;
  const totalTeachers = new Set(memberships.filter((m) => m.role === "teacher" && m.school_id && schoolIdSet.has(m.school_id)).map((m) => m.user_id)).size;
  const totalPrincipals = new Set(memberships.filter((m) => m.role === "school_principal" && m.school_id && schoolIdSet.has(m.school_id)).map((m) => m.user_id)).size;

  return <AppShell title="Network Reports" subtitle="Live rollups from schools, students, classes, and memberships">
    <div className="space-y-5">{error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{error}</div>}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Schools", filteredSchools.length], ["Students", totalStudents], ["Teachers", totalTeachers], ["Principals", totalPrincipals]].map(([label, value]) => <article className="surface-panel p-5" key={label}><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{loading ? "—" : Number(value).toLocaleString("en-IN")}</p></article>)}</section>
      <section className="surface-panel overflow-hidden"><div className="flex flex-col gap-3 border-b p-5 md:flex-row"><select aria-label="Academic year" className="h-10 rounded-md border bg-background px-3 text-sm" value={year} onChange={(e) => setYear(e.target.value)}><option value="all">All academic years</option>{years.map((v) => <option key={v}>{v}</option>)}</select><select aria-label="Master franchise" className="h-10 rounded-md border bg-background px-3 text-sm" value={masterFilter} onChange={(e) => { setMasterFilter(e.target.value); setFranchiseFilter("all"); }}><option value="all">All master franchises</option>{masters.map((m) => <option value={m.id} key={m.id}>{m.name}</option>)}</select><select aria-label="Franchise" className="h-10 rounded-md border bg-background px-3 text-sm" value={franchiseFilter} onChange={(e) => setFranchiseFilter(e.target.value)}><option value="all">All franchises</option>{franchises.filter((f) => masterFilter === "all" || f.master_franchise_id === masterFilter).map((f) => <option value={f.id} key={f.id}>{f.name}</option>)}</select></div>{loading ? <p className="p-5 text-sm text-muted-foreground">Loading report data…</p> : <div className="divide-y">{rows.map((r) => <article key={r.id} className="grid gap-2 p-5 sm:grid-cols-4 xl:grid-cols-7"><div className="sm:col-span-2"><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.parent}</p></div><Metric label="Schools · active" value={`${r.schools} · ${r.active}`} /><Metric label="Students" value={r.students} /><Metric label="Classes" value={r.classes} /><Metric label="Teachers" value={r.teachers} /><Metric label="Principals" value={r.principals} /></article>)}{unassigned.length > 0 && <article className="grid gap-2 p-5 sm:grid-cols-4"><div className="font-medium">Unassigned schools</div><Metric label="Schools" value={unassigned.length} /><Metric label="Students" value={students.filter((s) => unassigned.some((x) => x.id === s.school_id)).length} /></article>}{!rows.length && !unassigned.length && <p className="p-8 text-center text-sm text-muted-foreground">No database records match these filters.</p>}</div>}</section>
    </div>
  </AppShell>;
}

function Metric({ label, value }: { label: string; value: number | string }) { return <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium tabular-nums">{value}</p></div>; }

function OnboardingPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [s, m, f] = await Promise.all([
      supabase.from("schools").select("id,name,code,city,academic_year,status,franchise_id,created_at").in("status", ["onboarding"]),
      supabase.from("master_franchises").select("id,name,status,created_at").eq("status", "pending"),
      supabase.from("franchises").select("id,master_franchise_id,name,status,created_at").eq("status", "pending"),
    ]);
    const err = s.error ?? m.error ?? f.error;
    if (err) setError(applyError(err.message)); else { setSchools((s.data ?? []) as School[]); setMasters((m.data ?? []) as Master[]); setFranchises((f.data ?? []) as Franchise[]); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const decide = async (table: "schools" | "master_franchises" | "franchises", id: string, status: string) => {
    setBusyId(id); setError(null);
    const result = table === "schools" ? await supabase.from("schools").update({ status }).eq("id", id) : table === "master_franchises" ? await supabase.from("master_franchises").update({ status }).eq("id", id) : await supabase.from("franchises").update({ status }).eq("id", id);
    if (result.error) setError(applyError(result.error.message)); else await load();
    setBusyId(null);
  };
  const pendingCount = schools.length + masters.length + franchises.length;
  return <AppShell title="Onboarding & Approvals" subtitle="Review actual pending school and network records">
    <div className="space-y-5">{error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{error}</div>}<section className="surface-panel p-5"><p className="text-sm text-muted-foreground">{loading ? "Loading approval queue…" : `${pendingCount.toLocaleString("en-IN")} pending records`}. Approve activates the record; declining a school marks it rejected, while declining a network marks it inactive. Actions are recorded in Audit Logs.</p></section>
      {loading ? <section className="surface-panel p-5 text-sm text-muted-foreground">Loading…</section> : pendingCount === 0 ? <section className="surface-panel p-8 text-center"><h2 className="font-display font-semibold">No pending onboarding records</h2><p className="mt-1 text-sm text-muted-foreground">New schools and network records with pending status will appear here.</p></section> : <section className="surface-panel divide-y">{[...masters.map((x) => ({ id: x.id, name: x.name, kind: "Master franchise", created_at: x.created_at, table: "master_franchises" as const })), ...franchises.map((x) => ({ id: x.id, name: x.name, kind: "Franchise", created_at: x.created_at, table: "franchises" as const })), ...schools.map((x) => ({ id: x.id, name: x.name, kind: "School", created_at: x.created_at, table: "schools" as const }))].map((x) => <article key={`${x.table}-${x.id}`} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="font-medium">{x.name}</p><p className="mt-1 text-xs text-muted-foreground">{x.kind} · Submitted {new Date(x.created_at).toLocaleDateString("en-IN")}</p></div><div className="flex gap-2"><Button size="sm" onClick={() => void decide(x.table, x.id, "active")} disabled={busyId === x.id}>Approve</Button><Button size="sm" variant="outline" onClick={() => void decide(x.table, x.id, x.table === "schools" ? "rejected" : "inactive")} disabled={busyId === x.id}>Decline</Button></div></article>)}</section>}
    </div>
  </AppShell>;
}

function AuditLogsPage() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [actors, setActors] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 30;
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    let query = supabase.from("central_admin_audit_logs").select("id,actor_user_id,action,entity_table,entity_id,details,created_at", { count: "exact" }).order("created_at", { ascending: false });
    if (search.trim()) query = query.or(`action.ilike.%${search.trim()}%,entity_table.ilike.%${search.trim()}%`);
    const { data, count, error: queryError } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (queryError) setError(applyError(queryError.message));
    else {
      const logs = (data ?? []) as AuditEntry[]; setItems(logs); setTotal(count ?? 0);
      const actorIds = [...new Set(logs.map((x) => x.actor_user_id).filter((x): x is string => !!x))];
      const { data: profiles, error: profileError } = actorIds.length ? await supabase.from("profiles").select("user_id,full_name").in("user_id", actorIds) : { data: [], error: null };
      if (profileError) setError(applyError(profileError.message));
      setActors(new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? p.user_id])));
    }
    setLoading(false);
  }, [page, search]);
  useEffect(() => { void load(); }, [load]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <AppShell title="Audit Logs" subtitle="Database-triggered Central Admin change history"><div className="space-y-4">{error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{error}</div>}<section className="surface-panel overflow-hidden"><div className="flex items-center gap-3 border-b p-5"><Input aria-label="Filter audit history" placeholder="Filter by action or record type" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="max-w-md" /><span className="text-sm text-muted-foreground">{total.toLocaleString("en-IN")} events</span></div>{loading ? <p className="p-5 text-sm text-muted-foreground">Loading audit history…</p> : items.length ? <div className="divide-y">{items.map((entry) => <article key={entry.id} className="grid gap-2 p-5 sm:grid-cols-[1fr_1fr_auto]"><div><p className="font-medium capitalize">{entry.action} · {entry.entity_table.replaceAll("_", " ")}</p><p className="mt-1 break-all text-xs text-muted-foreground">{entry.entity_id || "Settings"} · {entry.actor_user_id ? actors.get(entry.actor_user_id) ?? entry.actor_user_id : "System"}</p></div><p className="break-all text-xs text-muted-foreground">{JSON.stringify(entry.details)}</p><time className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString("en-IN")}</time></article>)}</div> : <p className="p-8 text-center text-sm text-muted-foreground">No audit events match the filter yet.</p>}<div className="flex items-center justify-between border-t px-5 py-3 text-sm"><span>Page {page + 1} of {pages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!page} onClick={() => setPage((x) => x - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((x) => x + 1)}>Next</Button></div></div></section></div></AppShell>;
}

const SETTING_LABELS: Array<{ key: "network_name" | "default_academic_year" | "support_email" | "support_phone"; label: string; placeholder: string }> = [
  { key: "network_name", label: "Network name", placeholder: "School network" },
  { key: "default_academic_year", label: "Default academic year", placeholder: "2026-27" },
  { key: "support_email", label: "Support email", placeholder: "support@example.com" },
  { key: "support_phone", label: "Support phone", placeholder: "+91…" },
];

function NetworkSettingsPage() {
  const { user } = useSessionUser();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error: queryError } = await supabase.from("network_settings").select("setting_key,setting_value");
    if (queryError) setError(applyError(queryError.message));
    else setValues(Object.fromEntries((data ?? []).map((x) => [x.setting_key, typeof x.setting_value === "string" ? x.setting_value : JSON.stringify(x.setting_value)])));
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      for (const setting of SETTING_LABELS) {
        const value = values[setting.key]?.trim() ?? "";
        const { error: saveError } = await supabase.from("network_settings").upsert({ setting_key: setting.key, setting_value: value, updated_by: user?.id ?? null, updated_at: new Date().toISOString() });
        if (saveError) throw saveError;
      }
      setSaved(true); await load();
    } catch (cause) { setError(applyError(cause instanceof Error ? cause.message : "Unable to save network settings.")); }
    finally { setSaving(false); }
  };
  return <AppShell title="Network Settings" subtitle="Central network defaults and contact information"><section className="surface-panel max-w-3xl space-y-5 p-6">{error && <div role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}<div><h2 className="font-display font-semibold">Organization details</h2><p className="mt-1 text-sm text-muted-foreground">These values are stored in the database and can be changed by Central Admin.</p></div>{loading ? <p className="text-sm text-muted-foreground">Loading settings…</p> : SETTING_LABELS.map((setting) => <label key={setting.key} className="block space-y-1.5 text-sm font-medium">{setting.label}<Input placeholder={setting.placeholder} value={values[setting.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [setting.key]: e.target.value }))} /></label>)}<div className="flex items-center gap-3"><Button disabled={loading || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save settings"}</Button>{saved && <span role="status" className="text-sm text-emerald-700">Settings saved. The change is recorded in Audit Logs.</span>}</div><p className="text-xs text-muted-foreground">Do not store passwords, service-role keys, or other secrets in these settings.</p></section></AppShell>;
}
