import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const origins = new Set(["https://kaveh-avenger.vercel.app", "http://localhost:3000", "http://127.0.0.1:3000"]);

function respond(body: Record<string, unknown>, status: number, origin: string | null) {
  const allowedOrigin = !origin || origin === "null" || origins.has(origin) ? (origin ?? "https://kaveh-avenger.vercel.app") : "https://kaveh-avenger.vercel.app";
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return respond({ ok: true }, 200, origin);
  if (request.method !== "POST") return respond({ ok: false, reason: "method_not_allowed" }, 405, origin);
  if (origin && !origins.has(origin) && origin !== "null") return respond({ ok: false, reason: "origin_not_allowed" }, 403, origin);

  const bearer = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer || bearer === anonKey) return respond({ ok: false, reason: "unauthorized" }, 401, origin);
  const { data: authData, error: authError } = await auth.auth.getUser(bearer);
  if (authError || !authData.user) return respond({ ok: false, reason: "unauthorized" }, 401, origin);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch {
    return respond({ ok: false, reason: "invalid_request" }, 400, origin);
  }

  const password = typeof body.password === "string" ? body.password : "";
  const valid = password.length >= 10 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
  if (!valid) return respond({ ok: false, reason: "weak_password" }, 400, origin);
  if (!authData.user.email_confirmed_at) return respond({ ok: false, reason: "email_not_verified" }, 403, origin);

  const metadata = { ...(authData.user.user_metadata ?? {}), account_password_ready: true };
  const { error: updateError } = await admin.auth.admin.updateUserById(authData.user.id, {
    password,
    user_metadata: metadata,
  });
  if (updateError) {
    const weak = updateError.message.toLowerCase().includes("weak") || updateError.message.toLowerCase().includes("password");
    return respond({ ok: false, reason: weak ? "weak_password" : "password_update_failed" }, 400, origin);
  }

  return respond({ ok: true }, 200, origin);
});
