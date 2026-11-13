# Class PIN security design

## Current schema

The current project has `classes.class_teacher`, which supports one class teacher per class. It has no class PIN, subject assignment, timetable, homework, lesson, assessment, or announcement tables. The existing PIN feature is therefore disabled; the teacher dashboard must not suggest that a client-only PIN form protects a class.

## Required migration before enabling PINs

Add a normalized `class_teacher_assignments` table with `school_id`, `class_id`, `teacher_user_id`, optional subject reference, active status, timestamps, and uniqueness for an active teacher/class/subject assignment. Backfill `classes.class_teacher` assignments and keep future invitation assignments synchronized. Composite foreign keys or server-side checks must guarantee that the class belongs to the same school. Database policies must permit principals to manage assignments only in their own school and teachers to read only their own assignments.

Add `classes.pin_required` (default false), a private `class_access_pins` table keyed by class with a bcrypt hash, rotation/revocation timestamps and actor, a `class_pin_attempts` table keyed by authenticated user and class with retry window/cooldown state, short-lived `class_entry_grants`, and append-only PIN audit events. PIN tables must not be readable by browser roles. Never store a plaintext PIN or include submitted PINs in logs/audit records.

## Trusted verification flow

Use a narrowly scoped database RPC (or authenticated Next.js route backed by the user's Supabase session) to verify a PIN. The operation must independently check an active teacher membership, an active assignment to the requested class, the class/school relationship, whether a PIN is required, and cooldown state. Hash comparisons must use a constant-time password hash verifier. Return only a generic success/failure result. On success, issue a short-lived grant bound to `auth.uid()` and `class_id`; RLS on student, attendance, and future class data must continue checking both assignment and grant. A correct PIN never creates an assignment or permits a teacher into an unassigned class.

Set a configurable attempt limit and cooldown in the database, clear or expire counters only through the verifier, and audit success, failure, rotation, revocation, and administrative actor without recording the PIN. Rotation/revocation must invalidate outstanding grants. PIN creation and rotation should use an authorized server-side workflow that delivers a one-time secret through a trusted channel; it must not put the PIN in page source, a URL, or ordinary API response data.

Before deploying the migration, confirm the database's available password hashing extension and Supabase function privileges, then run the existing cross-school isolation SQL tests plus new tests for unassigned teachers, wrong PIN, cooldown, expiry, rotation, and cross-school class IDs. Until that work is deployed, use authenticated assignment and RLS as the only class access controls.
