"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { displayDate, downloadLibraryPdf, fileSize, loadLibraryRows, type LibraryFile, type Publication } from "../../lib/hoa-library";
import { WorkspaceSection } from "./WorkspaceSection";

export function MemberLibrary({ client }: { client: SupabaseClient }) {
  const [posts, setPosts] = useState<Publication[] | null>(null);
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.all([
      loadLibraryRows<Publication>(client, "hoa_publications", "publication_date", false, { published: true }),
      loadLibraryRows<LibraryFile>(client, "hoa_library_files", "created_at", false, { ready: true }),
    ]).then(([posts, files]) => {
      if (!active) return;
      if (posts.error || files.error) setMessage("Minutes and announcements could not be loaded. Please try again.");
      else { setPosts(posts.data as Publication[]); setFiles(files.data as LibraryFile[]); }
    });
    return () => { active = false; };
  }, [client]);
  async function download(file: LibraryFile) {
    setBusy(true); setMessage("");
    try { await downloadLibraryPdf(client, file); } catch { setMessage("This PDF could not be downloaded. Your access may have changed; please refresh and try again."); }
    finally { setBusy(false); }
  }
  const visible = posts?.filter(p => (filter === "all" || p.kind === filter) && `${p.title} ${p.body} ${p.publication_date}`.toLowerCase().includes(search.toLowerCase()));
  return <WorkspaceSection title="Minutes & announcements" description="Published member updates" defaultOpen>
    <p>Published updates for signed-in members. Select a PDF to download it.</p>
    <div className="library-filters"><label className="portal-search">Search updates<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label>Show<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All updates</option><option value="minutes">Minutes</option><option value="announcement">Announcements</option></select></label></div>
    {message && <p className="portal-notice" role="status">{message}</p>}
    {!posts && !message ? <p role="status">Loading member updates…</p> : visible?.length === 0 ? <p>{posts?.length ? "No updates match your search." : "No minutes or announcements have been published yet."}</p> : visible?.map(post => <article className="portal-review-card" key={post.id}>
      <p className="section-kicker">{post.kind === "minutes" ? "Meeting minutes" : "Announcement"} · {displayDate(post.publication_date)}</p><h3>{post.title}</h3>
      {post.body && <p className="library-body">{post.body}</p>}
      <ul className="library-file-list">{files.filter(f => f.publication_id === post.id).map(file => <li key={file.id}><span>{file.title} <small>PDF · {fileSize(file.reserved_bytes)}</small></span><button disabled={busy} onClick={() => download(file)}>Download PDF</button></li>)}</ul>
    </article>)}
  </WorkspaceSection>;
}
