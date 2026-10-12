import type { SupabaseClient } from "@supabase/supabase-js";

export const CONTRACT_MAX_BYTES = 2_000_000;
export const PUBLICATION_MAX_BYTES = 1_000_000;
export type ServiceContact = { id: string; name: string; purpose: string; contact_person: string; email: string; phone: string; website: string; address: string; notes: string; archived: boolean };
export type Publication = { id: string; kind: "minutes" | "announcement"; title: string; publication_date: string; body: string; published: boolean };
export type LibraryFile = { id: string; contact_id: string | null; publication_id: string | null; bucket_id: string; storage_path: string; title: string; original_filename: string; expected_bytes: number; reserved_bytes: number; ready: boolean; starts_on: string | null; ends_on: string | null; created_at: string };
export type LibraryUsage = { budget_bytes: number; allocated_bytes: number; stored_bytes: number; project_bytes: number; pending_uploads: number };

export async function loadLibraryRows<T>(client: SupabaseClient, table: "hoa_service_contacts" | "hoa_publications" | "hoa_library_files", order: string, ascending: boolean, filters: Record<string, boolean> = {}) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = client.from(table).select("*").order(order, { ascending }).order("id").range(offset, offset + 499);
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    const { data, error } = await query;
    if (error) return { data: [] as T[], error };
    rows.push(...data as T[]);
    if (data.length < 500) return { data: rows, error: null };
  }
}

export function fileSize(bytes: number) { return bytes < 1_000_000 ? `${Math.ceil(bytes / 1000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`; }
export function displayDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)); }
export async function validatePdf(file: File, maxBytes: number) {
  if (!file.name.toLowerCase().endsWith(".pdf") || file.type && file.type !== "application/pdf") throw new Error("Choose a PDF file.");
  if (file.size < 1 || file.size > maxBytes) throw new Error(`This PDF is ${fileSize(file.size)}. The limit is ${fileSize(maxBytes)}. Export a smaller PDF before uploading.`);
  if (new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== "%PDF-") throw new Error("This file does not appear to be a PDF. Export it as a PDF and try again.");
}
export async function uploadLibraryPdf(client: SupabaseClient, file: File, options: { contactId?: string; publicationId?: string; title: string; startsOn?: string; endsOn?: string }) {
  await validatePdf(file, options.contactId ? CONTRACT_MAX_BYTES : PUBLICATION_MAX_BYTES);
  if (options.startsOn && options.endsOn && options.endsOn < options.startsOn) throw new Error("The contract end date must be on or after its start date.");
  const reserved = await client.rpc("reserve_hoa_file", {
    p_contact_id: options.contactId ?? null, p_publication_id: options.publicationId ?? null,
    p_title: options.title, p_filename: file.name, p_size: file.size,
    p_starts_on: options.startsOn || null, p_ends_on: options.endsOn || null,
  });
  if (reserved.error) throw reserved.error;
  const entry = (Array.isArray(reserved.data) ? reserved.data[0] : reserved.data) as LibraryFile;
  const uploaded = await client.storage.from(entry.bucket_id).upload(entry.storage_path, file, { contentType: "application/pdf", upsert: false, cacheControl: "3600" });
  if (uploaded.error) throw new Error(`Upload did not finish: ${uploaded.error.message}. An incomplete entry has been kept; remove it before trying again.`);
  const finished = await client.rpc("finish_hoa_file", { p_id: entry.id });
  if (finished.error) throw new Error(`The PDF was uploaded but could not be completed: ${finished.error.message}. Remove the incomplete entry and try again.`);
}
export async function downloadLibraryPdf(client: SupabaseClient, file: Pick<LibraryFile, "bucket_id" | "storage_path" | "original_filename">) {
  // Authenticated download rechecks access; no public or shareable signed URLs.
  const { data, error } = await client.storage.from(file.bucket_id).download(file.storage_path);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const link = document.createElement("a"); link.href = url; link.download = file.original_filename;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export async function removeLibraryPdf(client: SupabaseClient, file: LibraryFile) {
  const { error } = await client.storage.from(file.bucket_id).remove([file.storage_path]);
  if (error) throw error;
  const result = await client.rpc("remove_hoa_file", { p_id: file.id });
  if (result.error) throw result.error;
}
