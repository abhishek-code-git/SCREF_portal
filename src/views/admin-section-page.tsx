"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { AdminToolsPage } from "@/views/admin-tools-page";
import { AdminNetworkPage } from "@/views/admin-network-page";
import { AdminSchoolsPage } from "@/views/admin-schools-page";

type Master = { id: string; name: string; status: string; created_at: string };
type Territory = { id: string; master_franchise_id: string; territory: string };
type Franchise = { id: string; master_franchise_id: string; territory_id: string | null; name: string; status: string; created_at: string };
type School = { id: string; franchise_id: string | null; code: string; name: string; city: string; state: string; status: string; academic_year: string };
type Owner = { user_id: string; full_name: string | null; phone: string; master_franchise_id: string | null; franchise_id: string | null };

const PAGE_SIZE = 20;
const errorText = (message: string) => /does not exist|schema cache|could not find/i.test(message)
  ? `${message} Apply 20261113000001_central_admin_network_foundation.sql, then 20261115000001_network_management_read_models.sql in the new Supabase project, then reload this page.`
  : message;
const statusClass = (status: string) => status === "active" ? "text-emerald-700" : status === "suspended" || status === "inactive" ? "text-destructive" : "text-amber-700";

export function AdminSectionPage({ section }: { section: string }) {
  const params = useParams<{ id?: string }>();
  if (section === "master-franchises") return <AdminNetworkPage kind="master" />;
  if (section === "franchises") return <AdminNetworkPage kind="franchise" />;
  if (section === "master-franchise-detail" && params.id) return <AdminNetworkPage kind="master" id={params.id} />;
  if (section === "franchise-detail" && params.id) return <AdminNetworkPage kind="franchise" id={params.id} />;
  if (section === "schools") return <AdminSchoolsPage />;
  if (["users", "reports", "onboarding", "audit", "settings"].includes(section)) return <AdminToolsPage section={section} />;
  return <AppShell title={section === "master-franchise-detail" ? "Master Franchise" : "Franchise"} subtitle="Central administration"><p className="surface-panel p-5 text-sm text-muted-foreground">Select a network record from its directory.</p></AppShell>;
}

function NetworkDirectory({ kind }: { kind: "master-franchises" | "franchises" }) {
  const masterMode = kind === "master-franchises";
  const [masters, setMasters] = useState<Master[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [directoryRows, setDirectoryRows] = useState<Array<Master | Franchise>>([]);
  const [rowCount, setRowCount] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [territory, setTerritory] = useState("");
  const [masterId, setMasterId] = useState("");
  const [ownerId, setOwnerId] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [m, f, t, o, s] = await Promise.all([
      supabase.from("master_franchises").select("id,name,status,created_at").order("created_at", { ascending: false }),
      masterMode ? supabase.from("franchises").select("id,master_franchise_id,territory_id,name,status,created_at").order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
      supabase.from("master_franchise_territories").select("id,master_franchise_id,territory").order("territory"),
      supabase.from("memberships").select("user_id,master_franchise_id,franchise_id").eq("role", "franchise_owner"),
      masterMode ? supabase.from("schools").select("id,franchise_id,code,name,city,state,status,academic_year") : Promise.resolve({ data: [], error: null }),
    ]);
    let listResult;
    if (masterMode) {
      let query = supabase.from("master_franchises").select("id,name,status,created_at", { count: "exact" }).order("created_at", { ascending: false });
      if (status !== "all") query = query.eq("status", status);
      if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
      listResult = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    } else {
      let query = supabase.from("franchises").select("id,master_franchise_id,territory_id,name,status,created_at", { count: "exact" }).order("created_at", { ascending: false });
      if (status !== "all") query = query.eq("status", status);
      if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
      listResult = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    }
    const e = m.error ?? f.error ?? t.error ?? o.error ?? s.error ?? listResult.error;
    if (e) setError(errorText(e.message));
    else {
      setMasters((m.data ?? []) as Master[]); setFranchises((f.data ?? []) as Franchise[]); setTerritories((t.data ?? []) as Territory[]);
      setDirectoryRows((listResult.data ?? []) as Array<Master | Franchise>); setRowCount(listResult.count ?? 0);
      const memberships = (o.data ?? []) as Array<{ user_id: string; master_franchise_id: string | null; franchise_id: string | null }>;
      const { data: profileRows, error: profileError } = memberships.length ? await supabase.from("profiles").select("user_id,full_name,phone").in("user_id", [...new Set(memberships.map((x) => x.user_id))]) : { data: [], error: null };
      if (profileError) setError(errorText(profileError.message));
      const profileByUser = new Map((profileRows ?? []).map((p) => [p.user_id, p]));
      setOwners(memberships.map((x) => ({ ...x, full_name: profileByUser.get(x.user_id)?.full_name ?? null, phone: profileByUser.get(x.user_id)?.phone ?? "" })));
      setSchools((s.data ?? []) as School[]);
    }
    setLoading(false);
  }, [masterMode, page, search, status]);
  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(rowCount / PAGE_SIZE));
  const pageRows = directoryRows;

  const create = async () => {
    if (!name.trim()) { setError("Enter a name before saving."); return; }
    if (!masterMode && !masterId) { setError("Choose the master franchise for this franchise."); return; }
    setBusy(true); setError(null);
    try {
      if (masterMode) {
        const { data, error: insertError } = await supabase.from("master_franchises").insert({ name: name.trim(), status: "pending" }).select("id").single();
        if (insertError) throw insertError;
        if (territory.trim()) {
          const { error: territoryError } = await supabase.from("master_franchise_territories").insert({ master_franchise_id: data.id, territory: territory.trim() });
          if (territoryError) throw territoryError;
        }
        if (ownerId.trim()) {
          const { error: ownerError } = await supabase.from("memberships").insert({ user_id: ownerId.trim(), role: "franchise_owner", master_franchise_id: data.id });
          if (ownerError) throw ownerError;
        }
      } else {
        const { data, error: insertError } = await supabase.from("franchises").insert({ name: name.trim(), master_franchise_id: masterId, territory_id: territory || null, status: "pending" }).select("id").single();
        if (insertError) throw insertError;
        if (ownerId.trim()) {
          const { error: ownerError } = await supabase.from("memberships").insert({ user_id: ownerId.trim(), role: "franchise_owner", franchise_id: data.id });
          if (ownerError) throw ownerError;
        }
      }
      setName(""); setTerritory(""); setOwnerId(""); await load();
    } catch (cause) { setError(errorText(cause instanceof Error ? cause.message : "Unable to create network record.")); }
    finally { setBusy(false); }
  };

  const setRecordStatus = async (row: Master | Franchise) => {
    const next = row.status === "active" ? "suspended" : "active";
    const result = masterMode
      ? await supabase.from("master_franchises").update({ status: next }).eq("id", row.id)
      : await supabase.from("franchises").update({ status: next }).eq("id", row.id);
    if (result.error) setError(errorText(result.error.message)); else await load();
  };

  return <AppShell title={masterMode ? "Master Franchises" : "Franchises"} subtitle="Database-backed network management">
    <div className="space-y-5">
      {error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{error}</div>}
      <section className="surface-panel space-y-4 p-5">
        <h2 className="font-display font-semibold">{masterMode ? "Create master franchise" : "Create franchise"}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Input aria-label="Network name" placeholder={masterMode ? "Master franchise name" : "Franchise name"} value={name} onChange={(e) => setName(e.target.value)} />
          {!masterMode && <select aria-label="Master franchise" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={masterId} onChange={(e) => { setMasterId(e.target.value); setTerritory(""); }}><option value="">Select master franchise</option>{masters.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>}
          {masterMode ? <Input aria-label="Initial territory" placeholder="Initial territory (optional)" value={territory} onChange={(e) => setTerritory(e.target.value)} /> : <select aria-label="Territory" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={territory} onChange={(e) => setTerritory(e.target.value)}><option value="">No territory assigned</option>{territories.filter((t) => t.master_franchise_id === masterId).map((t) => <option key={t.id} value={t.id}>{t.territory}</option>)}</select>}
          <Input aria-label="Existing Auth user ID" placeholder="Owner Auth user UUID (optional)" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3"><Button onClick={() => void create()} disabled={busy}>{busy ? "Saving…" : masterMode ? "Create master franchise" : "Create franchise"}</Button><p className="text-xs text-muted-foreground">Owner assignment uses an existing Supabase Auth user UUID. A new network starts as pending.</p></div>
      </section>
      <section className="surface-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row"><Input aria-label="Search" placeholder="Search by name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="sm:max-w-sm" /><select aria-label="Filter by status" className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="all">All statuses</option>{["pending", "active", "suspended", "inactive"].map((s) => <option key={s} value={s}>{s}</option>)}</select><p className="self-center text-sm text-muted-foreground">{rowCount.toLocaleString("en-IN")} records</p></div>
        {loading ? <p className="p-5 text-sm text-muted-foreground">Loading authorized records…</p> : pageRows.length === 0 ? <div className="p-8 text-center"><h3 className="font-medium">No {masterMode ? "master franchises" : "franchises"} found</h3><p className="mt-1 text-sm text-muted-foreground">Create a record above to begin building the network.</p></div> : <div className="divide-y divide-border">{pageRows.map((row) => {
          const parentId = masterMode ? row.id : (row as Franchise).master_franchise_id;
          const relatedCount = masterMode ? franchises.filter((f) => f.master_franchise_id === row.id).length : 0;
          const relatedSchools = masterMode ? schools.filter((s) => franchises.some((f) => f.master_franchise_id === row.id && f.id === s.franchise_id)).length : 0;
          const rowOwners = owners.filter((o) => masterMode ? o.master_franchise_id === row.id : o.franchise_id === row.id);
          return <article key={row.id} className="flex flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center"><div className="min-w-0"><Link className="font-medium text-primary hover:underline" href={masterMode ? `/admin/master-franchises/${row.id}` : `/admin/franchises/${row.id}`}>{row.name}</Link><p className="mt-1 text-xs text-muted-foreground">{masterMode ? `${relatedCount} franchises · ${relatedSchools} schools` : (masters.find((m) => m.id === parentId)?.name ?? "Master franchise")} · {rowOwners.map((o) => o.full_name || o.user_id.slice(0, 8)).join(", ") || "Owner not assigned"}</p><p className={`mt-1 text-xs capitalize ${statusClass(row.status)}`}>{row.status}</p></div><div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href={`/franchise/dashboard?${masterMode ? "masterFranchiseId" : "franchiseId"}=${row.id}`}>Open dashboard</Link></Button><Button size="sm" variant="outline" onClick={() => void setRecordStatus(row)}>{row.status === "active" ? "Suspend" : "Activate"}</Button></div></article>;
        })}</div>}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm"><span className="text-muted-foreground">Page {page + 1} of {totalPages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>
      </section>
    </div>
  </AppShell>;
}

function NetworkDetail({ kind, id }: { kind: "master" | "franchise"; id: string }) {
  const [master, setMaster] = useState<Master | null>(null);
  const [franchise, setFranchise] = useState<Franchise | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [availableSchools, setAvailableSchools] = useState<School[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [newTerritory, setNewTerritory] = useState("");
  const [territoryId, setTerritoryId] = useState("");
  const [schoolToAssign, setSchoolToAssign] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [m, f, t, s, o] = await Promise.all([
      kind === "master" ? supabase.from("master_franchises").select("id,name,status,created_at").eq("id", id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      kind === "franchise" ? supabase.from("franchises").select("id,master_franchise_id,territory_id,name,status,created_at").eq("id", id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      supabase.from("master_franchise_territories").select("id,master_franchise_id,territory").order("territory"),
      supabase.from("schools").select("id,franchise_id,code,name,city,state,status,academic_year").order("name"),
      supabase.from("memberships").select("user_id,master_franchise_id,franchise_id").eq("role", "franchise_owner"),
    ]);
    const masterRow = m.data as Master | null; const franchiseRow = f.data as Franchise | null;
    const masterKey = kind === "master" ? id : franchiseRow?.master_franchise_id;
    const parentResult = kind === "franchise" && masterKey ? await supabase.from("master_franchises").select("id,name,status,created_at").eq("id", masterKey).maybeSingle() : { data: null, error: null };
    const fResult = kind === "master" && masterKey ? await supabase.from("franchises").select("id,master_franchise_id,territory_id,name,status,created_at").eq("master_franchise_id", masterKey) : { data: [], error: null };
    const errs = [m.error, f.error, t.error, s.error, o.error, fResult.error, parentResult.error].filter(Boolean);
    if (errs.length) setError(errorText(errs[0]!.message));
    else {
      setMaster(masterRow ?? parentResult.data as Master | null); setFranchise(franchiseRow); setName(masterRow?.name ?? franchiseRow?.name ?? ""); setTerritoryId(franchiseRow?.territory_id ?? "");
      setTerritories(((t.data ?? []) as Territory[]).filter((x) => x.master_franchise_id === masterKey));
      setFranchises((fResult.data ?? []) as Franchise[]);
      const franchiseIds = kind === "master" ? ((fResult.data ?? []) as Franchise[]).map((x) => x.id) : [id];
      const allVisibleSchools = (s.data ?? []) as School[];
      setAvailableSchools(allVisibleSchools);
      setSchools(allVisibleSchools.filter((x) => x.franchise_id && franchiseIds.includes(x.franchise_id)));
      const memberships = (o.data ?? []) as Array<{ user_id: string; master_franchise_id: string | null; franchise_id: string | null }>;
      const scopedMemberships = memberships.filter((x) => kind === "master" ? x.master_franchise_id === id : x.franchise_id === id);
      const { data: profileRows, error: profileError } = scopedMemberships.length ? await supabase.from("profiles").select("user_id,full_name,phone").in("user_id", [...new Set(scopedMemberships.map((x) => x.user_id))]) : { data: [], error: null };
      if (profileError) setError(errorText(profileError.message));
      const profileByUser = new Map((profileRows ?? []).map((p) => [p.user_id, p]));
      setOwners(scopedMemberships.map((x) => ({ ...x, full_name: profileByUser.get(x.user_id)?.full_name ?? null, phone: profileByUser.get(x.user_id)?.phone ?? "" })));
    }
    setLoading(false);
  }, [id, kind]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const entity = kind === "master" ? master : franchise;
      if (!entity) throw new Error("Network record was not found.");
      const result = kind === "master" ? await supabase.from("master_franchises").update({ name: name.trim() }).eq("id", id) : await supabase.from("franchises").update({ name: name.trim(), territory_id: territoryId || null }).eq("id", id);
      if (result.error) throw result.error;
      if (newTerritory.trim() && kind === "master") {
        const { error: terrError } = await supabase.from("master_franchise_territories").insert({ master_franchise_id: id, territory: newTerritory.trim() });
        if (terrError) throw terrError;
      }
      if (ownerId.trim()) {
        const { error: ownerError } = await supabase.from("memberships").insert({ user_id: ownerId.trim(), role: "franchise_owner", ...(kind === "master" ? { master_franchise_id: id } : { franchise_id: id }) });
        if (ownerError) throw ownerError;
      }
      setNewTerritory(""); setOwnerId(""); await load();
    } catch (cause) { setError(errorText(cause instanceof Error ? cause.message : "Unable to save network details.")); }
    finally { setBusy(false); }
  };

  const record = kind === "master" ? master : franchise;
  const title = record?.name ?? (kind === "master" ? "Master Franchise" : "Franchise");
  const schoolsActive = schools.filter((s) => s.status.toLowerCase() === "active").length;
  const ownerMemberships = kind === "master" ? owners.length : owners.length;
  return <AppShell title={title} subtitle={kind === "master" ? "Master franchise network profile" : "Franchise network profile"}>
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={kind === "master" ? "/admin/master-franchises" : "/admin/franchises"}>Back to directory</Link></Button><Button asChild><Link href={kind === "master" ? `/master/dashboard?masterFranchiseId=${id}` : `/franchise/dashboard?franchiseId=${id}`}>Open network dashboard</Link></Button></div>
      {error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{error}</div>}
      {loading ? <section className="surface-panel p-5 text-sm text-muted-foreground">Loading network profile…</section> : !record ? <section className="surface-panel p-5 text-sm text-muted-foreground">No authorized network record was found.</section> : <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Status", record.status], [kind === "master" ? "Franchises" : "Master franchise", kind === "master" ? franchises.length : (mastersafe(master, franchise))], ["Schools", schools.length], ["Active schools", schoolsActive]].map(([label, value]) => <article key={label} className="surface-panel p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></article>)}</section>
        <section className="surface-panel space-y-4 p-5"><h2 className="font-display font-semibold">Network details and access</h2><div className="grid gap-3 sm:grid-cols-2"><Input aria-label="Network name" value={name} onChange={(e) => setName(e.target.value)} />{kind === "master" ? <Input aria-label="Add territory" placeholder="Add territory" value={newTerritory} onChange={(e) => setNewTerritory(e.target.value)} /> : <select aria-label="Franchise territory" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={territoryId} onChange={(e) => setTerritoryId(e.target.value)}><option value="">No territory assigned</option>{territories.map((t) => <option key={t.id} value={t.id}>{t.territory}</option>)}</select>}<Input aria-label="Assign existing owner" placeholder="Assign existing owner by Auth user UUID" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} /></div><Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save details"}</Button><div><h3 className="text-sm font-medium">Assigned owners</h3>{owners.length ? owners.map((o) => <p key={o.user_id} className="mt-1 text-sm text-muted-foreground">{o.full_name || "Name not set"} · {o.phone || "Phone not set"} · {o.user_id}</p>) : <p className="mt-1 text-sm text-muted-foreground">No owner membership assigned.</p>}</div>{kind === "master" && <div><h3 className="text-sm font-medium">Authorized territories</h3>{territories.length ? <div className="mt-2 flex flex-wrap gap-2">{territories.map((t) => <span key={t.id} className="rounded-full border px-3 py-1 text-sm">{t.territory}</span>)}</div> : <p className="mt-1 text-sm text-muted-foreground">No territories assigned.</p>}</div>}</section>
        {kind === "master" && <section className="surface-panel overflow-hidden"><div className="border-b border-border p-5"><h2 className="font-display font-semibold">Franchises in this network</h2></div>{franchises.length ? franchises.map((f) => <div key={f.id} className="flex items-center justify-between gap-3 border-b p-4 last:border-0"><div><Link className="font-medium text-primary hover:underline" href={`/admin/franchises/${f.id}`}>{f.name}</Link><p className="text-xs capitalize text-muted-foreground">{f.status} · {territories.find((t) => t.id === f.territory_id)?.territory ?? "Territory not set"}</p></div><Button asChild size="sm" variant="outline"><Link href={`/franchise/dashboard?franchiseId=${f.id}`}>Dashboard</Link></Button></div>) : <p className="p-5 text-sm text-muted-foreground">No franchises are assigned to this master franchise.</p>}</section>}
        {kind === "franchise" && <section className="surface-panel flex flex-col gap-3 p-5 sm:flex-row"><select aria-label="Assign existing school" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={schoolToAssign} onChange={(e) => setSchoolToAssign(e.target.value)}><option value="">Select an unassigned school</option>{availableSchools.filter((s) => !s.franchise_id || s.franchise_id === id).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.code}{s.franchise_id === id ? " (already assigned)" : ""}</option>)}</select><Button disabled={!schoolToAssign || busy} onClick={async () => { setBusy(true); const { error: assignError } = await supabase.from("schools").update({ franchise_id: id }).eq("id", schoolToAssign); if (assignError) setError(errorText(assignError.message)); else { setSchoolToAssign(""); await load(); } setBusy(false); }}>Assign school</Button><p className="self-center text-xs text-muted-foreground">Only currently unassigned schools or schools already in this franchise are selectable.</p></section>}
        <section className="surface-panel overflow-hidden"><div className="border-b border-border p-5"><h2 className="font-display font-semibold">Schools in this network</h2></div>{schools.length ? schools.map((s) => <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-0"><div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.code} · {[s.city, s.state].filter(Boolean).join(", ")} · {s.academic_year}</p></div><span className={`text-sm capitalize ${statusClass(s.status)}`}>{s.status}</span></div>) : <p className="p-5 text-sm text-muted-foreground">No schools are linked yet. Assign a franchise to a school to include it in this network.</p>}</section>
      </>}
    </div>
  </AppShell>;
}

function mastersafe(master: Master | null, franchise: Franchise | null) { return master?.name ?? (franchise ? "Linked master franchise" : "Not found"); }
