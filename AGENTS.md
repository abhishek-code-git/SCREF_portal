# Project notes

- Next.js 15 App Router + Supabase. Pages live in `src/views/`, routes in `src/app/`.
- Multi-tenant model: `public.schools` + `public.memberships` (role enum `app_role`). Roles and school access are read ONLY from the database membership table via `useSchoolContext()` — never from `user_metadata` sent by the browser (metadata centre/role fields are display hints only).
- Membership mutations are restricted by RLS to central admin roles; all other role changes go through service-side/admin flows. Never trust a browser-sent school_id or role.
- Cross-school isolation is guarded by RLS and proven by `supabase/tests/rls-isolation.sql` (run in the Supabase SQL editor inside a rolled-back transaction; results print as PASS/FAIL lines). Re-run after any change to schools/memberships policies.
- Phase-gated build per the user's MASTER_BUILD_PROMPT: stop and report at the end of each phase and wait for approval before the next (0 audit, 1 foundation/security, 2 structure/UI, 3 modules, 4 franchise admin, 5 SchoolExel+transport integrations, 6 background jobs, 7 testing).
- Current implementation status:
  - **Franchisee dashboard**: complete (`/franchise/dashboard`, `/franchise/schools`, `/franchise/schools/[id]`, `/franchise/team`, `/franchise/reports`, `/franchise/settings`, `/support`).
  - **Teacher dashboard**: complete (`/teacher`, `/teacher/classes`, `/teacher/timetable`, `/teacher/attendance`, `/teacher/homework`, `/teacher/marks`, `/teacher/notices`, `/support`, `/settings`).
  - **Principal dashboard**: complete (`/principal`, `/classes`, `/students`, `/students/promote`, `/students/[id]`, `/students/[id]/transfer-certificate`, `/staff`, `/attendance`, `/exams`, `/notices`, `/admissions`, `/reports`, `/settings`, `/support`).
  - **Not yet built (demo/placeholder routes kept off principal & teacher menus)**: Fees & finance (`/finance`), parent portal/accounts (`/parents`), transport GPS/routes (`/transport`), SMS/WhatsApp communication (`/communication`), PDF report cards, leave management, biometric attendance.
