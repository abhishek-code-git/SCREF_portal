import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Bus,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  ShieldAlert,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  Network,
  PieChart,
  Search,
  Settings,
  UserCircle2,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DEMO_MODE } from "@/lib/demo-mode";
import { ROLE_LABELS, canOpen, homeFor, isCentralRole, useSchoolContext } from "@/hooks/use-school";
import { useWorkspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";

type NavLeaf = { label: string; to?: string; icon: React.ElementType; soon?: boolean };
type NavGroup = { group: string; items: NavLeaf[] };

const nav: NavGroup[] = [
  {
    group: "Overview",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { label: "Principal's Desk", to: "/principal", icon: UserCog },
      { label: "Teacher's Desk", to: "/teacher", icon: ClipboardCheck },
    ],
  },
  {
    group: "Management",
    items: [
      { label: "Students", to: "/students", icon: GraduationCap },
      { label: "Parents", to: "/parents", icon: UserCircle2 },
      { label: "Staff", to: "/staff", icon: UserCog },
      { label: "Admissions", to: "/admissions", icon: Network },
    ],
  },
  {
    group: "Operations",
    items: [
      { label: "Attendance", to: "/attendance", icon: Users },
      { label: "Finance", to: "/finance", icon: IndianRupee },
      { label: "Transport", to: "/transport", icon: Bus },
      { label: "Communication", to: "/communication", icon: Megaphone },
    ],
  },
  {
    group: "Academics & Portals",
    items: [{ label: "Academic Management", to: "/academics", icon: GraduationCap }],
  },
  {
    group: "More",
    items: [
      { label: "Reports & Insights", to: "/reports", icon: PieChart },
      { label: "Support", to: "/support", icon: LifeBuoy },
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
];

const centralNav: NavGroup[] = [
  {
    group: "Network",
    items: [
      { label: "Network Overview", to: "/dashboard", icon: LayoutDashboard },
      { label: "Master Franchises", to: "/admin/master-franchises", icon: Network },
      { label: "Franchises", to: "/admin/franchises", icon: Network },
      { label: "Schools", to: "/admin/schools", icon: GraduationCap },
    ],
  },
  {
    group: "Administration",
    items: [
      { label: "Users & Access", to: "/admin/users", icon: UserCog },
      { label: "Network Reports", to: "/admin/reports", icon: PieChart },
      { label: "Onboarding & Approvals", to: "/admin/onboarding", icon: ClipboardCheck },
      { label: "Audit Logs", to: "/admin/audit", icon: ClipboardList },
      { label: "Settings", to: "/admin/settings", icon: Settings },
    ],
  },
];

const franchiseNav: NavGroup[] = [
  {
    group: "Franchise Network",
    items: [{ label: "Franchise Dashboard", to: "/franchise/dashboard", icon: LayoutDashboard }],
  },
  ...nav,
];

const studentNav: NavGroup[] = [
  { group: "Student portal", items: [{ label: "My school", to: "/student", icon: GraduationCap }, ...nav.flatMap((group) => group.items.filter((item) => item.to === "/support" || item.to === "/settings"))] },
];

const mobileNav = [
  { label: "Home", to: "/dashboard", icon: LayoutDashboard },
  { label: "Finance", to: "/finance", icon: IndianRupee },
  { label: "Attendance", to: "/attendance", icon: Users },
  { label: "Reports", to: "/reports", icon: PieChart },
] as const;

const sampleDataRoutes = new Set([
  "/students", "/parents", "/staff", "/admissions", "/attendance",
  "/finance", "/communication", "/reports", "/settings",
]);

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: (() => void) | undefined }) {
  const pathname = usePathname();
  const { activeRole, memberships } = useSchoolContext();
  const routeRole = pathname.startsWith("/franchise/") && memberships.some((membership) => membership.role === "franchise_owner")
    ? "franchise_owner"
    : activeRole;
  const sourceNav = isCentralRole(routeRole)
    ? centralNav
    : routeRole === "franchise_owner"
      ? franchiseNav
      : routeRole === "student"
        ? studentNav
      : nav;
  const groups = sourceNav
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        if (!i.to) return true;
        if (i.to === "/teacher") return routeRole === "teacher" || canOpen(routeRole, "/principal");
        return canOpen(routeRole, i.to);
      }),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {groups.map((group) => (
        <div key={group.group}>
          {!collapsed && (
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
              {group.group}
            </p>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.to === pathname || pathname.startsWith(`${item.to}/`);
              const base = cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                collapsed && "justify-center px-2",
              );
              if (!item.to) {
                return (
                  <li key={item.label}>
                    <span
                      className={cn(base, "cursor-default text-sidebar-foreground/40")}
                      title={`${item.label} — available in the next release`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="flex w-full items-center justify-between">
                          {item.label}
                          <span className="rounded border border-sidebar-border px-1 text-[9px] uppercase tracking-wider">
                            Soon
                          </span>
                        </span>
                      )}
                    </span>
                  </li>
                );
              }
              return (
                <li key={item.label}>
                  <Link
                    href={item.to}
                    {...(onNavigate ? { onClick: onNavigate } : {})}
                    className={cn(
                      base,
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--sidebar-primary)]"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarInner({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
        {collapsed ? (
          <BrandLockup invert className="[&>div]:hidden" />
        ) : (
          <BrandLockup invert />
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            className="hidden rounded-md p-1 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:block"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      <NavList collapsed={collapsed} onNavigate={onNavigate} />

      <div className="border-t border-sidebar-border p-3">
        <SidebarCentreCard collapsed={collapsed} />
      </div>
    </div>
  );
}

function SidebarCentreCard({ collapsed }: { collapsed: boolean }) {
  const { activeSchool } = useSchoolContext();
  const pathname = usePathname();
  const isFranchiseWorkspace = pathname.startsWith("/franchise/");
  const code = isFranchiseWorkspace ? "NETWORK" : activeSchool?.code ?? "CENTRAL";
  const name = isFranchiseWorkspace ? "Assigned school network" : activeSchool?.name ?? "Central workspace";
  const city = isFranchiseWorkspace ? "" : activeSchool?.city ?? "";
  return (
    <div
      className={cn(
        "rounded-lg bg-sidebar-accent/50 p-3",
        collapsed && "flex justify-center p-2",
      )}
    >
      {collapsed ? (
        <UserCircle2 className="h-5 w-5 text-sidebar-foreground/70" />
      ) : (
        <>
          <p className="text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/50">
            {code}
          </p>
          <p className="mt-1 text-xs font-medium text-sidebar-foreground">{name}</p>
          <p className="mt-0.5 text-[11px] text-sidebar-foreground/55">{city}</p>
        </>
      )}
    </div>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  live?: boolean;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const { user, profile, ready: profileReady, error: profileError } = useWorkspace();
  const { ready: schoolReady, error: schoolError, activeRole, activeSchool, memberships, schools, activeMembership, setActiveMembership } = useSchoolContext();
  const pathname = usePathname();
  const isFranchiseDashboard = pathname === "/franchise/dashboard";
  useEffect(() => {
    if (profileReady && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [profileReady, user, pathname, router]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) { toast.error(`Unable to sign out: ${error.message}`); return; }
    router.replace("/login");
  };

  if (!profileReady || !schoolReady) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Restoring your secure session…</div>;
  }
  if (!user) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Redirecting to sign in…</div>;
  }
  if (profileError || !profile) {
    return <div className="flex min-h-screen items-center justify-center bg-background px-5"><div className="surface-panel max-w-lg space-y-3 p-7"><h1 className="font-display text-xl font-semibold">Account or profile unavailable</h1><p className="text-sm text-muted-foreground">Check your connection, then refresh or sign out and sign in again. If the issue continues, ask your school administrator to confirm that your account has a profile with a display name.</p><p className="break-words text-xs text-destructive">{profileError}</p><Button onClick={() => window.location.reload()}>Retry</Button><Button variant="outline" onClick={handleLogout}>Sign out</Button></div></div>;
  }
  if (schoolError) {
    return <div className="flex min-h-screen items-center justify-center bg-background px-5"><div className="surface-panel max-w-lg space-y-3 p-7"><h1 className="font-display text-xl font-semibold">Workspace access could not be loaded</h1><p className="text-sm text-muted-foreground">Check your connection and retry. If this continues, contact your school administrator.</p><p className="break-words text-xs text-destructive">{schoolError}</p><Button onClick={() => window.location.reload()}>Retry</Button><Button variant="outline" onClick={handleLogout}>Sign out</Button></div></div>;
  }
  if (memberships.length === 0) {
    return <div className="flex min-h-screen items-center justify-center bg-background px-5"><div className="surface-panel max-w-lg space-y-3 p-7"><h1 className="font-display text-xl font-semibold">No workspace access</h1><p className="text-sm text-muted-foreground">Your account has no active school membership. Ask your school administrator to invite or assign this account, then sign in again.</p><Button onClick={handleLogout}>Sign out</Button></div></div>;
  }
  if (memberships.length > 1 && !activeMembership && !isFranchiseDashboard) {
    return <div className="flex min-h-screen items-center justify-center bg-background px-5"><div className="surface-panel w-full max-w-lg space-y-3 p-7"><h1 className="font-display text-xl font-semibold">Choose your workspace</h1><p className="text-sm text-muted-foreground">This account has access to more than one workspace. Select the one you want to open.</p>{memberships.map((membership) => { const school = schools.find((item) => item.id === membership.school_id); return <Button key={membership.id} variant="outline" className="w-full justify-between" onClick={() => setActiveMembership(membership.id)}>{school?.name ?? "Central workspace"}<span className="text-muted-foreground">{ROLE_LABELS[membership.role]}</span></Button>; })}</div></div>;
  }
  if (!isFranchiseDashboard && activeSchool && ["inactive", "suspended", "disabled", "archived"].includes(activeSchool.status.toLowerCase())) {
    return <div className="flex min-h-screen items-center justify-center bg-background px-5"><div className="surface-panel max-w-lg space-y-3 p-7"><h1 className="font-display text-xl font-semibold">Workspace is inactive</h1><p className="text-sm text-muted-foreground">This school workspace is currently inactive. Contact your school administrator for access.</p><Button onClick={handleLogout}>Sign out</Button></div></div>;
  }
  const routeRole = isFranchiseDashboard && memberships.some((membership) => membership.role === "franchise_owner")
    ? "franchise_owner"
    : activeRole;
  const allowed = canOpen(routeRole, pathname);
  if (!allowed) {
    return <div className="flex min-h-screen items-center justify-center bg-background px-5"><div className="surface-panel max-w-md space-y-3 p-7 text-center"><ShieldAlert className="mx-auto h-6 w-6 text-destructive" /><h1 className="font-display text-xl font-semibold">This section isn’t part of your role</h1><p className="text-sm text-muted-foreground">Signed in as {activeRole ? ROLE_LABELS[activeRole] : "member"}. Ask your school administrator if you need access.</p><Button onClick={() => router.replace(homeFor(activeRole))}>Go to my home</Button></div></div>;
  }
  if (sampleDataRoutes.has(pathname) && !DEMO_MODE) {
    return <div className="flex min-h-screen items-center justify-center bg-background px-5"><div className="surface-panel max-w-lg space-y-3 p-7"><h1 className="font-display text-xl font-semibold">This module is not connected to live data</h1><p className="text-sm text-muted-foreground">Its current records are prototype fixtures and are hidden for your school account. Ask your administrator when live module data is available.</p><Button onClick={() => router.replace("/dashboard")}>Return to dashboard</Button></div></div>;
  }
  const mobileItems = isCentralRole(routeRole)
    ? centralNav[0]!.items.slice(0, 4).filter((i): i is NavLeaf & { to: string } => !!i.to)
    : routeRole === "franchise_owner"
      ? [{ label: "Network", to: "/franchise/dashboard", icon: LayoutDashboard }, ...mobileNav.filter((i) => canOpen(routeRole, i.to))]
      : routeRole === "student"
        ? [{ label: "My school", to: "/student", icon: GraduationCap }, ...mobileNav.filter((i) => canOpen(routeRole, i.to))]
        : mobileNav.filter((i) => canOpen(routeRole, i.to));
  const displayName = profile.full_name;
  const displayEmail = user.email ?? "";
  const displayRole = activeRole
    ? ROLE_LABELS[activeRole]
    : memberships.some((membership) => membership.role === "franchise_owner")
      ? ROLE_LABELS.franchise_owner
      : "Central account";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "U";

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border transition-[width] duration-200 lg:block",
          collapsed ? "w-[76px]" : "w-[264px]",
        )}
      >
        <SidebarInner collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] border-sidebar-border p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarInner collapsed={false} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-base font-semibold sm:text-lg">{title}</h1>
              {subtitle && (
                <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
              )}
            </div>

            <div className="hidden items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground md:flex">
              <Search className="h-4 w-4" />
              <input
                placeholder="Search students, staff, invoices…"
                className="w-56 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {actions}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-semibold text-secondary-foreground">
                    0
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <p className="px-2 py-3 text-sm text-muted-foreground">No notifications.</p>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 transition-colors hover:bg-secondary">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                    {initials}
                  </span>
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block text-xs font-medium">{displayName}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {displayRole}
                    </span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="space-y-0.5">
                  <p className="text-sm">{displayName}</p>
                  <p className="text-xs font-normal text-muted-foreground">{displayEmail}</p>
                  <p className="text-xs font-normal text-muted-foreground">{displayRole}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">My Centre</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>Security</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void handleLogout(); }} className="flex items-center gap-2 text-destructive">
                  <LogOut className="h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
          {DEMO_MODE && sampleDataRoutes.has(pathname) && <div role="status" className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium">Demo mode: the records on this page are illustrative sample data, not your school’s live records.</div>}
          {allowed ? (
            children
          ) : (
            <div className="surface-panel mx-auto flex max-w-md flex-col items-center px-6 py-12 text-center">
              <ShieldAlert className="h-6 w-6 text-destructive" />
              <p className="mt-3 font-display font-semibold">This section isn&apos;t part of your role</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Signed in as {activeRole ? ROLE_LABELS[activeRole] : "member"}. Ask your principal if you need access.
              </p>
              <Button className="mt-5" asChild>
                <Link href={homeFor(activeRole)}>Go to my home</Link>
              </Button>
            </div>
          )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 backdrop-blur lg:hidden">
        {(isCentralRole(routeRole)
          ? mobileItems
          : routeRole === "teacher"
          ? [{ label: "My Classes", to: "/teacher" as const, icon: ClipboardCheck }, ...mobileItems]
          : mobileItems
        ).map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.to}
              className={
                "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground" +
                (pathname === item.to ? " text-primary font-medium" : "")
              }
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function DemoBadge() {
  return (
    <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      Demo data
    </span>
  );
}
