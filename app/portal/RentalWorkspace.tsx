"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { displayDate, downloadLibraryPdf, fileSize } from "../../lib/hoa-library";
import { RENTAL_MAX_BYTES, removeRentalAgreement, rentalError, uploadRentalAgreement, type RentalFile, type RentalProperty } from "../../lib/rental-agreements";
import { WorkspaceSection } from "./WorkspaceSection";

export function RentalWorkspace({ client, staff = false, revision = 0, onChanged }: { client: SupabaseClient; staff?: boolean; revision?: number; onChanged?: () => void }) {
  const [properties, setProperties] = useState<RentalProperty[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [removeId, setRemoveId] = useState("");
  const [rejectId, setRejectId] = useState("");
  useEffect(() => {
    let active = true;
    void client.rpc(staff ? "get_staff_rental_workspace" : "get_rental_workspace").then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(rentalError(error));
      else { setProperties(data.properties as RentalProperty[]); setLoaded(true); }
    });
    return () => { active = false; };
  }, [client, staff, revision, refresh]);
  async function perform(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage("");
    try { await action(); setMessage(success); setRemoveId(""); setRejectId(""); }
    catch (error) { setMessage(rentalError(error)); }
    finally { setBusy(false); setRefresh(v => v + 1); onChanged?.(); }
  }
  async function upload(event: FormEvent<HTMLFormElement>, property: RentalProperty) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    await perform(async () => {
      await uploadRentalAgreement(client, property.request_id, values.get("lease_pdf") as File, String(values.get("lease_start")), String(values.get("lease_end")));
      form.reset();
    }, "Rental agreement saved. Member access is available when every rental property has a current lease; ownership approval is separate.");
  }
  async function reject(event: FormEvent<HTMLFormElement>, file: RentalFile) {
    event.preventDefault(); const note = String(new FormData(event.currentTarget).get("reason"));
    await perform(async () => { const result = await client.rpc("reject_rental_agreement", { p_agreement_id: file.agreement_id, p_note: note }); if (result.error) throw result.error; }, "Agreement marked for replacement. This PDF no longer satisfies the rental requirement.");
  }
  return <WorkspaceSection title={staff ? "Rental agreements & lease dates" : "Rental homes & lease documents"} description={staff ? "Review paperwork and request replacement" : "Required for rental properties to access member information"} defaultOpen={!staff}>
    <p>{staff ? "Rental owners must provide a PDF and current lease dates. Ownership approval remains a separate review. Downloads are private to authorized owners and leadership with MFA." : "If you rent your home, mark it as a rental and upload the tenant’s agreement with its start and end dates. A current, completed PDF is required for property details and the member library, including bylaws, minutes, and history. You can still update your contact information and upload paperwork here."}</p>
    <p>PDF only, up to 2 MB. Keep at most three agreements per property request; remove unneeded older files. An expired or future lease does not meet the current-lease requirement.</p>
    {message && <p className="portal-notice" role="status">{message}</p>}
    {!loaded ? <p>Loading rental information…</p> : properties.filter(p => !staff || p.is_rental || p.files.length > 0).length === 0 ? <p>{staff ? "No rental property requests or retained agreements." : "Submit a property verification request to add your home here."}</p> : properties.filter(p => !staff || p.is_rental || p.files.length > 0).map(property => <article className="rental-property" key={property.request_id}>
      <h3>Lot {property.lot_number} — {property.street_address}</h3>
      <p>{staff && `${property.display_name || "Homeowner"} · `}Ownership: {property.request_status}. {property.is_rental ? property.rental_complete ? "Current rental paperwork complete." : "Rental paperwork required — member information restricted." : "No rental paperwork required."}</p>
      {!staff && <label className="rental-toggle"><input type="checkbox" checked={property.is_rental} disabled={busy || property.admin_marked_rental} onChange={event => { const checked = event.currentTarget.checked; void perform(async () => { const result = await client.rpc("set_property_rental", { p_request_id: property.request_id, p_is_rental: checked }); if (result.error) throw result.error; }, checked ? "Home marked as a rental. Add its current lease below." : "Rental declaration updated."); }} />I rent this home</label>}
      {!staff && property.admin_marked_rental && <p>The HOA has recorded this property as a rental. Contact leadership if its occupancy status needs correction.</p>}
      {(property.is_rental || property.files.length > 0) && <>
        <ul className="rental-files">{property.files.map(file => <li key={file.id}>
          <strong>{file.original_filename}</strong><p>{displayDate(file.lease_start)} – {displayDate(file.lease_end)} · {file.ready ? `${file.agreement_status.replaceAll("_", " ")} · ${fileSize(file.reserved_bytes)}` : "Incomplete upload — remove and try again"}</p>
          {file.review_note && <p>Reviewer: {file.review_note}</p>}
          <div className="portal-actions">{file.ready && <button disabled={busy} onClick={() => void perform(() => downloadLibraryPdf(client, file), "PDF downloaded.")}>Download lease PDF</button>}{file.can_remove && <button disabled={busy} onClick={() => setRemoveId(file.id)}>Remove lease PDF</button>}{staff && file.ready && file.agreement_status !== "rejected" && <button disabled={busy} onClick={() => setRejectId(file.id)}>Request replacement</button>}</div>
          {removeId === file.id && <div className="portal-notice"><p>Remove this PDF and its lease dates? If no other current agreement remains, member access will be restricted.</p><div className="portal-actions"><button disabled={busy} onClick={() => void perform(() => removeRentalAgreement(client, file), "Rental agreement removed.")}>Confirm remove lease</button><button disabled={busy} onClick={() => setRemoveId("")}>Cancel</button></div></div>}
          {rejectId === file.id && <form className="portal-form" onSubmit={event => void reject(event, file)}><label>Reason for replacement<textarea name="reason" maxLength={1000} required /></label><div className="portal-actions"><button disabled={busy}>Save replacement request</button><button type="button" disabled={busy} onClick={() => setRejectId("")}>Cancel</button></div></form>}
        </li>)}</ul>
        {!staff && <form className="portal-form rental-upload" onSubmit={event => void upload(event, property)}><h4>Add a rental agreement</h4><div className="portal-form-row"><label>Lease start date<input name="lease_start" type="date" required /></label><label>Lease end date<input name="lease_end" type="date" required /></label></div><label>Rental agreement PDF<input name="lease_pdf" type="file" accept="application/pdf,.pdf" required /></label><p>Maximum {fileSize(RENTAL_MAX_BYTES)}. Export a compact PDF instead of uploading large scans.</p><button disabled={busy || property.files.some(f => !f.ready) || property.files.filter(f => f.can_remove).length >= 3}>{busy ? "Please wait…" : "Upload rental agreement"}</button>{property.files.some(f => !f.ready) && <p>Remove the incomplete upload before adding another.</p>}</form>}
      </>}
    </article>)}
  </WorkspaceSection>;
}
