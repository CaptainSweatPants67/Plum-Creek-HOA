# Original handoff SQL

These three files are unchanged copies from `plum_creek_codex_handoff.zip`. They contain schema definitions, not homeowner contact records. They are reference material, **not pending migrations**.

The connected `plum-creek-hoa` project already has the base, rental, and contact-import tables installed as of October 11, 2026. Do not rerun the base schema or install the rental extension again. The base policy creation is not repeatable, and `CREATE TABLE IF NOT EXISTS` does not upgrade existing columns or constraints.

For a genuinely empty project, the complete schema already includes the rental extension. The standalone rental migration is for an earlier installation that lacks that extension. They are alternatives, not consecutive installation steps.

The commented link import in `plum_creek_contact_import_setup.sql` copies the staging verification timestamp. Future import code must force `relationship = 'other'` and `ownership_verified_at = NULL`, regardless of staging contents. Historical associations never grant access.

Keep CSVs, database dumps, and rental documents outside the repository or under the ignored `private-data/` directory. Files in `public/` are served directly regardless of Git ignore rules; never put sensitive files there.

See `../../docs/supabase-development-review.md` for the live inventory, implementation sequence, and required authorization tests. Establish a migration baseline from the live schema before creating additive migrations using the Supabase CLI. Never reset the live project to establish that baseline.
