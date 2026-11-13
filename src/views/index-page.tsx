"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bus,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react";
import { BrandLockup, BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { DEMO_MODE } from "@/lib/demo-mode";

const pillars = [
  { icon: LayoutDashboard, title: "Central Command", text: "Every centre's numbers in one view." },
  { icon: GraduationCap, title: "Academic Systems", text: "Connected academic management portal." },
  { icon: Users, title: "Student & Parent", text: "Dedicated portals under one identity." },
  { icon: Bus, title: "Transport", text: "Integration-ready routes and vehicles." },
  { icon: IndianRupee, title: "Finance", text: "Collection, pending fees and expenses." },
  { icon: ShieldCheck, title: "Role-Based Access", text: "Each role sees only what it should." },
];

export function Welcome() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <BrandLockup />
          <Button asChild size="sm">
            <Link href="/login">Access Your School</Link>
          </Button>
        </div>
      </header>

      <section className="navy-gradient text-primary-foreground">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/60">
              The Centennial School
            </p>
            <h2 className="mt-5 font-display text-4xl font-semibold leading-[1.1] sm:text-5xl">
              One School Network.
              <br />
              One Digital Ecosystem.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-primary-foreground/75">
              Empowering every Centennial School centre with connected technology for management,
              academics, students, parents and operations.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link href="/login">
                  Access Your School <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link href="/dashboard">View a live centre dashboard</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/55">
              Centennial Digital Ecosystem
            </p>
            <div className="mt-6 space-y-3 text-sm">
              <EcoNode label="Owner / Franchisee" level={0} />
              <div className="grid gap-3 sm:grid-cols-3">
                <EcoNode label="Principal" level={1} />
                <EcoNode label="Academic" level={1} />
                <EcoNode label="Operations" level={1} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <EcoNode label="Students & Parents" level={2} />
                <EcoNode label="Academic Portal" level={2} />
                <EcoNode label="Transport System" level={2} />
              </div>
              <EcoNode label="Digital Portals · One Secure Login" level={0} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h3 className="font-display text-2xl font-semibold">What every centre receives</h3>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The franchisee does not manage disconnected systems. One login, one school identity, one
          central dashboard and connected digital systems.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map(({ icon: Icon, title, text }) => (
            <div key={title} className="surface-panel p-5 transition-shadow hover:shadow-lift">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-soft text-navy">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-4 font-display text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <BrandMark className="h-8 w-8" />
            <p className="text-xs text-muted-foreground">
              Powered by The Centennial School Digital Ecosystem
            </p>
          </div>
          {DEMO_MODE ? (
            <Link href="/demo/network" className="text-xs font-medium text-primary hover:underline">
              Explore the labelled demo network
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">Connected school management across the network.</p>
          )}
        </div>
      </footer>
    </div>
  );
}

function EcoNode({ label, level }: { label: string; level: 0 | 1 | 2 }) {
  return (
    <div
      className={
        level === 0
          ? "rounded-lg border border-primary-foreground/25 bg-primary-foreground/10 px-4 py-3 text-center font-medium"
          : level === 1
            ? "rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 px-3 py-2.5 text-center text-primary-foreground/85"
            : "rounded-lg border border-dashed border-primary-foreground/15 px-3 py-2.5 text-center text-xs text-primary-foreground/65"
      }
    >
      {label}
    </div>
  );
}
