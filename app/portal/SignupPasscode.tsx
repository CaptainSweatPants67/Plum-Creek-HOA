"use client";

import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WorkspaceSection } from "./WorkspaceSection";

type Code = { passcode: string; enabled: boolean; updated_at: string };
const normalize = (value: string) => value.trim().toUpperCase();
const messageFrom = (error: unknown) => error && typeof error === "object" && "message" in error
  ? String(error.message) : "Unable to save the passcode. Please try again.";

export function SignupPasscode({ client, canReplace }: { client: SupabaseClient; canReplace: boolean }) {
  const [code, setCode] = useState<Code | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function closeEditor() {
    setEditing(false); setDraft(""); setConfirmation(""); setVisible(false);
  }

  async function showCode() {
    setBusy(true); setMessage("");
    try {
      const { data, error } = await client.rpc("get_homeowner_signup_passcode");
      if (error) { setCode(null); throw error; }
      setCode(data as Code);
    } catch (error) { setMessage(messageFrom(error)); }
    finally { setBusy(false); }
  }

  async function saveCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !canReplace) return;
    const passcode = normalize(draft);
    if (!/^[A-Z0-9-]{8,64}$/.test(passcode)) {
      setMessage("Use 8–64 letters, numbers or hyphens, without spaces."); return;
    }
    if (passcode !== normalize(confirmation)) {
      setMessage("The two passcodes do not match. Type the same code in both fields."); return;
    }
    setBusy(true); setMessage("");
    try {
      // The same transaction saves and returns the code, avoiding a second read.
      const { data, error } = await client.rpc("replace_homeowner_signup_passcode", { p_passcode: passcode });
      if (error) throw error;
      setCode(data as Code); closeEditor();
      setMessage("Signup passcode saved. The previous code and unused signup tickets no longer work. Existing accounts keep their login access.");
    } catch (error) { setMessage(messageFrom(error)); }
    finally { setBusy(false); }
  }

  function generateCode() {
    const generated = Array.from(crypto.getRandomValues(new Uint8Array(12)), value => value.toString(16).padStart(2, "0")).join("").toUpperCase();
    setDraft(generated); setConfirmation(generated); setMessage("");
  }

  return <WorkspaceSection title="Homeowner signup passcode" description="Show the registration code or choose a replacement">
    <p>Share this code with homeowners who want to register. Ownership approval is separate.</p>
    <div className="portal-actions"><button disabled={busy} onClick={showCode}>Show signup passcode</button>{code && <button disabled={busy} onClick={() => setCode(null)}>Hide passcode</button>}{canReplace && !editing && <button disabled={busy} onClick={() => { setEditing(true); setMessage(""); }}>Replace passcode</button>}</div>
    {message && <p className="portal-notice" role="status">{message}</p>}
    {editing && canReplace && <form className="portal-form" onSubmit={saveCode}>
      <p id="signup-passcode-help">Type your new code using 8–64 letters, numbers or hyphens. Letters are saved in uppercase; homeowners can enter either case.</p>
      <label>New signup passcode<input autoFocus type={visible ? "text" : "password"} autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-describedby="signup-passcode-help" value={draft} onChange={event => setDraft(event.target.value)} required maxLength={64} disabled={busy} /></label>
      <label>Confirm new signup passcode<input type={visible ? "text" : "password"} autoComplete="off" spellCheck={false} value={confirmation} onChange={event => setConfirmation(event.target.value)} required maxLength={64} disabled={busy} /></label>
      <label className="portal-checkbox"><input type="checkbox" checked={visible} onChange={event => setVisible(event.target.checked)} />Show typed passcodes</label>
      <button type="button" disabled={busy} onClick={generateCode}>Generate a random code</button>
      <p>Saving replaces the current registration code and invalidates unused signup tickets. Existing accounts keep their login access.</p>
      <div className="portal-actions"><button type="submit" disabled={busy}>{busy ? "Saving…" : "Save new passcode"}</button><button type="button" disabled={busy} onClick={() => { closeEditor(); setMessage(""); }}>Cancel</button></div>
    </form>}
    {code && <div className="portal-code"><strong>{code.passcode}</strong><p>{code.enabled ? "Registration code is active." : "Registration code is disabled."} Updated {new Date(code.updated_at).toLocaleString()}.</p></div>}
  </WorkspaceSection>;
}
