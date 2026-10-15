import { createNoticeHandler } from "../_shared/hoa-notice-handler.mjs";
Deno.serve(createNoticeHandler({ env: Deno.env.toObject() }));
