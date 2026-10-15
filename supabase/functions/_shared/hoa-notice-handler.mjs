const origins = new Set(["https://plumcreekgardner.com", "https://www.plumcreekgardner.com", "http://localhost:3000"]);
const footer = "\n\n—\nPlum Creek HOA\nManage your notification address and emailed-notice consent: https://plumcreekgardner.com/members/";
export function createNoticeHandler({ env, fetch: request = fetch }) {
  return async function handler(req) {
    const origin = req.headers.get("origin");
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin" };
    if (origin && !origins.has(origin)) return new Response('{"error":"Origin not allowed"}', { status: 403, headers });
    if (origin) headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "authorization, apikey, x-client-info, content-type";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (req.method === "OPTIONS") return response({});
    if (req.method !== "POST") return response({ error: "POST required" }, 405);
    const authorization = req.headers.get("authorization") ?? "";
    if (!/^Bearer\s+\S+$/i.test(authorization)) return response({ error: "Sign in required" }, 401);
    const api = env.SUPABASE_URL, anon = env.SUPABASE_ANON_KEY, service = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!api || !anon || !service) return response({ error: "Server configuration unavailable" }, 503);
    async function rpc(name, body, serviceRole = false) {
      const res = await request(`${api}/rest/v1/rpc/${name}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: serviceRole ? service : anon, Authorization: serviceRole ? `Bearer ${service}` : authorization }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error("Database operation failed. Verify your access and refresh status before retrying.");
      return res.status === 204 ? null : res.json();
    }
    try {
      const auth = await request(`${api}/auth/v1/user`, { headers: { apikey: anon, Authorization: authorization }, signal: AbortSignal.timeout(10000) });
      if (!auth.ok) return response({ error: "Sign in again" }, 401);
      const flags = await rpc("get_portal_flags", {});
      if (!flags?.can_access_admin || !flags?.has_mfa) return response({ error: "HOA administration with MFA required" }, 403);
      const raw = await req.text();
      if (raw.length > 2000) return response({ error: "Request too large" }, 413);
      const input = JSON.parse(raw);
      const ready = Boolean(env.HOA_RESEND_API_KEY && env.HOA_RESEND_WEBHOOK_SECRET);
      if (input.action === "status") return response({ ready, sender: "Plum Creek HOA <notices@auth.plumcreekgardner.com>" });
      if (input.action !== "send" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.notice_id ?? "")) return response({ error: "Choose a prepared notice" }, 400);
      if (!ready) return response({ error: "The site email sender is not configured. No email was sent." }, 503);
      const notices = await rpc("get_hoa_notices", {});
      if (!Array.isArray(notices) || !notices.some(n => n.id === input.notice_id)) return response({ error: "Notice not available; refresh the notice list" }, 404);
      let accepted = 0, failed = 0;
      for (let i = 0; i < 10; i++) {
        // Recheck delegated access even if it is revoked during a batch.
        const currentFlags = await rpc("get_portal_flags", {});
        if (!currentFlags?.can_access_admin || !currentFlags?.has_mfa) break;
        const item = await rpc("claim_hoa_notice_delivery", { p_notice: input.notice_id, p_limit: 80 }, true);
        if (!item) break;
        let status = "queued", provider = null, error = "Temporary sending failure. Retry this batch within 23 hours.";
        let stop = false;
        try {
          const sent = await request("https://api.resend.com/emails", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.HOA_RESEND_API_KEY}`, "Idempotency-Key": `hoa-notice/${item.id}` }, body: JSON.stringify({ from: "Plum Creek HOA <notices@auth.plumcreekgardner.com>", reply_to: "pchoa66030@gmail.com", to: [item.email], subject: item.subject, text: item.body + footer }), signal: AbortSignal.timeout(15000) });
          if (sent.ok) {
            const result = await sent.json();
            if (typeof result.id !== "string" || !result.id) throw new Error("Missing provider receipt");
            status = "accepted"; provider = result.id; error = ""; accepted++;
          } else if (sent.status === 429 || sent.status >= 500) { stop = true; }
          else { status = "failed"; error = `Sender rejected this delivery (HTTP ${sent.status}). Check Resend before preparing a replacement notice.`; failed++; }
        } catch { stop = true; }
        await rpc("complete_hoa_notice_delivery", { p_recipient: item.id, p_token: item.claim_token, p_status: status, p_provider: provider, p_error: error }, true);
        if (stop) break;
        if (i < 9) await new Promise(resolve => setTimeout(resolve, 650));
      }
      return response({ accepted, failed, message: `${accepted} email${accepted === 1 ? "" : "s"} accepted by Resend; ${failed} rejected. Delivery is confirmed separately. Refresh statuses; queued recipients can be sent in the next batch or after the daily limit resets.` });
    } catch { return response({ error: "The request could not complete. Refresh delivery status before retrying; prepared recipients use duplicate protection." }, 500); }
  };
}

export async function verifyWebhook(raw, headers, secret, now = Date.now()) {
  const id = headers.get("svix-id"), timestamp = headers.get("svix-timestamp"), signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures || !secret || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  try {
    const key = await crypto.subtle.importKey("raw", Uint8Array.from(atob(secret.replace(/^whsec_/, "")), c => c.charCodeAt(0)), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const content = new TextEncoder().encode(`${id}.${timestamp}.${raw}`);
    for (const signature of signatures.split(" ")) {
      const [version, encoded] = signature.split(",");
      if (version !== "v1" || !encoded) continue;
      if (await crypto.subtle.verify("HMAC", key, Uint8Array.from(atob(encoded), c => c.charCodeAt(0)), content)) return true;
    }
  } catch { return false; }
  return false;
}
export function createWebhookHandler({env,fetch:request=fetch}) {
  return async req => {
    if (req.method!=="POST") return new Response("POST required",{status:405});
    const raw=await req.text();
    if(raw.length>1000000)return new Response("Too large",{status:413});
    if(!await verifyWebhook(raw,req.headers,env.HOA_RESEND_WEBHOOK_SECRET))return new Response("Invalid signature",{status:401});
    try {
      const event=JSON.parse(raw),status=String(event.type??"").replace(/^email\./,"");
      if(!["sent","delivered","delivery_delayed","bounced","complained","failed","suppressed"].includes(status))return new Response("Ignored");
      if(typeof event.data?.email_id!=="string"||!event.created_at||!Number.isFinite(Date.parse(event.created_at)))return new Response("Invalid event",{status:400});
      const result=await request(`${env.SUPABASE_URL}/rest/v1/rpc/record_hoa_notice_delivery_event`,{method:"POST",headers:{"Content-Type":"application/json",apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`},body:JSON.stringify({p_event:req.headers.get("svix-id"),p_provider:event.data.email_id,p_status:status,p_at:event.created_at}),signal:AbortSignal.timeout(15000)});
      return new Response(result.ok?"Recorded":"Retry later",{status:result.ok?200:503});
    }catch{return new Response("Retry later",{status:503});}
  };
}
