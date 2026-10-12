import type { SupabaseClient } from "@supabase/supabase-js";
import { validatePdf } from "./hoa-library";

export const RENTAL_MAX_BYTES = 2_000_000;
export type RentalFile = { id: string; agreement_id: string; bucket_id: string; storage_path: string; original_filename: string; ready: boolean; reserved_bytes: number; lease_start: string; lease_end: string; agreement_status: string; review_note: string | null; can_remove: boolean };
export type RentalProperty = { request_id: string; property_id: string; lot_number: number; street_address: string; request_status: string; display_name: string | null; is_rental: boolean; admin_marked_rental: boolean; rental_complete: boolean; files: RentalFile[] };

export function rentalError(error: unknown) { return error && typeof error === "object" && "message" in error ? String(error.message) : "Please try again."; }
export async function uploadRentalAgreement(client: SupabaseClient, requestId: string, file: File, start: string, end: string) {
  await validatePdf(file, RENTAL_MAX_BYTES);
  if (!start || !end || end < start) throw new Error("Enter both lease dates. The end date must be on or after the start date.");
  const reserved = await client.rpc("reserve_rental_agreement", { p_request_id: requestId, p_filename: file.name, p_size: file.size, p_lease_start: start, p_lease_end: end });
  if (reserved.error) throw reserved.error;
  const entry = reserved.data as RentalFile;
  const uploaded = await client.storage.from(entry.bucket_id).upload(entry.storage_path, file, { contentType: "application/pdf", upsert: false, cacheControl: "0" });
  if (uploaded.error) throw new Error(`Upload did not finish: ${uploaded.error.message}. Remove the incomplete entry below before trying again.`);
  const finished = await client.rpc("finish_rental_agreement", { p_document_id: entry.id });
  if (finished.error) throw new Error(`The PDF could not be completed: ${finished.error.message}. Remove the incomplete entry below and try again.`);
}
export async function removeRentalAgreement(client: SupabaseClient, file: RentalFile) {
  const removed = await client.storage.from(file.bucket_id).remove([file.storage_path]);
  if (removed.error) throw removed.error;
  const result = await client.rpc("remove_rental_agreement", { p_document_id: file.id });
  if (result.error) throw result.error;
}
