"use client";

import { BookOpen, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Panel, Pill } from "@/components/kit";
import { Button } from "@/components/ui/button";

const modules = ["Classes & Sections", "Subjects", "Timetable", "Exams", "Results", "Assignments", "Homework", "Report Cards"];

export function AcademicsPage() {
  return (
    <AppShell title="Academic Management" subtitle="Managed in the connected academic portal.">
      <div className="space-y-6">
        <section className="navy-gradient rounded-2xl p-8 text-primary-foreground">
          <Pill tone="muted">Separate system · Single sign-on ready</Pill>
          <h2 className="mt-4 font-display text-2xl font-semibold">Centennial Academic Portal</h2>
          <p className="mt-2 max-w-xl text-sm opacity-80">
            Academic records stay in the dedicated academic system. This platform links to it securely — nothing is
            duplicated here.
          </p>
          <Button variant="secondary" className="mt-6" onClick={() => toast.info("Academic portal link will open once single sign-on is configured")}>
            Open academic portal <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </section>
        <Panel title="Available in the academic portal">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((m) => (
              <div key={m} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                <BookOpen className="h-4 w-4 text-primary" /> {m}
              </div>
            ))}
          </div>
        </Panel>
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="Academic summary not connected yet"
          text="Once the academic portal is linked, exam progress and result summaries will appear here automatically."
          cta="Request connection"
        />
      </div>
    </AppShell>
  );
}
