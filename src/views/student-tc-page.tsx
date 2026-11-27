"use client";

import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Panel, PrincipalBreadcrumb } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { useSchoolContext } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";

type TcRow = {
  id: string;
  tc_no: string;
  issued_on: string;
  reason: string;
  conduct: string;
  class_at_leaving: string;
  remarks: string;
};

type StudentMini = {
  id: string;
  admission_no: string | null;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  parent_name: string;
  guardian_name: string;
  admitted_on: string;
  left_on: string | null;
};

export function StudentTcPage({ studentId }: { studentId: string }) {
  const { activeSchool, ready, error: accessError } = useSchoolContext();

  const tcQuery = useQuery({
    queryKey: ["student-tc", activeSchool?.id, studentId],
    enabled: !!activeSchool && !!studentId,
    queryFn: async () => {
      if (!activeSchool) return null;
      const [studRes, tcRes] = await Promise.all([
        supabase
          .from("students")
          .select("id,admission_no,full_name,date_of_birth,gender,parent_name,guardian_name,admitted_on,left_on")
          .eq("id", studentId)
          .eq("school_id", activeSchool.id)
          .maybeSingle(),
        supabase
          .from("transfer_certificates")
          .select("id,tc_no,issued_on,reason,conduct,class_at_leaving,remarks")
          .eq("student_id", studentId)
          .eq("school_id", activeSchool.id)
          .maybeSingle(),
      ]);
      const err = studRes.error ?? tcRes.error;
      if (err) throw err;
      if (!studRes.data || !tcRes.data) return null;
      return { student: studRes.data as StudentMini, tc: tcRes.data as TcRow };
    },
  });

  if (!ready) return <AppShell title="Transfer Certificate"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (accessError) return <AppShell title="Transfer Certificate"><Panel title="Error">{accessError}</Panel></AppShell>;
  if (!activeSchool) return <AppShell title="Transfer Certificate"><Panel title="No school">Assign a school first.</Panel></AppShell>;

  const data = tcQuery.data;

  return (
    <AppShell
      title="Transfer Certificate"
      subtitle={data ? `${data.tc.tc_no} · ${data.student.full_name}` : activeSchool.name}
      actions={
        data && (
          <Button size="sm" className="print:hidden" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" /> Print / Save as PDF
          </Button>
        )
      }
    >
      <div className="space-y-6">
        <PrincipalBreadcrumb
          items={[
            { label: "Students", href: "/students" },
            { label: data?.student.full_name ?? "Student", href: `/students/${studentId}` },
            { label: "Transfer Certificate" },
          ]}
        />

        {tcQuery.isPending ? (
          <div className="surface-panel h-60 animate-pulse" />
        ) : tcQuery.error ? (
          <Panel title="Unable to load certificate">{tcQuery.error.message}</Panel>
        ) : !data ? (
          <Panel title="No transfer certificate issued">
            <p className="text-sm text-muted-foreground">
              A transfer certificate has not been issued for this student yet.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-4">
              <Link href={`/students/${studentId}`}>Back to student profile</Link>
            </Button>
          </Panel>
        ) : (
          <article className="mx-auto max-w-3xl rounded-xl border-2 border-foreground/25 bg-card p-8 shadow-card print:border-black print:shadow-none">
            <header className="border-b-2 border-border pb-5 text-center print:border-black">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                The Centennial School Network
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold">{activeSchool.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                School Code: {activeSchool.code}
                {activeSchool.address ? ` · ${activeSchool.address}` : ""}
                {activeSchool.city ? `, ${activeSchool.city}` : ""}
                {activeSchool.state ? `, ${activeSchool.state}` : ""}
              </p>
              {(activeSchool.phone || activeSchool.email) && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[activeSchool.phone, activeSchool.email].filter(Boolean).join(" · ")}
                </p>
              )}
              <p className="mt-4 inline-block rounded border border-border px-4 py-1 text-sm font-bold uppercase tracking-widest">
                Transfer Certificate
              </p>
            </header>

            <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">TC Number:</span>{" "}
                <strong className="font-mono">{data.tc.tc_no}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Date of Issue:</span>{" "}
                <strong>{data.tc.issued_on}</strong>
              </p>
            </div>

            <dl className="mt-6 grid gap-3 border-t border-border pt-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Name of Student</dt>
                <dd className="font-semibold">{data.student.full_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Admission Number</dt>
                <dd className="font-mono font-semibold">{data.student.admission_no ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Parent / Guardian Name</dt>
                <dd className="font-medium">{data.student.guardian_name || data.student.parent_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Date of Birth</dt>
                <dd className="font-medium">{data.student.date_of_birth ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Gender</dt>
                <dd className="font-medium capitalize">{data.student.gender ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Class at Time of Leaving</dt>
                <dd className="font-medium">{data.tc.class_at_leaving || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Date of Admission</dt>
                <dd className="font-medium">{data.student.admitted_on}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Date of Leaving</dt>
                <dd className="font-medium">{data.student.left_on ?? data.tc.issued_on}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">General Conduct</dt>
                <dd className="font-medium">{data.tc.conduct}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Reason for Leaving</dt>
                <dd className="font-medium">{data.tc.reason}</dd>
              </div>
              {data.tc.remarks && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Remarks</dt>
                  <dd className="font-medium">{data.tc.remarks}</dd>
                </div>
              )}
            </dl>

            <footer className="mt-14 grid grid-cols-3 gap-6 border-t border-border pt-8 text-center text-xs text-muted-foreground">
              <div>
                <div className="mx-auto mb-2 h-8 border-b border-foreground/40" />
                Prepared by
              </div>
              <div>
                <div className="mx-auto mb-2 h-8 border-b border-foreground/40" />
                Class Teacher
              </div>
              <div>
                <div className="mx-auto mb-2 h-8 border-b border-foreground/40" />
                Principal {activeSchool.principal_name ? `(${activeSchool.principal_name})` : ""}
              </div>
            </footer>
          </article>
        )}
      </div>
    </AppShell>
  );
}
