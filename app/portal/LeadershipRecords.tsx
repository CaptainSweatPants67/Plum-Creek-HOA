"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLICATION_MAX_BYTES, displayDate, downloadLibraryPdf, fileSize, loadLibraryRows, removeLibraryPdf, uploadLibraryPdf, validatePdf, type LibraryFile, type LibraryUsage, type Publication, type ServiceContact } from "../../lib/hoa-library";
import { WorkspaceSection } from "./WorkspaceSection";
import { CalendarManager } from "./CalendarManager";
import { ServicePasswordSafe } from "./ServicePasswordSafe";

function errorMessage(error: unknown) { return error && typeof error === "object" && "message" in error ? String(error.message) : "Please try again."; }
function text(values: FormData, name: string) { return String(values.get(name) ?? "").trim(); }

function FileList({ files, busy, download, remove }: { files: LibraryFile[]; busy: boolean; download: (file: LibraryFile) => void; remove: (file: LibraryFile) => void }) {
  return files.length ? <ul className="library-file-list">{files.map(file => <li key={file.id}>
    <div><strong>{file.title}</strong><small>{file.original_filename} · {fileSize(file.ready ? file.reserved_bytes : file.expected_bytes)} · {displayDate(file.created_at)}</small>
      {(file.starts_on || file.ends_on) && <small>{file.starts_on ? `Starts ${displayDate(file.starts_on)}` : ""}{file.starts_on && file.ends_on ? " · " : ""}{file.ends_on ? `Ends ${displayDate(file.ends_on)}` : ""}</small>}
      {!file.ready && <p>Incomplete upload. Remove this entry and upload the PDF again.</p>}</div>
    <div className="portal-actions">{file.ready && <button disabled={busy} onClick={() => download(file)}>Download PDF</button>}<button disabled={busy} onClick={() => remove(file)}>{file.ready ? "Remove PDF" : "Remove incomplete entry"}</button></div>
  </li>)}</ul> : <p>No PDFs attached yet.</p>;
}

function FileUpload({ contactId, publicationId, busy, upload }: { contactId?: string; publicationId?: string; busy: boolean; upload: (event: FormEvent<HTMLFormElement>, contactId?: string, publicationId?: string) => void }) {
  return <form className="portal-form" onSubmit={e => upload(e, contactId, publicationId)}>
    <label>{contactId ? "Contract title" : "Attachment title"}<input name="title" required maxLength={180} placeholder={contactId ? "2027 mowing agreement" : "Meeting minutes PDF"} /></label>
    {contactId && <div className="library-form-pair"><label>Start date (optional)<input name="starts_on" type="date" /></label><label>End date (optional)<input name="ends_on" type="date" /></label></div>}
    <label>PDF file<input name="pdf" type="file" accept=".pdf,application/pdf" required /></label>
    <p>PDF only · Maximum {contactId ? "2 MB" : "1 MB"}. Export a compressed, text-based PDF when possible.</p>
    <button disabled={busy}>{busy ? "Please wait…" : contactId ? "Upload contract" : "Upload PDF attachment"}</button>
  </form>;
}

export function LeadershipRecords({ client }: { client: SupabaseClient }) {
  const [tab, setTab] = useState<"contacts" | "minutes" | "announcements" | "calendar">("contacts");
  const [contacts, setContacts] = useState<ServiceContact[]>([]);
  const [posts, setPosts] = useState<Publication[]>([]);
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [usage, setUsage] = useState<LibraryUsage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [editingContact, setEditingContact] = useState<ServiceContact | "new" | null>(null);
  const [editingPost, setEditingPost] = useState<Publication | "new" | null>(null);
  const selected = contacts.find(c => c.id === selectedId);
  useEffect(() => {
    let active = true;
    void Promise.all([
      loadLibraryRows<ServiceContact>(client, "hoa_service_contacts", "name", true),
      loadLibraryRows<Publication>(client, "hoa_publications", "publication_date", false),
      loadLibraryRows<LibraryFile>(client, "hoa_library_files", "created_at", false),
      client.rpc("get_hoa_library_usage"),
    ]).then(([contacts, posts, files, usage]) => {
      if (!active) return;
      const error = contacts.error || posts.error || files.error || usage.error;
      if (error) { setLoadError("The workspace could not be loaded. Officer & Director tools access and MFA are required."); setLoaded(false); }
      else { setContacts(contacts.data as ServiceContact[]); setPosts(posts.data as Publication[]); setFiles(files.data as LibraryFile[]); setUsage(usage.data as LibraryUsage); setLoaded(true); setLoadError(""); }
    });
    return () => { active = false; };
  }, [client, revision]);

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const values = new FormData(event.currentTarget);
    const fields = { name: text(values, "name"), purpose: text(values, "purpose"), contact_person: text(values, "contact_person"), email: text(values, "email"), phone: text(values, "phone"), website: text(values, "website"), address: text(values, "address"), notes: text(values, "notes"), archived: values.has("archived") };
    if (fields.website && !/^https?:\/\//.test(fields.website)) { setMessage("Use a website address beginning with http:// or https://."); return; }
    setBusy(true); setMessage("");
    try {
      const result = editingContact && editingContact !== "new" ? await client.from("hoa_service_contacts").update(fields).eq("id", editingContact.id).select("id").single() : await client.from("hoa_service_contacts").insert(fields).select("id").single();
      if (result.error) throw result.error;
      setSelectedId(result.data.id); setEditingContact(null); setRevision(v => v + 1); setMessage("Contact saved. You can attach contracts to its card.");
    } catch (error) { setMessage(errorMessage(error)); } finally { setBusy(false); }
  }

  async function savePublication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const values = new FormData(event.currentTarget);
    const attachment = values.get("pdf");
    const pdf = attachment instanceof File && attachment.size ? attachment : null;
    const published = values.has("published");
    const fields = { kind: text(values, "kind"), title: text(values, "title"), publication_date: text(values, "publication_date"), body: text(values, "body"), published };
    const existing = editingPost && editingPost !== "new" ? editingPost : null;
    let saved = false;
    setBusy(true); setMessage("");
    try {
      if (pdf) await validatePdf(pdf, PUBLICATION_MAX_BYTES);
      const result = existing ? await client.from("hoa_publications").update(fields).eq("id", existing.id).select("id").single() : await client.from("hoa_publications").insert({ ...fields, published: false }).select("id").single();
      if (result.error) throw result.error;
      saved = true;
      if (pdf) await uploadLibraryPdf(client, pdf, { publicationId: result.data.id, title: fields.title });
      if (!existing) {
        const resultPublished = await client.from("hoa_publications").update({ published }).eq("id", result.data.id);
        if (resultPublished.error) throw resultPublished.error;
      }
      setEditingPost(null); setMessage(published ? "Published. Signed-in members can now read this update." : "Draft saved. Members cannot see it until you publish it.");
    } catch (error) { setMessage(`${saved && !existing ? "Saved as a draft. " : ""}${errorMessage(error)}`); }
    finally { setBusy(false); setRevision(v => v + 1); }
  }

  async function upload(event: FormEvent<HTMLFormElement>, contactId?: string, publicationId?: string) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget; const values = new FormData(form); const file = values.get("pdf");
    if (!(file instanceof File) || !file.size) return;
    setBusy(true); setMessage("");
    try {
      await uploadLibraryPdf(client, file, { contactId, publicationId, title: text(values, "title"), startsOn: text(values, "starts_on"), endsOn: text(values, "ends_on") });
      form.reset(); setMessage(contactId ? "Contract attached to this contact." : "PDF attached. It is visible to members when the update is published.");
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); setRevision(v => v + 1); }
  }
  async function download(file: LibraryFile) {
    setBusy(true); setMessage("");
    try { await downloadLibraryPdf(client, file); } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }
  async function remove(file: LibraryFile) {
    if (busy || !window.confirm(`Remove “${file.title}” and its PDF? Download a copy first if you need to retain it.`)) return;
    setBusy(true); setMessage("");
    try { await removeLibraryPdf(client, file); setMessage("PDF removed and its storage space released."); }
    catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); setRevision(v => v + 1); }
  }

  if (loadError) return <div className="portal-panel"><p role="status">{loadError}</p><button onClick={() => setRevision(v => v + 1)}>Try again</button></div>;
  if (!loaded) return <div className="portal-panel"><p role="status">Loading contacts and member updates…</p></div>;
  const contact = editingContact && editingContact !== "new" ? editingContact : null;
  const post = editingPost && editingPost !== "new" ? editingPost : null;
  const visibleContacts = contacts.filter(c => (showArchived || !c.archived) && [c.name, c.purpose, c.contact_person, c.email, c.phone, c.notes].join(" ").toLowerCase().includes(search.toLowerCase()));
  return <>

    {message && <p className="portal-notice" role="status">{message}</p>}
    <nav className="portal-tabs leadership-task-tabs" aria-label="Leadership tasks">{([{id:"contacts",label:"Service contacts"},{id:"minutes",label:"Meeting minutes"},{id:"announcements",label:"Announcements"},{id:"calendar",label:"Meetings & events"}] as const).map(item=><button key={item.id} disabled={busy || Boolean(editingContact) || Boolean(editingPost)} aria-pressed={tab===item.id} onClick={()=>{setTab(item.id);setMessage("");}}>{item.label}</button>)}</nav>
    {tab === "contacts" ? <>
      <WorkspaceSection title="Service contacts" description={`${contacts.filter(contact => !contact.archived).length} active contacts`} defaultOpen><div className="portal-heading"><p>Your private HOA rolodex. Use any purpose.</p><button disabled={busy} onClick={() => setEditingContact("new")}>New contact</button></div>
        <label className="portal-search">Search contacts or purpose<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <label className="library-check"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Include archived contacts</label>
        {visibleContacts.length ? <div className="library-contact-grid">{visibleContacts.map(c => <button className="library-contact-choice" aria-pressed={selectedId === c.id} key={c.id} disabled={busy} onClick={() => setSelectedId(c.id)}><strong>{c.name}</strong><span>{c.purpose}{c.archived ? " · Archived" : ""}</span><small>{c.contact_person || c.email || c.phone || "Open contact card"}</small></button>)}</div> : <p>{contacts.length ? "No contacts match your search." : "No contacts yet. Create your first contact above."}</p>}
      </WorkspaceSection>
      {editingContact && <div className="portal-panel"><h2>{contact ? "Edit contact" : "Create a contact"}</h2><form className="portal-form" key={contact?.id ?? "new"} onSubmit={saveContact}>
        <label>Company or contact name<input name="name" required maxLength={160} defaultValue={contact?.name} /></label>
        <label>Purpose<input name="purpose" required maxLength={100} list="contact-purposes" placeholder="Mowing, insurance, pond maintenance…" defaultValue={contact?.purpose} /><datalist id="contact-purposes"><option value="Mowing" /><option value="Insurance" /><option value="Pond maintenance" />{[...new Set(contacts.map(c => c.purpose))].filter(p => !["Mowing", "Insurance", "Pond maintenance"].includes(p)).map(p => <option key={p} value={p} />)}</datalist></label>
        <label>Contact person<input name="contact_person" maxLength={160} defaultValue={contact?.contact_person} /></label>
        <div className="library-form-pair"><label>Email<input name="email" type="email" maxLength={254} defaultValue={contact?.email} /></label><label>Phone<input name="phone" type="tel" maxLength={60} defaultValue={contact?.phone} /></label></div>
        <label>Website<input name="website" type="url" maxLength={500} placeholder="https://" defaultValue={contact?.website} /></label>
        <label>Address<input name="address" maxLength={500} defaultValue={contact?.address} /></label>
        <label>Notes<textarea name="notes" maxLength={5000} defaultValue={contact?.notes} /></label>
        <p>Keep passwords and account numbers in this contact’s password safe rather than ordinary notes.</p>
        <label className="portal-checkbox"><input name="archived" type="checkbox" defaultChecked={contact?.archived} /> Archived contact (retains its contracts)</label>
        <div className="portal-actions"><button disabled={busy}>Save contact</button><button type="button" disabled={busy} onClick={() => setEditingContact(null)}>Cancel</button></div>
      </form></div>}
      {selected && <WorkspaceSection key={selected.id} title={selected.name} description={selected.purpose} className="library-contact-card" defaultOpen><div className="portal-heading"><p>{selected.archived ? "Archived contact" : "Contact details & contracts"}</p><button disabled={busy} onClick={() => setEditingContact(selected)}>Edit contact</button></div>
        <dl className="library-contact-details">{selected.contact_person && <><dt>Contact person</dt><dd>{selected.contact_person}</dd></>}{selected.email && <><dt>Email</dt><dd><a href={`mailto:${encodeURIComponent(selected.email)}`}>{selected.email}</a></dd></>}{selected.phone && <><dt>Phone</dt><dd><a href={`tel:${selected.phone.replace(/[^+\d]/g, "")}`}>{selected.phone}</a></dd></>}{selected.website && <><dt>Website</dt><dd><a href={selected.website} target="_blank" rel="noopener noreferrer">{selected.website}</a></dd></>}{selected.address && <><dt>Address</dt><dd>{selected.address}</dd></>}</dl>
        {selected.notes && <p className="library-body">{selected.notes}</p>}<h3>Contracts</h3><FileList files={files.filter(f => f.contact_id === selected.id)} busy={busy} download={download} remove={remove} />
        {!selected.archived && <details key={selected.id}><summary>Add a contract PDF</summary><FileUpload contactId={selected.id} busy={busy} upload={upload} /></details>}
        <ServicePasswordSafe key={selected.id} client={client} contactId={selected.id} archived={selected.archived}/>
      </WorkspaceSection>}
    </> : tab === "calendar" ? <CalendarManager client={client}/> : <WorkspaceSection title={tab==="minutes"?"Meeting minutes":"Announcements"} description="Published member updates and private drafts" defaultOpen><div className="portal-heading"><p>{tab==="minutes"?"Keep meeting records and attach minutes PDFs.":"Post news and updates for members."} Published updates appear in the member library; drafts stay with leadership.</p><button disabled={busy || Boolean(editingPost)} onClick={() => setEditingPost("new")}>{tab==="minutes"?"New meeting minutes":"New announcement"}</button></div>
      {editingPost && <form className="portal-form" key={post?.id ?? "new"} onSubmit={savePublication}>
        <label>Update type<select name="kind" defaultValue={post?.kind ?? (tab==="minutes"?"minutes":"announcement")}><option value="minutes">Meeting minutes</option><option value="announcement">Announcement</option></select></label>
        <label>Title<input name="title" required maxLength={180} defaultValue={post?.title} /></label>
        <label>Meeting or announcement date<input name="publication_date" type="date" required defaultValue={post?.publication_date ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date())} /></label>
        <label>Text or summary<textarea name="body" maxLength={20000} defaultValue={post?.body} placeholder="Write an announcement here, or summarize the meeting minutes." /></label>
        {!post && <label>PDF attachment (optional, up to 1 MB)<input type="file" name="pdf" accept=".pdf,application/pdf" /></label>}
        <label className="portal-checkbox"><input type="checkbox" name="published" defaultChecked={post ? post.published : true} /> Publish for signed-in members</label>
        <div className="portal-actions"><button disabled={busy}>{busy ? "Please wait…" : "Save update"}</button><button type="button" disabled={busy} onClick={() => setEditingPost(null)}>Cancel</button></div>
      </form>}
      {posts.filter(p=>p.kind===(tab==="minutes"?"minutes":"announcement")).length ? posts.filter(p=>p.kind===(tab==="minutes"?"minutes":"announcement")).map(p => <article className="portal-review-card" key={p.id}><div className="portal-heading"><h3>{p.title}</h3><button disabled={busy || Boolean(editingPost)} onClick={() => setEditingPost(p)}>Edit update</button></div><p>{p.kind === "minutes" ? "Minutes" : "Announcement"} · {displayDate(p.publication_date)} · <strong>{p.published ? "Published for members" : "Draft — leadership only"}</strong></p>
        {p.body && <p className="library-body">{p.body}</p>}<FileList files={files.filter(f => f.publication_id === p.id)} busy={busy} download={download} remove={remove} />
        <details><summary>Add PDF attachment</summary><FileUpload publicationId={p.id} busy={busy} upload={upload} /></details>
      </article>) : <p>No updates yet. Add minutes or an announcement above.</p>}
    </WorkspaceSection>}
    <WorkspaceSection title="File storage" description={usage ? `${fileSize(usage.stored_bytes)} stored · 500 MB library budget` : "Upload limits and storage budget"} className="library-storage">
      {usage && <><p><strong>{fileSize(usage.stored_bytes)}</strong> stored · {fileSize(usage.allocated_bytes)} allocated of the <strong>500 MB library budget</strong></p><progress value={usage.allocated_bytes} max={usage.budget_bytes} aria-label="Library storage used" />
        {usage.pending_uploads > 0 && <p>{usage.pending_uploads} incomplete upload{usage.pending_uploads === 1 ? " reserves" : "s reserve"} space. Remove incomplete entries to release it.</p>}
        {usage.allocated_bytes >= 400_000_000 && <p className="portal-notice">Storage is over 80% full. Download and remove unneeded PDFs before adding more.</p>}
        {usage.project_bytes >= 700_000_000 && <p className="portal-notice">Other project files are using storage too. Project usage is {fileSize(usage.project_bytes)}; new uploads stop before 800 MB.</p>}</>}
      <p>Contracts: PDF up to 2 MB. Minutes and announcements: PDF up to 1 MB. Smaller text-based PDFs last longer; keep original copies in your HOA records.</p>
    </WorkspaceSection>
  </>;
}
