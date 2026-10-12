"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rentalError } from "../../lib/rental-agreements";

type Entry = { id: string; title: string; updated_at: string };
type Values = { login_url?: string; username?: string; password?: string; account_number?: string; routing_number?: string; notes?: string };
type Status = { eligible: boolean; unlocked: boolean; unlocked_until: string | null };
const fields = [{ name: "login_url", label: "Service login URL", type: "url" }, { name: "username", label: "Service username / email", type: "text" }, { name: "password", label: "Service password", type: "password" }, { name: "account_number", label: "Account number", type: "password" }, { name: "routing_number", label: "Routing number", type: "password" }, { name: "notes", label: "Private credential notes", type: "text" }] as const;

export function ServicePasswordSafe({ client, contactId, archived }: { client: SupabaseClient; contactId: string; archived: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Entry | "new" | null>(null);
  const [values, setValues] = useState<Values>({});
  const [revealed, setRevealed] = useState<Entry | null>(null);
  const [removeId, setRemoveId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const sensitiveEpoch = useRef(0);
  const clearSensitive = useCallback(() => { sensitiveEpoch.current++; setValues({}); setEditing(null); setRevealed(null); setShowPassword(false); }, []);
  const load = useCallback(async () => {
    const result = await client.rpc("get_service_vault_status");
    if (result.error) throw result.error;
    const next = result.data as Status; setStatus(next);
    if (!next.unlocked) { clearSensitive(); setEntries([]); return; }
    const list = await client.rpc("list_service_credentials", { p_contact_id: contactId });
    if (list.error) throw list.error; setEntries(list.data as Entry[]);
  }, [client, contactId, clearSensitive]);
  useEffect(() => {
    let active = true;
    const epochRef = sensitiveEpoch;
    void Promise.resolve().then(load).catch(error => { if (active) setMessage(rentalError(error)); });
    const { data } = client.auth.onAuthStateChange(event => { if (event === "SIGNED_OUT" || event === "USER_UPDATED") { clearSensitive(); setStatus(null); setEntries([]); } });
    const hide = () => { clearSensitive(); };
    const visibility = () => { if (document.hidden) hide(); };
    window.addEventListener("blur", hide); document.addEventListener("visibilitychange", visibility);
    return () => { active = false; epochRef.current++; data.subscription.unsubscribe(); window.removeEventListener("blur", hide); document.removeEventListener("visibilitychange", visibility); };
  }, [client, load, clearSensitive]);
  useEffect(() => {
    if (!status?.unlocked_until || !status.unlocked) return;
    const timer = window.setTimeout(() => { clearSensitive(); setStatus(current => current && { ...current, unlocked: false }); setEntries([]); setMessage("The password safe has locked. Verify another authenticator code to continue."); }, Math.max(0, Date.parse(status.unlocked_until) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [status, clearSensitive]);
  useEffect(() => { if (!revealed && (!editing || editing === "new")) return; const timer = window.setTimeout(clearSensitive, 60_000); return () => window.clearTimeout(timer); }, [revealed, editing, clearSensitive]);
  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const code = String(new FormData(form).get("vault_code")); setBusy(true); setMessage(""); clearSensitive();
    try {
      const factors = await client.auth.mfa.listFactors(); if (factors.error) throw factors.error;
      const factor = factors.data.totp[0]; if (!factor) throw new Error("Set up your authenticator in the leadership login section first.");
      const verified = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code }); if (verified.error) throw verified.error;
      const opened = await client.rpc("unlock_service_vault"); if (opened.error) throw opened.error;
      form.reset(); await load(); setMessage("Safe unlocked for five minutes. Revealed details hide after one minute or when you leave this window.");
    } catch (error) { setMessage(rentalError(error)); } finally { setBusy(false); }
  }
  async function lock() { clearSensitive(); setEntries([]); setStatus(current => current && { ...current, unlocked: false }); const result = await client.rpc("lock_service_vault"); setMessage(result.error ? rentalError(result.error) : "Password safe locked."); }
  async function open(entry: Entry, edit: boolean) {
    clearSensitive(); setBusy(true); setMessage(""); const epoch = sensitiveEpoch.current;
    try {
      const result = await client.rpc("reveal_service_credential", { p_id: entry.id }); if (result.error) throw result.error;
      if (epoch !== sensitiveEpoch.current) return;
      setValues(result.data as Values); if (edit) setEditing(entry); else setRevealed(entry);
    } catch (error) { setMessage(rentalError(error)); } finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setMessage("");
    const next = Object.fromEntries(fields.map(field => [field.name, String(data.get(field.name) ?? "")]));
    try {
      const result = await client.rpc("save_service_credential", { p_id: editing && editing !== "new" ? editing.id : null, p_contact_id: contactId, p_title: String(data.get("credential_title") ?? "").trim(), p_values: next });
      if (result.error) throw result.error; clearSensitive(); await load(); setMessage("Encrypted service credential saved.");
    } catch (error) { setMessage(rentalError(error)); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); clearSensitive();
    try { const result = await client.rpc("remove_service_credential", { p_id: removeId }); if (result.error) throw result.error; setRemoveId(""); await load(); setMessage("Credential removed from the safe."); }
    catch (error) { setMessage(rentalError(error)); } finally { setBusy(false); }
  }
  return <details className="service-password-safe" onToggle={event=>{if(!event.currentTarget.open)clearSensitive();}}><summary>Password safe &amp; account details</summary>
    <p>Encrypted storage for service logins, passwords, bank account numbers and routing numbers. Administrators with MFA can access this safe; ordinary contact notes are separate. Database administrators with privileged access can also decrypt stored records.</p>
    {message && <p role="status" className="portal-notice">{message}</p>}
    {!status ? <p>Checking password safe access…</p> : !status.eligible ? <p>An administrator login with MFA is required.</p> : !status.unlocked ? <form className="portal-form" onSubmit={unlock}><label>Fresh authenticator code<input name="vault_code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /></label><button disabled={busy}>Unlock password safe</button></form> : <>
      <div className="portal-actions"><button disabled={busy} onClick={() => void lock()}>Lock password safe</button>{!archived && <button disabled={busy || Boolean(editing)} onClick={() => { clearSensitive(); setEditing("new"); }}>Add service login or account</button>}</div>
      {entries.length ? <ul className="rental-files">{entries.map(entry => <li key={entry.id}><strong>{entry.title}</strong><p>Updated {new Date(entry.updated_at).toLocaleString()}</p><div className="portal-actions"><button disabled={busy} onClick={() => void open(entry, false)}>Reveal credential</button>{!archived && <button disabled={busy} onClick={() => void open(entry, true)}>Edit credential</button>}<button disabled={busy} onClick={() => { clearSensitive(); setRemoveId(entry.id); }}>Remove credential</button></div></li>)}</ul> : <p>No credentials saved for this contact.</p>}
      {revealed && <div className="credential-reveal"><h4>{revealed.title}</h4><dl>{fields.map(field => values[field.name] ? <div key={field.name}><dt>{field.label}</dt><dd className="credential-value">{values[field.name]}</dd></div> : null)}</dl><button onClick={clearSensitive}>Hide credential</button></div>}
      {editing && <form className="portal-form" key={editing === "new" ? "new" : editing.id} onSubmit={save} autoComplete="off"><label>Credential label<input name="credential_title" required maxLength={160} defaultValue={editing === "new" ? "" : editing.title} placeholder="Online banking or service portal" /></label>
        {fields.map(field => <label key={field.name}>{field.label}<input name={field.name} type={field.type === "password" && showPassword ? "text" : field.type} autoComplete="off" maxLength={field.name === "notes" ? 8000 : field.name === "password" ? 2000 : 1000} defaultValue={values[field.name] ?? ""} /></label>)}
        <label className="portal-checkbox"><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />Show password and account fields while editing</label><div className="portal-actions"><button disabled={busy}>Save encrypted credential</button><button type="button" disabled={busy} onClick={clearSensitive}>Cancel credential editing</button></div>
      </form>}
      {removeId && <div className="portal-notice"><p>Remove this saved credential permanently?</p><div className="portal-actions"><button disabled={busy} onClick={() => void remove()}>Confirm remove credential</button><button disabled={busy} onClick={() => setRemoveId("")}>Cancel</button></div></div>}
    </>}
  </details>;
}
