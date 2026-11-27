# Role × Table Permission Matrix

Derived directly from the active Postgres RLS policies and `SECURITY DEFINER` RPCs in `supabase/migrations/` through `20261124000003_franchisee_finalization.sql`.

Legend:
- `Y` = Allowed
- `W` = Allowed **only** when `school_is_writable(school_id)` (school active AND franchise/master active, or Central Admin)
- `S` = Scoped (own records, assigned classes, or non-principal staff only)
- `N` = Denied by RLS

| Table | `central_*` | `franchise_owner` (active school/franchise) | `school_principal` | `admissions_staff` | `teacher` | `accountant` / `transport_manager` | `student` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `schools` | S/I/U/D (`Y`) | S (`Y`), I (`onboarding` if franchise open), U (`update_school_profile` RPC `W`) | S (`Y`), U (`update_school_profile` RPC `W`) | S (`Y`) | S (`Y`) | S (`Y`) | S (`Y`) |
| `memberships` | S/I/U/D (`Y`; `ops_admin` non-central only) | S (`Y`), I/U/D (principal & staff `S`/`W`) | S (`Y`), I/U/D (staff only `S`/`W`) | S (own) | S (own) | S (own) | S (own) |
| `classes` | S/I/U/D (`Y`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`W`) \* | S (`S` assigned), I/U/D (`N`) | S (`Y`), I/U/D (`N`) | S (`S` own class) |
| `students` | S/I/U/D (`Y`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`W`) | S (`S` assigned classes), I/U/D (`N`) | S (`Y`), I/U/D (`N`) | S (`S` own row) |
| `attendance_records` | S/I/U/D (`Y`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`N`) | S/I/U (`S` assigned classes, `W`) | S (`N`), I/U/D (`N`) \* | S (`S` own rows) |
| `class_teacher_assignments` | S/I/U/D (`Y`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`W`) | `N` | S (`S` own rows), I/U/D (`N`) | `N` | `N` |
| `subjects` | S/I/U/D (`Y`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`N`) | S (`Y`), I/U/D (`N`) | S (`Y`), I/U/D (`N`) | S (`Y`), I/U/D (`N`) |
| `timetable_slots` | S/I/U/D (`Y`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`N`) | S (`Y`), I/U/D (`N`) | S (`Y`), I/U/D (`N`) | S (`Y`), I/U/D (`N`) |
| `homework` | S/I/U/D (`Y`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`N`) | S/I/U/D (`S` own/assigned class, `W`) | `N` | `N` |
| `exams` | S/I/U/D (`Y`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`N`) | S (`Y`), I/U/D (`N`) | S (`Y`), I/U/D (`N`) | S (`Y`), I/U/D (`N`) |
| `exam_marks` | S/I/U/D (`Y`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`N`) | S (`S` class), I/U (`S` `marks_open` + `W`) | `N` | `N` |
| `notices` | S/I/U/D (`Y`) | S/I/U/D (`W`, incl. unpublished) | S/I/U/D (`W`, incl. unpublished) | S (`S` published) | S (`S` published), I/U/D (`S` class `students`/`parents`, `W`) | S (`S` published) | S (`S` published) |
| `admission_enquiries` | S/I/U/D (`Y`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`W`) | S (`Y`), I/U/D (`W`) | `N` | `N` | `N` |
| `transfer_certificates` | S (`Y`), I (via RPC `W`), U (`N`), D (`Y`) | S (`Y`), I (via RPC `W`), U/D (`N`) | S (`Y`), I (via RPC `W`), U/D (`N`) | `N` | `N` | `N` | `N` |
| `staff_invites` | S (`Y`) | S (`Y`), I/D (`W`) | S (`Y`), I/D (`W`) | `N` | `N` | `N` | `N` |
| `central_admin_audit_logs` | S (`Y`), triggers/RPCs insert (`Y`) | `N` (written via triggers/RPCs only) | `N` (written via triggers/RPCs only) | `N` | `N` | `N` | `N` |

## Audit Notes & Prompt Alignment Flags

- **\* `admissions_staff` on `classes`**: Inherited from `20260101000003_phase2_school_structure_teacher_attendance.sql` (`"school leadership manages classes"` included `admissions_staff`). Retained for backward compatibility with Phase 2 policies, now gated by `school_is_writable(school_id)`.
- **\* `attendance_records` tightening**: In `20261111000002`, `can_access_class()` included `accountant` and `transport_manager`, which previously allowed them to mark attendance and read student lists. `20261124000002` removed `accountant` and `transport_manager` from `can_access_class()` and restricted `attendance_records` writes to leadership and assigned teachers only.
- **\* `20261123000002` vs `20261124000001` / `20261124000002`**: `20261123000002_franchisee_dashboard_scope.sql` contained only Franchisee read models/policies; the academic tables (`subjects`, `timetable_slots`, `homework`, `exams`, `exam_marks`, `notices`) live in `20261124000001_teacher_academics_tables.sql`, so the principal finalization migration was named `20261124000002_principal_finalization.sql` to preserve timestamp order.
- **\* `admission_enquiries` creation**: Because no earlier migration created `admission_enquiries`, `20261124000002_principal_finalization.sql` creates it cleanly with RLS, indexes, audit triggers, and writable guards.
- **\* `franchise_owner` (franchise scope) inside schools**: A franchisee (`memberships.role = 'franchise_owner'` with `franchise_id` set and `school_id`/`master_franchise_id` null) has the same school-level write rights as `school_principal` inside every active school of their active franchise via `has_school_role` and `is_school_leadership` (plus ability to manage `school_principal` memberships). All writes are gated by `school_is_writable(school_id)` and `franchise_is_open(franchise_id)`. On `franchises`, owners may only update contact fields via `update_franchise_contact()` while the franchise and master are active; `status`, `code`, `master_franchise_id`, and `territory_id` remain protected.
