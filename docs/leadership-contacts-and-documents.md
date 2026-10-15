# Contacts, contracts, minutes and announcements

Open `/leadership/` after signing in with **Officer & Director tools** access and verifying MFA. Current appointments supply default access, system administrators retain access, and administrators can explicitly grant or revoke workspace access for other confirmed accounts. These permissions are separate from the public roster; see [membership and access](member-onboarding-and-access.md). Contacts/contracts remain separate from `/admin/` membership and property reviews.

**Contacts & contracts** is a private rolodex. Create or edit a company/person, enter any purpose, and keep contact person, email, phone, website, address and notes on its card. Search matches purposes and contact details. Archive obsolete contacts to hide them from the active list while retaining their contracts. Open a card and choose **Add a contract PDF**; contract titles and optional start/end dates help distinguish successive agreements. These service contacts never grant homeowner access or alter historical household records.

**Minutes & announcements** supports text, PDF attachments, or both. Choose a date and title, write a summary and check **Publish for signed-in members**, or leave it unchecked to save a private draft. Edit an update to publish or unpublish it. New posts with attachments are kept as drafts until the initial attachment finishes. Additional PDFs can be attached later. Members read published posts at `/member-documents/`, linked from their account, filter by minutes/announcements, search updates, and download a PDF on demand. Readers need approved ownership (or authorized staff access with MFA) and current paperwork for active rental requests; see [rental member access](rental-member-access.md).

## Upload limits and storage planning

The verified organization has one project, is on the free plan, and had zero stored objects before this feature. Supabase currently includes **1 GB of file storage**, **5 GB of uncached egress** and **5 GB of cached egress** on Free. Quotas are organization-wide and other API downloads also count toward bandwidth. Database size has its own 500 MB allowance; contact/post metadata uses that database, not the file-storage budget. [Pricing](https://supabase.com/pricing), [storage usage](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size), [egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress).

| Upload | Maximum | Who can download |
| --- | --- | --- |
| Contract PDF | 2 MB (2,000,000 bytes) | Current Director/Officer with MFA |
| Minutes or announcement PDF | 1 MB (1,000,000 bytes) | Confirmed signed-in account while the update is published |
| Entire new library | 500 MB (500,000,000 bytes), including upload reservations | Managed by Directors/Officers |

The library retains its 500 MB budget. Rental agreements have a separate 250 MB budget, and existing private bylaws use about 3.8 MB. Together these planned allocations total about 753.8 MB. Both features stop new reservations when observed project storage plus outstanding uploads would exceed 800 MB. This cannot guarantee remaining on Free indefinitely: future organization projects, platform pricing changes, database growth, bandwidth and manually administered uploads must still be monitored in Supabase's usage dashboard.

Illustrative storage calculations, assuming no removals:

| Usage assumption | Growth | Time to fill 500 MB |
| --- | --- | --- |
| 50 PDFs/year averaging 250 KB | 12.5 MB/year | 40 years |
| 50 PDFs/year averaging 500 KB | 25 MB/year | 20 years |
| 20 contracts/year at 2 MB plus 24 updates/year at 1 MB | 64 MB/year | About 7.8 years |

As a bandwidth example, 119 households downloading two 1 MB PDFs in a month uses about 238 MB, before other requests. This is well below the 5 GB uncached allowance, but repeated downloads still count. PDFs are downloaded only when selected, never preloaded. Export text-based PDFs, compress scans, avoid embedding high-resolution photos, and aim below 250–500 KB for ordinary minutes. Keep original records separately. The app rejects oversized or non-PDF selections; both private buckets also enforce size and `application/pdf` at the service level.

## Access and storage implementation

`hoa_service_contacts`, `hoa_publications`, and `hoa_library_files` have RLS, explicit grants and indexed foreign keys. Current appointments are checked through existing server-owned leadership records, not editable user metadata. All management requires MFA; regular member reads require a confirmed account with approved ownership and current required rental paperwork. Both new buckets (`hoa-contracts`, `hoa-member-publications`) are private. Authenticated downloads recheck the file and publication policies instead of exposing public or shareable signed links. Unpublishing removes access to a publication's files. Previously downloaded copies remain on the reader's device.

Uploads first call `reserve_hoa_file`, which serializes quota checks and reserves the bucket's entire maximum size. Files cannot be uploaded to arbitrary paths or replaced with `upsert`. `finish_hoa_file` reads actual Storage metadata, verifies the selected byte count and PDF type, and reduces the reservation to the actual size. Members can see only finished attachments belonging to published posts. A failed upload remains visibly incomplete and continues to reserve space; use **Remove incomplete entry** to release it. File removal uses the Storage API first, then removes the database reference only after the object is absent. Removing a contact/post's metadata cannot orphan its stored files because direct deletion is not granted.

Lists fetch in 500-row pages, so the default API row cap does not silently hide older records as the archive grows.

## Verification

The migration was tested in PGlite PostgreSQL with separate anonymous, unconfirmed, member, Director, Officer, forged-metadata and MFA claims. Checks cover table and object access, drafts, unfinished files, disallowed file sizes/types, arbitrary storage paths, authoritative byte verification, quota exhaustion, deletion order, role revocation and contact archival. The actual hosted database also passed a rolled-back transaction checking Director/MFA access, contact creation, published/draft visibility, full-size reservations, missing-object rejection and member/anonymous restrictions. No verification contacts, publications, reservations or files remained afterward.

Isolated browser checks with every Supabase request intercepted covered contact create/edit, arbitrary purposes, contract and minutes upload workflows, front-end validation, publication/draft behavior, member downloads, role/MFA gates, removal and mobile overflow. Local browser fixtures are ignored under `work/`; no real account, contact, email or uploaded file was changed by those browser checks. Build, TypeScript, lint, rendered HTML and live anonymous API checks passed. Completing an upload/download using a real signed-in leadership account remains a user workflow to verify with the first actual document.


The leadership task buttons are **Service contacts**, **Meeting minutes**, **Announcements**, and **Meetings & events**. File storage remains collapsible below the current task. Each service card contains contracts and its encrypted password safe. See [the member details, calendar and safe guide](member-details-calendar-and-safe.md) for the administrator-only MFA credential flow and public/member calendar editor.
