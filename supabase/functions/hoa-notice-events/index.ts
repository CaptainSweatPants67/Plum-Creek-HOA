import { createWebhookHandler } from "../_shared/hoa-notice-handler.mjs";
Deno.serve(createWebhookHandler({ env: Deno.env.toObject() }));
