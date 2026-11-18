import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error("Supabase Edge Function environment is incomplete");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicAuthClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const allowedOrigins = new Set([
  "https://kaveh-avenger.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function isAllowedOrigin(origin: string): boolean {
  if (origin === "null" || allowedOrigins.has(origin)) return true;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:"
      && parsed.hostname.endsWith(".vercel.app")
      && (parsed.hostname === "kaveh-avenger.vercel.app"
        || parsed.hostname.startsWith("kaveh-avenger-"));
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = !origin
    ? "https://kaveh-avenger.vercel.app"
    : origin === "null" || isAllowedOrigin(origin)
      ? origin
      : "https://kaveh-avenger.vercel.app";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function requestIp(request: Request): string {
  // Only trust proxy-provided IP headers; do not trust client-supplied X-Forwarded-For.
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}

async function getCurrentUser(request: Request) {
  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token === anonKey) return null;
  const { data, error } = await publicAuthClient.auth.getUser(token);
  return error ? null : data.user;
}

async function isSiteAdmin(userId: string): Promise<boolean> {
  const { data, error } = await adminClient
    .from("site_access_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !error && Boolean(data);
}

async function getSettings(): Promise<{ enabled: boolean } | null> {
  const { data, error } = await adminClient
    .from("site_access_settings")
    .select("enabled")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return null;
  return { enabled: Boolean(data.enabled) };
}

async function getRetrySeconds(ipHash: string): Promise<number> {
  const { data, error } = await adminClient
    .from("site_access_attempts")
    .select("locked_until")
    .eq("ip_hash", ipHash)
    .maybeSingle();
  if (error || !data?.locked_until) return 0;
  const remaining = Math.ceil(
    (new Date(data.locked_until).getTime() - Date.now()) / 1000,
  );
  return Math.max(0, remaining);
}

async function createGuestSession() {
  const id = crypto.randomUUID().replaceAll("-", "");
  const email = `guest-${id}@guest.kaveh.invalid`;
  const password = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "کاربر مهمان",
      display_name: "کاربر مهمان",
      access_method: "shared_code",
    },
  });

  if (createError || !created.user) {
    return { error: "guest_create_failed" as const };
  }

  const { data: signedIn, error: signInError } = await publicAuthClient.auth
    .signInWithPassword({ email, password });

  if (signInError || !signedIn.session) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return { error: "guest_session_failed" as const };
  }

  return {
    session: {
      access_token: signedIn.session.access_token,
      refresh_token: signedIn.session.refresh_token,
    },
  };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin)) {
    return jsonResponse({ ok: false, reason: "origin_not_allowed" }, 403, origin);
  }

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, reason: "method_not_allowed" }, 405, origin);
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonResponse({ ok: false, reason: "invalid_request" }, 400, origin);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, reason: "invalid_request" }, 400, origin);
  }

  const action = body.action;

  if (action === "status") {
    const settings = await getSettings();
    if (!settings) {
      return jsonResponse({ ok: false, reason: "not_configured" }, 503, origin);
    }
    return jsonResponse({ ok: true, enabled: settings.enabled }, 200, origin);
  }

  if (action === "admin_get" || action === "admin_update") {
    const user = await getCurrentUser(request);
    if (!user || !(await isSiteAdmin(user.id))) {
      return jsonResponse({ ok: false, isAdmin: false, reason: "not_admin" }, 403, origin);
    }

    if (action === "admin_get") {
      const settings = await getSettings();
      if (!settings) {
        return jsonResponse({ ok: false, reason: "not_configured" }, 503, origin);
      }
      return jsonResponse({ ok: true, isAdmin: true, enabled: settings.enabled }, 200, origin);
    }

    if (typeof body.enabled !== "boolean") {
      return jsonResponse({ ok: false, reason: "invalid_enabled_value" }, 400, origin);
    }
    let newCode: string | null = null;
    if (body.code !== undefined && body.code !== null && body.code !== "") {
      if (typeof body.code !== "string") {
        return jsonResponse({ ok: false, reason: "invalid_code" }, 400, origin);
      }
      newCode = body.code.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(newCode)) {
        return jsonResponse({ ok: false, reason: "invalid_code" }, 400, origin);
      }
    }

    const { error } = await adminClient.rpc("site_access_update_settings", {
      p_enabled: body.enabled,
      p_new_code: newCode,
      p_updated_by: user.id,
    });
    if (error) {
      return jsonResponse({ ok: false, reason: "save_failed" }, 500, origin);
    }
    return jsonResponse({ ok: true, isAdmin: true, enabled: body.enabled }, 200, origin);
  }

  if (action === "login") {
    const settings = await getSettings();
    if (!settings) {
      return jsonResponse({ ok: false, reason: "not_configured" }, 503, origin);
    }
    if (!settings.enabled) {
      return jsonResponse({ ok: false, reason: "disabled" }, 200, origin);
    }

    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      return jsonResponse({ ok: false, reason: "invalid_code" }, 200, origin);
    }

    const ipHash = await hmacHex(serviceRoleKey, requestIp(request));
    const retrySeconds = await getRetrySeconds(ipHash);
    if (retrySeconds > 0) {
      return jsonResponse({
        ok: false,
        reason: "rate_limited",
        retry_after_seconds: retrySeconds,
      }, 429, origin);
    }

    const { data: matches, error: verifyError } = await adminClient.rpc(
      "site_access_code_matches",
      { p_code: code },
    );
    if (verifyError) {
      return jsonResponse({ ok: false, reason: "verification_unavailable" }, 503, origin);
    }
    if (!constantTimeEqual(String(matches === true), "true")) {
      const { data: lockSeconds, error: rateError } = await adminClient.rpc(
        "site_access_register_failure",
        { p_ip_hash: ipHash },
      );
      if (rateError) {
        return jsonResponse({ ok: false, reason: "verification_unavailable" }, 503, origin);
      }
      const retryAfter = Number(lockSeconds ?? 0);
      if (retryAfter > 0) {
        return jsonResponse({
          ok: false,
          reason: "rate_limited",
          retry_after_seconds: retryAfter,
        }, 429, origin);
      }
      return jsonResponse({ ok: false, reason: "invalid_code" }, 200, origin);
    }

    await adminClient.from("site_access_attempts").delete().eq("ip_hash", ipHash);
    const guest = await createGuestSession();
    if ("error" in guest) {
      return jsonResponse({ ok: false, reason: guest.error }, 500, origin);
    }
    return jsonResponse({ ok: true, session: guest.session }, 200, origin);
  }

  return jsonResponse({ ok: false, reason: "unknown_action" }, 400, origin);
});
