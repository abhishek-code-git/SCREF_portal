"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, FileSpreadsheet, Pencil, Search, Upload, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, PrincipalBreadcrumb } from "@/components/kit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSchoolContext, useSchoolWritable } from "@/hooks/use-school";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 25;

type ClassOption = { id: string; name: string; section: string };
type StudentRow = {
  id: string;
  admission_no: string | null;
  full_name: string;
  roll_no: number;
  class_id: string;
  date_of_birth: string | null;
  gender: string | null;
  parent_name: string;
  parent_phone: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  address: string;
  admitted_on: string;
  status: string;
};

const emptyForm = () => ({
  full_name: "",
  class_id: "",
  roll_no: "1",
  admission_no: "",
  date_of_birth: "",
  gender: "",
  parent_name: "",
  parent_phone: "",
  guardian_name: "",
  guardian_phone: "",
  guardian_email: "",
  address: "",
  admitted_on: new Date().toISOString().slice(0, 10),
  status: "active",
});

type CsvValidatedRow = {
  full_name: string;
  class_id: string;
  roll_no: number;
  date_of_birth: string | null;
  gender: string | null;
  parent_name: string;
  parent_phone: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  address: string;
};

export function StudentsPage() {
  const { activeSchool, ready, error: accessError } = useSchoolContext();
  const { isWritable } = useSchoolWritable(activeSchool?.id);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [page, setPage] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [form, setForm] = useState(emptyForm);

  // CSV Import state
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvSummary, setCsvSummary] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const classesQuery = useQuery<ClassOption[], Error>({
    queryKey: ["school-classes-options", activeSchool?.id],
    enabled: !!activeSchool,
    queryFn: async () => {
      if (!activeSchool) return [];
      const { data, error } = await supabase
        .from("classes")
        .select("id,name,section")
        .eq("school_id", activeSchool.id)
        .order("name")
        .order("section");
      if (error) throw error;
      return (data ?? []) as ClassOption[];
    },
  });

  const studentsQuery = useQuery<{ rows: StudentRow[]; total: number }, Error>({
    queryKey: ["school-students", activeSchool?.id, page, search, classFilter, statusFilter],
    enabled: !!activeSchool,
    queryFn: async () => {
      if (!activeSchool) return { rows: [], total: 0 };
      let q = supabase
        .from("students")
        .select(
          "id,admission_no,full_name,roll_no,class_id,date_of_birth,gender,parent_name,parent_phone,guardian_name,guardian_phone,guardian_email,address,admitted_on,status",
          { count: "exact" },
        )
        .eq("school_id", activeSchool.id)
        .order("full_name")
        .order("roll_no");

      if (classFilter !== "all") q = q.eq("class_id", classFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (search.trim()) {
        const term = search.trim().replaceAll(",", " ");
        q = q.or(`full_name.ilike.%${term}%,admission_no.ilike.%${term}%,parent_name.ilike.%${term}%`);
      }

      const { data, count, error } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: (data ?? []) as StudentRow[], total: count ?? 0 };
    },
  });

  const saveStudentMut = useMutation({
    mutationFn: async () => {
      if (!activeSchool) return;
      const payload = {
        school_id: activeSchool.id,
        class_id: form.class_id,
        full_name: form.full_name.trim(),
        roll_no: Number(form.roll_no) || 1,
        admission_no: form.admission_no.trim() || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        parent_name: form.parent_name.trim(),
        parent_phone: form.parent_phone.trim(),
        guardian_name: form.guardian_name.trim(),
        guardian_phone: form.guardian_phone.trim(),
        guardian_email: form.guardian_email.trim(),
        address: form.address.trim(),
        admitted_on: form.admitted_on || new Date().toISOString().slice(0, 10),
        status: form.status || "active",
      };
      if (editing) {
        const { error } = await supabase
          .from("students")
          .update(payload)
          .eq("id", editing.id)
          .eq("school_id", activeSchool.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("students").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(editing ? "Student updated" : "Student added");
      setFormOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["school-students", activeSchool?.id] });
      await queryClient.invalidateQueries({ queryKey: ["principal-overview", activeSchool?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm(), class_id: classesQuery.data?.[0]?.id ?? "" });
    setFormOpen(true);
  };

  const openEdit = (s: StudentRow) => {
    setEditing(s);
    setForm({
      full_name: s.full_name,
      class_id: s.class_id,
      roll_no: String(s.roll_no),
      admission_no: s.admission_no ?? "",
      date_of_birth: s.date_of_birth ?? "",
      gender: s.gender ?? "",
      parent_name: s.parent_name,
      parent_phone: s.parent_phone,
      guardian_name: s.guardian_name,
      guardian_phone: s.guardian_phone,
      guardian_email: s.guardian_email,
      address: s.address,
      admitted_on: s.admitted_on,
      status: s.status,
    });
    setFormOpen(true);
  };

  const downloadSampleCsv = async () => {
    const { downloadCsv } = await import("@/lib/csv");
    const firstClass = classesQuery.data?.[0];
    const clsLabel = firstClass ? `${firstClass.name}-${firstClass.section}` : "Class 1-A";
    downloadCsv(
      "students-import-template.csv",
      ["full_name", "class", "roll_no", "gender", "date_of_birth", "parent_name", "parent_phone", "guardian_email", "address"],
      [["Aarav Sharma", clsLabel, "1", "male", "2016-05-14", "Rohit Sharma", "+91 98111 00001", "rohit@example.com", "Sector 12"]],
    );
  };

  const handleCsvFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(typeof reader.result === "string" ? reader.result : "");
      setCsvErrors([]);
      setCsvSummary(null);
    };
    reader.readAsText(file);
  };

  const runCsvImport = async () => {
    if (!activeSchool || !isWritable) return;
    setCsvErrors([]);
    setCsvSummary(null);
    const { parseCsv } = await import("@/lib/csv");
    const matrix = parseCsv(csvText);
    if (matrix.length < 2) {
      setCsvErrors(["CSV must include a header row and at least one student row."]);
      return;
    }

    const headers = matrix[0]!.map((h) => h.toLowerCase().trim());
    const idx = (name: string) => headers.indexOf(name);
    if (idx("full_name") === -1 || idx("class") === -1 || idx("roll_no") === -1) {
      setCsvErrors(["Missing required header columns: full_name, class, roll_no"]);
      return;
    }

    const classLookup = new Map<string, string>();
    for (const c of classesQuery.data ?? []) {
      classLookup.set(`${c.name}-${c.section}`.toLowerCase(), c.id);
      classLookup.set(`${c.name} ${c.section}`.toLowerCase(), c.id);
    }

    const errors: string[] = [];
    const parsedRows: CsvValidatedRow[] = [];

    for (let r = 1; r < matrix.length; r++) {
      const rowNum = r + 1;
      const cols = matrix[r]!;
      const get = (name: string) => {
        const i = idx(name);
        return i >= 0 ? (cols[i] ?? "").trim() : "";
      };

      const fullName = get("full_name");
      const classRaw = get("class").toLowerCase();
      const rollRaw = get("roll_no");
      const genderRaw = get("gender").toLowerCase();
      const dobRaw = get("date_of_birth");

      if (!fullName) errors.push(`Row ${rowNum}: full_name is required.`);
      const classId = classLookup.get(classRaw);
      if (!classId) errors.push(`Row ${rowNum}: class "${get("class")}" does not match any school class (use e.g. Class 1-A).`);
      const rollNum = Number(rollRaw);
      if (!Number.isInteger(rollNum) || rollNum < 1) {
        errors.push(`Row ${rowNum}: roll_no "${rollRaw}" must be a positive integer.`);
      }
      if (genderRaw && !["male", "female", "other"].includes(genderRaw)) {
        errors.push(`Row ${rowNum}: gender "${genderRaw}" must be male, female, or other.`);
      }
      if (dobRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) {
        errors.push(`Row ${rowNum}: date_of_birth "${dobRaw}" must be YYYY-MM-DD.`);
      }

      if (classId && fullName && Number.isInteger(rollNum) && rollNum >= 1) {
        parsedRows.push({
          full_name: fullName,
          class_id: classId,
          roll_no: rollNum,
          date_of_birth: dobRaw || null,
          gender: genderRaw || null,
          parent_name: get("parent_name"),
          parent_phone: get("parent_phone"),
          guardian_name: get("guardian_name") || get("parent_name"),
          guardian_phone: get("guardian_phone") || get("parent_phone"),
          guardian_email: get("guardian_email"),
          address: get("address"),
        });
      }
    }

    if (errors.length > 0) {
      setCsvErrors(errors);
      toast.error(`Found ${errors.length} validation error(s). Nothing was imported.`);
      return;
    }

    setImporting(true);
    try {
      // Load existing students in chunks to detect exact duplicates (name + class + roll)
      const existingKeys = new Set<string>();
      const existingResult = await supabase
        .from("students")
        .select("full_name,class_id,roll_no")
        .eq("school_id", activeSchool.id)
        .range(0, 9999);
      if (existingResult.error) throw existingResult.error;
      for (const s of existingResult.data ?? []) {
        existingKeys.add(`${s.full_name.trim().toLowerCase()}|${s.class_id}|${s.roll_no}`);
      }

      const toInsert: Array<CsvValidatedRow & { school_id: string }> = [];
      let skipped = 0;
      for (const item of parsedRows) {
        const key = `${item.full_name.toLowerCase()}|${item.class_id}|${item.roll_no}`;
        if (existingKeys.has(key)) {
          skipped++;
        } else {
          existingKeys.add(key);
          toInsert.push({ ...item, school_id: activeSchool.id });
        }
      }

      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase.from("students").insert(toInsert);
        if (insertErr) throw insertErr;
      }

      const msg = `Imported ${toInsert.length} student(s), skipped ${skipped} duplicate(s).`;
      setCsvSummary(msg);
      toast.success(msg);
      await queryClient.invalidateQueries({ queryKey: ["school-students", activeSchool.id] });
      await queryClient.invalidateQueries({ queryKey: ["principal-overview", activeSchool.id] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "CSV import failed";
      setCsvErrors([msg]);
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  if (!ready) return <AppShell title="Students"><div className="surface-panel h-40 animate-pulse" /></AppShell>;
  if (accessError) return <AppShell title="Students"><Panel title="Error">{accessError}</Panel></AppShell>;
  if (!activeSchool) return <AppShell title="Students"><Panel title="No school assigned">Assign a school first.</Panel></AppShell>;

  const classes = classesQuery.data ?? [];
  const classMap = new Map(classes.map((c) => [c.id, `${c.name}-${c.section}`]));
  const rows = studentsQuery.data?.rows ?? [];
  const total = studentsQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppShell
      title="Students"
      subtitle={`${activeSchool.name} · ${total.toLocaleString("en-IN")} matching student(s)`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/students/promote">
              <ArrowRightLeft className="mr-1.5 h-4 w-4" /> Promote
            </Link>
          </Button>
          <Button size="sm" variant="outline" disabled={!isWritable || classes.length === 0} onClick={() => { setCsvOpen(true); setCsvErrors([]); setCsvSummary(null); }}>
            <Upload className="mr-1.5 h-4 w-4" /> Import CSV
          </Button>
          <Button size="sm" disabled={!isWritable || classes.length === 0} onClick={openAdd}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Add student
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <PrincipalBreadcrumb items={[{ label: "Students" }]} />

        <Panel>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search students"
                placeholder="Search by name, admission no, or parent…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <select
              aria-label="Filter by class"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={classFilter}
              onChange={(e) => { setClassFilter(e.target.value); setPage(0); }}
            >
              <option value="all">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}-{c.section}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by status"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            >
              <option value="active">Active</option>
              <option value="left">Left</option>
              <option value="alumni">Alumni</option>
              <option value="all">All statuses</option>
            </select>
          </div>

          {studentsQuery.error && (
            <p role="alert" className="py-4 text-sm text-destructive">{studentsQuery.error.message}</p>
          )}

          {studentsQuery.isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading students…</p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {classes.length === 0
                ? "Create a class in Classes & Timetable before admitting students."
                : "No students match your current filters."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Admission No</th>
                    <th className="px-3 py-2.5 font-medium">Name</th>
                    <th className="px-3 py-2.5 font-medium">Class</th>
                    <th className="px-3 py-2.5 font-medium">Roll</th>
                    <th className="px-3 py-2.5 font-medium">Parent / Guardian</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((s) => (
                    <tr key={s.id} className="hover:bg-surface/60">
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                        {s.admission_no ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 font-medium">
                        <Link href={`/students/${s.id}`} className="text-primary hover:underline">
                          {s.full_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">{classMap.get(s.class_id) ?? "—"}</td>
                      <td className="px-3 py-2.5 tabular-nums">{s.roll_no}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {s.guardian_name || s.parent_name || "—"}
                        {(s.guardian_phone || s.parent_phone) && (
                          <span className="block text-xs">{s.guardian_phone || s.parent_phone}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Pill tone={s.status === "active" ? "navy" : "muted"}>{s.status}</Pill>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/students/${s.id}`}>Open</Link>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit ${s.full_name}`}
                            disabled={!isWritable}
                            onClick={() => openEdit(s)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm">
            <span className="text-muted-foreground">
              Page {page + 1} of {pageCount} ({total} total)
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      {/* Add / Edit Student Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!saveStudentMut.isPending) setFormOpen(o); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit student" : "Add student"}</DialogTitle>
            <DialogDescription>
              Admission number is generated automatically per school if left blank.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (isWritable && form.full_name.trim() && form.class_id) saveStudentMut.mutate();
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div className="space-y-1">
              <Label>Full name *</Label>
              <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Class *</Label>
              <select
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}-{c.section}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Roll no *</Label>
              <Input required type="number" min={1} value={form.roll_no} onChange={(e) => setForm({ ...form, roll_no: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Admission no (optional)</Label>
              <Input placeholder="Auto-generated if blank" value={form.admission_no} onChange={(e) => setForm({ ...form, admission_no: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Date of birth</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Gender</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Parent name</Label>
              <Input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Parent phone</Label>
              <Input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Guardian name</Label>
              <Input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Guardian phone</Label>
              <Input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Guardian email</Label>
              <Input type="email" value={form.guardian_email} onChange={(e) => setForm({ ...form, guardian_email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Admitted on</Label>
              <Input type="date" value={form.admitted_on} onChange={(e) => setForm({ ...form, admitted_on: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            {editing && (
              <div className="space-y-1">
                <Label>Status</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="active">active</option>
                  <option value="left">left</option>
                  <option value="alumni">alumni</option>
                </select>
              </div>
            )}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saveStudentMut.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isWritable || saveStudentMut.isPending}>
                {saveStudentMut.isPending ? "Saving…" : editing ? "Save changes" : "Add student"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={csvOpen} onOpenChange={(o) => { if (!importing) setCsvOpen(o); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import students from CSV</DialogTitle>
            <DialogDescription>
              Required columns: full_name, class (e.g. Class 1-A), roll_no. Exact duplicates (name + class + roll) are skipped automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void downloadSampleCsv()}>
                <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Download template
              </Button>
              <Input
                type="file"
                accept=".csv,text/csv"
                aria-label="Upload CSV file"
                className="max-w-xs"
                onChange={(e) => handleCsvFile(e.target.files?.[0])}
              />
            </div>
            <textarea
              rows={8}
              placeholder="Paste CSV content or upload a .csv file above…"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
            />
            {csvErrors.length > 0 && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <p className="font-semibold">Validation errors ({csvErrors.length}):</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {csvErrors.slice(0, 15).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {csvErrors.length > 15 && <li>…and {csvErrors.length - 15} more errors</li>}
                </ul>
              </div>
            )}
            {csvSummary && (
              <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium">
                {csvSummary}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCsvOpen(false)} disabled={importing}>
              Close
            </Button>
            <Button type="button" disabled={!isWritable || !csvText.trim() || importing} onClick={() => void runCsvImport()}>
              {importing ? "Validating & importing…" : "Validate & import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
