# Demo data setup

`supabase/demo-seed.sql` is an opt-in SQL script. It is not a migration and is not run during build or deployment. It creates clearly labelled school, class, student, attendance, membership, and principal-task records for dedicated test accounts. It does not create Auth accounts or passwords.

## Before seeding

1. Use a development Supabase project, not production.
2. In Supabase Authentication, create five dedicated test accounts: central admin, franchise owner, principal, teacher, and student. Confirm the email addresses if required. Do not reuse staff or family accounts.
3. Copy each account's Auth user ID.
4. Check the target project's migration history and apply only migrations that are missing, in timestamp order. Do not rerun already-applied base migrations; some are intentionally one-time schema changes. Include `20261111000003_link_student_accounts.sql` and `20261111000004_dashboard_performance.sql` if those are pending.
5. In the SQL editor, open `supabase/demo-seed.sql`, replace the five sample UUIDs in `_demo_user_map` with those dedicated account IDs, and run the script. It checks that the accounts exist and aborts if they do not.

The script is idempotent for its demo school codes, classes, memberships, attendance day, and task. It overwrites the display names only for the five explicitly mapped demo accounts. Keep the edited SQL local; do not commit real account IDs.

## Verify each level

- Central admin: `/dashboard` shows network school/student/class/role totals.
- Franchise owner: `/franchise/dashboard` shows the two demo schools and their status.
- Principal: `/principal` shows classes, teacher, students, attendance and a demo task; enrollment and class assignment actions are available.
- Teacher: `/teacher` shows assigned Grade 5 and Grade 8 classes and today's attendance.
- Student: `/student` shows only the linked demo student record and that student's attendance.

The current schema still has no master-franchise/territory entity, parent-to-student link, admissions, timetable, subject, homework, exam, finance, or audit tables. The demo seed does not invent records for modules that cannot be stored or enforced by the database yet. The hierarchy fixture at `/demo/network` remains presentation-only and is visibly labelled.
