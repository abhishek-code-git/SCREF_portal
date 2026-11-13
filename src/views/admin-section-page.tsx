"use client";

import { AppShell } from "@/components/app-shell";

const sectionDetails: Record<string, { title: string; description: string }> = {
  "master-franchise-detail": {
    title: "Master Franchise Profile",
    description: "Detailed owner, territory, franchise, school, and activity information will be available when those relationships are modeled and protected by database policies.",
  },
  "master-franchises": {
    title: "Master Franchises",
    description: "Master franchise owners, authorized territories, and their school networks will be managed here once those database relationships and secure workflows are implemented.",
  },
  franchises: {
    title: "Franchises",
    description: "Franchise records and territory assignments are not represented in the current database schema yet.",
  },
  schools: {
    title: "Schools",
    description: "School records are currently attached to school memberships. Network-wide filtering and administrator assignment need authorized server-side queries and relationship policies.",
  },
  users: {
    title: "Users & Access",
    description: "Account and membership administration requires explicit central-admin workflows backed by database authorization.",
  },
  reports: {
    title: "Network Reports",
    description: "Network reporting will be enabled after the underlying franchise, territory, and school relationships are available.",
  },
  onboarding: {
    title: "Onboarding & Approvals",
    description: "Network onboarding and approval queues will be connected to authoritative onboarding records in a later implementation phase.",
  },
  audit: {
    title: "Audit Logs",
    description: "Administrative activity will be shown here when an authorized audit log source is configured.",
  },
  settings: {
    title: "Network Settings",
    description: "Central network settings will be managed here after the supported organization model and secure workflows are defined.",
  },
};

export function AdminSectionPage({ section }: { section: string }) {
  const details = sectionDetails[section] ?? {
    title: "Network Administration",
    description: "This network administration section is not configured yet.",
  };

  return (
    <AppShell title={details.title} subtitle="Central administration">
      <section className="surface-panel max-w-3xl space-y-3 p-6" aria-labelledby="section-state-title">
        <h2 id="section-state-title" className="font-display text-lg font-semibold">Section not connected to live data</h2>
        <p className="text-sm leading-6 text-muted-foreground">{details.description}</p>
        <p className="text-sm text-muted-foreground">No demonstration records or placeholder totals are shown. Existing school data remains in its current authoritative tables.</p>
      </section>
    </AppShell>
  );
}
