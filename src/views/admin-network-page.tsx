"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { inviteUser } from "@/lib/admin-api";
import { INDIAN_STATES_AND_UTS } from "@/lib/indian-states";

type Master = { id: string; name: string; status: string };
type Franchise = { id: string; name: string; status: string; master_franchise_id: string; territory_id: string | null };
type Territory = { id: string; territory: string; master_franchise_id: string };
type Owner = { id: string; user_id: string; master_franchise_id: string | null; franchise_id: string | null; full_name?: string | null | undefined; phone?: string | undefined };
type School = { id: string; name: string; code: string; city: string; state: string; status: string; franchise_id: string | null };
const message = (value: string) => /23505|duplicate key/i.test(value) ? "This territory already exists for this master franchise." : value;

export function AdminNetworkPage({ kind, id }: { kind: "master" | "franchise"; id?: string }) {
  const detail = !!id;
  const [masters, setMasters] = useState<Master[]>([]); const [franchises, setFranchises] = useState<Franchise[]>([]); const [territories, setTerritories] = useState<Territory[]>([]); const [schools, setSchools] = useState<School[]>([]); const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(""); const [status, setStatus] = useState("pending"); const [masterId, setMasterId] = useState(""); const [territoryId, setTerritoryId] = useState(""); const [newTerritory, setNewTerritory] = useState(""); const [ownerEmail, setOwnerEmail] = useState(""); const [ownerName, setOwnerName] = useState(""); const [schoolId, setSchoolId] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    const [masterResult, franchiseResult, territoryResult, schoolResult, ownerResult] = await Promise.all([
      supabase.from("master_franchises").select("id,name,status").order("name"), supabase.from("franchises").select("id,name,status,master_franchise_id,territory_id").order("name"), supabase.from("master_franchise_territories").select("id,territory,master_franchise_id").order("territory"), supabase.from("schools").select("id,name,code,city,state,status,franchise_id").order("name"), supabase.from("memberships").select("id,user_id,master_franchise_id,franchise_id").eq("role", "franchise_owner"),
    ]);
    const problem = masterResult.error ?? franchiseResult.error ?? territoryResult.error ?? schoolResult.error ?? ownerResult.error;
    if (problem) setError(problem.message); else {
      setMasters(masterResult.data ?? []); setFranchises(franchiseResult.data ?? []); setTerritories(territoryResult.data ?? []); setSchools(schoolResult.data ?? []);
      const rawOwners = ownerResult.data ?? []; const ids = [...new Set(rawOwners.map((item) => item.user_id))];
      const profileResult = ids.length ? await supabase.from("profiles").select("user_id,full_name,phone").in("user_id", ids) : { data: [], error: null };
      if (profileResult.error) setError(profileResult.error.message);
      const profileMap = new Map((profileResult.data ?? []).map((profile) => [profile.user_id, profile]));
      setOwners(rawOwners.map((item) => ({ ...item, full_name: profileMap.get(item.user_id)?.full_name, phone: profileMap.get(item.user_id)?.phone })));
      const record = kind === "master" ? masterResult.data?.find((item) => item.id === id) : franchiseResult.data?.find((item) => item.id === id);
      if (detail && record) { setName(record.name); setStatus(record.status); if (kind === "franchise") { setMasterId((record as Franchise).master_franchise_id); setTerritoryId((record as Franchise).territory_id ?? ""); } }
    }
    setLoading(false);
  }, [detail, id, kind]);
  useEffect(() => { void load(); }, [load]);
  const targetMasterId = kind === "master" ? id : masterId;
  const record = kind === "master" ? masters.find((item) => item.id === id) : franchises.find((item) => item.id === id);
  const ownOwners = owners.filter((item) => kind === "master" ? item.master_franchise_id === id : item.franchise_id === id);
  const createOrSave = async () => {
    if (!name.trim()) { setError("Enter a name."); return; }
    if (kind === "franchise" && !masterId) { setError("Choose a master franchise."); return; }
    setBusy(true); setError(null);
    try {
      let createdId = id;
      if (detail) {
        const result = kind === "master" ? await supabase.from("master_franchises").update({ name: name.trim(), status }).eq("id", id!) : await supabase.from("franchises").update({ name: name.trim(), status, master_franchise_id: masterId, territory_id: territoryId || null }).eq("id", id!);
        if (result.error) throw result.error;
      } else if (kind === "master") {
        const result = await supabase.from("master_franchises").insert({ name: name.trim(), status }).select("id").single(); if (result.error) throw result.error; createdId = result.data.id;
      } else { const result = await supabase.from("franchises").insert({ name: name.trim(), status, master_franchise_id: masterId, territory_id: territoryId || null }).select("id").single(); if (result.error) throw result.error; createdId = result.data.id; }
      if (newTerritory.trim() && (kind === "master" ? createdId : targetMasterId)) { const result = await supabase.from("master_franchise_territories").insert({ master_franchise_id: kind === "master" ? createdId! : targetMasterId!, territory: newTerritory.trim() }); if (result.error) throw result.error; }
      if (ownerEmail.trim()) {
        try { await inviteUser({ email: ownerEmail.trim(), full_name: ownerName.trim() || ownerEmail.trim(), role: "franchise_owner", scope_kind: kind === "master" ? "master" : "franchise", scope_id: createdId! }); }
        catch (cause) { throw new Error(`The network record was saved, but the owner invite failed: ${cause instanceof Error ? cause.message : "Unknown error"}`); }
      }
      setNewTerritory(""); setOwnerEmail(""); setOwnerName(""); if (!detail) { setName(""); setTerritoryId(""); }
      await load();
    } catch (cause) { setError(message(cause instanceof Error ? cause.message : "Unable to save this record.")); } finally { setBusy(false); }
  };
  const removeOwner = async (membershipId: string) => { if (!window.confirm("Remove this owner access?")) return; const result = await supabase.from("memberships").delete().eq("id", membershipId); if (result.error) setError(result.error.message); else await load(); };
  const removeTerritory = async (territory: Territory) => { if (!window.confirm(`Remove ${territory.territory}?`)) return; const result = await supabase.from("master_franchise_territories").delete().eq("id", territory.id); if (result.error) setError(result.error.message); else await load(); };
  const assignSchool = async () => { if (!schoolId || kind !== "franchise" || !id) return; setBusy(true); const result = await supabase.from("schools").update({ franchise_id: id }).eq("id", schoolId); setBusy(false); if (result.error) setError(result.error.message); else { setSchoolId(""); await load(); } };
  const title = kind === "master" ? "Master Franchises" : "Franchises";
  const rows = kind === "master" ? masters : franchises;
  return <AppShell title={detail ? (record?.name ?? title) : title} subtitle="Manage authorized network records, territories, owners, and school relationships"><div className="space-y-5">{error && <div role="alert" className="surface-panel p-4 text-sm text-destructive">{error}</div>}{detail && <Button asChild variant="outline"><Link href={kind === "master" ? "/admin/master-franchises" : "/admin/franchises"}>Back to directory</Link></Button>}<section className="surface-panel space-y-4 p-5"><h2 className="font-display font-semibold">{detail ? "Network details" : `Create ${kind === "master" ? "master franchise" : "franchise"}`}</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Input aria-label="Network name" placeholder="Network name" value={name} onChange={(event) => setName(event.target.value)} />{kind === "franchise" && <select aria-label="Master franchise" className="h-10 rounded-md border bg-background px-3 text-sm" value={masterId} onChange={(event) => { setMasterId(event.target.value); setTerritoryId(""); }}><option value="">Select master franchise</option>{masters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}<select aria-label="Status" className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>{["pending", "active", "suspended", "inactive"].map((item) => <option key={item}>{item}</option>)}</select>{kind === "franchise" ? <select aria-label="Territory" className="h-10 rounded-md border bg-background px-3 text-sm" value={territoryId} onChange={(event) => setTerritoryId(event.target.value)}><option value="">No territory assigned</option>{territories.filter((item) => item.master_franchise_id === masterId).map((item) => <option key={item.id} value={item.id}>{item.territory}</option>)}</select> : <><Input list="indian-states" aria-label="New territory" placeholder="Add territory (optional)" value={newTerritory} onChange={(event) => setNewTerritory(event.target.value)} /><datalist id="indian-states">{INDIAN_STATES_AND_UTS.map((item) => <option key={item} value={item} />)}</datalist></>}<Input aria-label="Owner email" type="email" placeholder="Owner email (optional)" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} /><Input aria-label="Owner full name" placeholder="Owner full name" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} /></div><Button disabled={busy} onClick={() => void createOrSave()}>{busy ? "Saving…" : detail ? "Save details" : "Create network"}</Button></section>{detail ? <><section className="surface-panel p-5"><h2 className="font-display font-semibold">Assigned owners</h2>{ownOwners.length ? <div className="mt-3 space-y-2">{ownOwners.map((item) => <div key={item.id} className="flex justify-between gap-3 rounded border p-3 text-sm"><span>{item.full_name || "Name not set"}{item.phone ? ` · ${item.phone}` : ""}</span><Button size="sm" variant="outline" onClick={() => void removeOwner(item.id)}>Remove owner</Button></div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">No owner has been assigned.</p>}</section>{kind === "master" && <section className="surface-panel p-5"><h2 className="font-display font-semibold">Authorized territories</h2><div className="mt-3 flex flex-wrap gap-2">{territories.filter((item) => item.master_franchise_id === id).map((item) => <span key={item.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">{item.territory}<button aria-label={`Remove ${item.territory}`} onClick={() => void removeTerritory(item)}>×</button></span>) || <p className="text-sm text-muted-foreground">No territories.</p>}</div></section>}{kind === "franchise" && <section className="surface-panel flex flex-wrap gap-3 p-5"><select aria-label="Assign school" className="h-10 rounded-md border bg-background px-3 text-sm" value={schoolId} onChange={(event) => setSchoolId(event.target.value)}><option value="">Assign an unlinked school</option>{schools.filter((item) => !item.franchise_id || item.franchise_id === id).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select><Button disabled={!schoolId || busy} onClick={() => void assignSchool()}>Assign school</Button></section>}<section className="surface-panel overflow-hidden"><div className="border-b p-5"><h2 className="font-display font-semibold">Schools in this network</h2></div>{schools.filter((item) => kind === "master" ? franchises.some((franchise) => franchise.master_franchise_id === id && franchise.id === item.franchise_id) : item.franchise_id === id).map((item) => <div key={item.id} className="flex justify-between border-b p-4 text-sm"><span>{item.name} · {item.code}</span><span className="capitalize">{item.status}</span></div>) || <p className="p-5 text-sm text-muted-foreground">No linked schools.</p>}</section></> : <section className="surface-panel overflow-hidden"><div className="divide-y">{rows.map((item) => <article key={item.id} className="flex items-center justify-between gap-4 p-5"><div><Link className="font-medium text-primary hover:underline" href={kind === "master" ? `/admin/master-franchises/${item.id}` : `/admin/franchises/${item.id}`}>{item.name}</Link><p className="text-xs capitalize text-muted-foreground">{item.status}</p></div><Button asChild size="sm" variant="outline"><Link href={`/franchise/dashboard?${kind === "master" ? "masterFranchiseId" : "franchiseId"}=${item.id}`}>Dashboard</Link></Button></article>)}{!loading && rows.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No network records yet.</p>}</div></section>}</div></AppShell>;
}
