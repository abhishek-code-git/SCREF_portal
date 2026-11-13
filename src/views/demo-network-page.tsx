import Link from "next/link";
import { ArrowUpRight, Building2, GraduationCap, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { demoNetwork, demoNetworkTotals, type DemoSchool } from "@/lib/demo-network";

const overviewCards: { label: string; value: number | string; icon: LucideIcon }[] = [
  { label: "Master franchises", value: demoNetworkTotals.masterFranchises, icon: Building2 },
  { label: "Franchises", value: demoNetworkTotals.franchises, icon: Building2 },
  { label: "Schools", value: demoNetworkTotals.schools, icon: Building2 },
  { label: "Students", value: demoNetworkTotals.students, icon: GraduationCap },
  { label: "Teachers · Principals", value: demoNetworkTotals.teachers + " · " + demoNetworkTotals.principals, icon: Users },
];

function statusClasses(status: string) {
  if (status === "Active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (status === "Onboarding" || status === "Pending") return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  return "border-muted bg-muted text-muted-foreground";
}

function statusPill(status: string) {
  return <span className={"inline-flex rounded-full border px-2.5 py-1 text-xs font-medium " + statusClasses(status)}>{status}</span>;
}

function uniquePeopleCount(schools: DemoSchool[], kind: "teachers" | "principals") {
  const ids = kind === "teachers"
    ? schools.flatMap((school) => school.teachers.map((teacher) => teacher.id))
    : schools.map((school) => school.principal.id);
  return new Set(ids).size;
}

function uniqueStudentCount(schools: DemoSchool[]) {
  return new Set(schools.flatMap((school) => school.students.map((student) => student.id))).size;
}

export function DemoNetworkPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <BrandLockup subtitle="Illustrative network preview" />
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800">Demo data</span>
            <Link className="text-sm font-medium text-primary hover:underline" href="/login">Sign in to live portal</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-5 py-8">
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5" role="note">
          <p className="font-semibold">Fictional demo records — not connected to Supabase</p>
          <p className="mt-1 text-sm text-muted-foreground">This presentation-only hierarchy is isolated from authentication, real profiles, and database-backed dashboards. Counts below are calculated from the fixture records shown on this page.</p>
        </section>

        <section className="space-y-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Central administration</p><h1 className="mt-1 font-display text-3xl font-semibold">Network overview</h1><p className="mt-2 text-sm text-muted-foreground">Super Admin → Master Franchise → Franchise → School → Principal → Teacher → Student</p></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {overviewCards.map(({ label, value, icon: MetricIcon }) => <article key={label} className="surface-panel p-5"><div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><MetricIcon className="h-4 w-4 text-muted-foreground" /></div><p className="mt-3 font-display text-2xl font-semibold tabular-nums">{value}</p></article>)}
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-md border border-border px-3 py-2">Active schools: {demoNetworkTotals.activeSchools}</span>
            <span className="rounded-md border border-border px-3 py-2">Pending schools: {demoNetworkTotals.pendingSchools}</span>
            <span className="rounded-md border border-border px-3 py-2">Inactive schools: {demoNetworkTotals.inactiveSchools}</span>
          </div>
        </section>

        <section className="surface-panel flex flex-wrap items-center gap-4 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><p className="font-semibold">Super Admin · {demoNetwork.superAdmin.name}</p><p className="text-sm text-muted-foreground">{demoNetwork.superAdmin.email} · central network oversight</p></div>
          <span className="text-xs text-muted-foreground">Demo identity only; no login is available for this fixture.</span>
        </section>

        <section id="master-franchises" className="space-y-4">
          <div><h2 className="font-display text-2xl font-semibold">Master franchises</h2><p className="mt-1 text-sm text-muted-foreground">Each owner sees only the illustrative franchises nested under their demo profile.</p></div>
          {demoNetwork.masterFranchises.map((master) => {
            const schools = master.franchises.flatMap((franchise) => franchise.schools);
            return <article key={master.id} className="surface-panel overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5">
                <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Master Franchise</p><h3 className="mt-1 font-display text-xl font-semibold">{master.name}</h3><p className="mt-1 text-sm text-muted-foreground">Owner: {master.owner.name} · {master.owner.email}</p><p className="mt-1 text-sm text-muted-foreground">Territories: {master.territories.join(", ")}</p></div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm"><span>Franchises <strong>{master.franchises.length}</strong></span><span>Schools <strong>{schools.length}</strong></span><span>Students <strong>{uniqueStudentCount(schools)}</strong></span><span>Teachers <strong>{uniquePeopleCount(schools, "teachers")}</strong></span><span>Principals <strong>{uniquePeopleCount(schools, "principals")}</strong></span></div>
              </div>
              <div className="space-y-5 p-5">
                {master.franchises.map((franchise) => <div key={franchise.id} className="rounded-lg border border-border p-4">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><div><h4 className="font-semibold">{franchise.name}</h4><p className="text-xs text-muted-foreground">Territory: {franchise.territory}</p></div><p className="text-xs text-muted-foreground">{franchise.schools.length} assigned demo school{franchise.schools.length === 1 ? "" : "s"}</p></div>
                  <div className="space-y-3">
                    {franchise.schools.map((school) => <SchoolCard key={school.id} school={school} />)}
                  </div>
                </div>)}
              </div>
            </article>;
          })}
        </section>
      </div>
    </main>
  );
}

function SchoolCard({ school }: { school: DemoSchool }) {
  const attendance = school.attendance.total
    ? Math.round((school.attendance.present / school.attendance.total) * 100) + "%"
    : "No records";
  return (
    <details className="rounded-lg border border-border bg-background">
      <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-4">
        <span className="min-w-0 flex-1"><span className="block font-medium">{school.name}</span><span className="text-xs text-muted-foreground">{school.city} · {school.academicYear}</span></span>
        {statusPill(school.status)}
        <span className="text-xs text-muted-foreground">{school.students.length} students · {school.teachers.length} teacher assignments</span>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
      </summary>
      <div className="grid gap-5 border-t border-border p-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div><h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Principal</h5><p className="mt-1 text-sm font-medium">{school.principal.name}</p><p className="text-sm text-muted-foreground">{school.principal.email}</p></div>
          <div><h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">School summary</h5><p className="mt-1 text-sm">{school.classes.length} classes · attendance today {attendance}</p></div>
          <div><h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Teachers</h5><ul className="mt-1 space-y-1 text-sm">{school.teachers.map((teacher) => <li key={teacher.id}>{teacher.name} <span className="text-muted-foreground">· {teacher.subject}</span></li>)}</ul></div>
          {school.onboardingTasks.length > 0 && <div><h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Onboarding tasks</h5><ul className="mt-1 list-inside list-disc space-y-1 text-sm">{school.onboardingTasks.map((task) => <li key={task}>{task}</li>)}</ul></div>}
        </div>
        <div><h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Students</h5><div className="mt-2 overflow-hidden rounded-md border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Class</th><th className="px-3 py-2 font-medium">Status</th></tr></thead><tbody className="divide-y divide-border">{school.students.map((student) => <tr key={student.id}><td className="px-3 py-2">{student.name}</td><td className="px-3 py-2">{student.className}</td><td className="px-3 py-2">{statusPill(student.status)}</td></tr>)}</tbody></table></div></div>
      </div>
    </details>
  );
}
