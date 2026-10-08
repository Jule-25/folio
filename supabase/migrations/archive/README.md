# Archived migrations

These are the migrations that built Folio's database up to October 2026
(006–042, plus `35_uploads_bucket.sql`). Their combined result is
`../000_baseline.sql`, which is what a new project runs instead.

They're kept for history: to see why a table, function or policy looks the
way it does, find the migration that last changed it here. Don't run them on
a new project, and don't edit them.
