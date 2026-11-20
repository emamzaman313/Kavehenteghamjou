import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const allowedOrigins = new Set(["https://kaveh-avenger.vercel.app", "http://localhost:3000", "http://127.0.0.1:3000"]);

function response(body: Record<string, unknown>, status: number, origin: string | null) {
  const allowedOrigin = !origin || origin === "null" || allowedOrigins.has(origin) ? (origin ?? "https://kaveh-avenger.vercel.app") : "https://kaveh-avenger.vercel.app";
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

function base64Url(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

let cachedFcmToken: { token: string; expiresAt: number } | null = null;
async function getFcmAccessToken(account: Record<string, string>) {
  if (cachedFcmToken && cachedFcmToken.expiresAt > Date.now() + 60_000) return cachedFcmToken.token;
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: account.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = header + "." + claims;
  const pem = account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (character) => character.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey(
    "pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(unsigned)));
  const assertion = unsigned + "." + base64Url(signature);
  const tokenResponse = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const tokenBody = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenBody.access_token) throw new Error("Google OAuth token exchange failed");
  cachedFcmToken = { token: tokenBody.access_token, expiresAt: Date.now() + Number(tokenBody.expires_in ?? 3600) * 1000 };
  return cachedFcmToken.token;
}

async function sendPush(account: Record<string, string>, token: string, title: string, body: string, data: Record<string, string>) {
  const accessToken = await getFcmAccessToken(account);
  const projectId = account.project_id;
  const result = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
        android: {
          priority: data.priority === "high" ? "high" : "normal",
          notification: {
            channel_id: data.priority === "high" ? "kaveh_urgent_notifications" : "kaveh_general_notifications",
          },
        },
      },
    }),
  });
  const resultBody = await result.json().catch(() => ({}));
  return { ok: result.ok, status: result.status, body: resultBody };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return response({ ok: true }, 200, origin);
  if (request.method !== "POST") return response({ ok: false, error: "method_not_allowed" }, 405, origin);
  if (origin && !allowedOrigins.has(origin) && origin !== "null") return response({ ok: false, error: "origin_not_allowed" }, 403, origin);

  const bearer = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer || bearer === anonKey) return response({ ok: false, error: "unauthorized" }, 401, origin);
  const { data: caller, error: callerError } = await auth.auth.getUser(bearer);
  if (callerError || !caller.user) return response({ ok: false, error: "unauthorized" }, 401, origin);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch {
    return response({ ok: false, error: "invalid_request" }, 400, origin);
  }
  const messageId = typeof body.message_id === "string" ? body.message_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return response({ ok: false, error: "invalid_message_id" }, 400, origin);

  const { data: message, error: messageError } = await admin.from("messages")
    .select("id,sender_id,conversation_id,body")
    .eq("id", messageId)
    .maybeSingle();
  if (messageError || !message || message.sender_id !== caller.user.id) {
    return response({ ok: false, error: "message_not_owned" }, 403, origin);
  }

  const { data: notices, error: noticesError } = await admin.from("notifications")
    .select("id,recipient_id,kind,payload,entity_id")
    .eq("actor_id", caller.user.id)
    .eq("kind", "chat_message")
    .filter("payload->>message_id", "eq", messageId);
  if (noticesError) return response({ ok: false, error: "notification_lookup_failed" }, 500, origin);
  if (!notices?.length) return response({ ok: true, push_sent: 0, email_sent: 0, skipped: "no_recipients" }, 200, origin);

  const recipientIds = [...new Set(notices.map((row) => row.recipient_id))];
  const [tokenRows, settingRows] = await Promise.all([
    admin.from("device_tokens").select("id,user_id,token").in("user_id", recipientIds).eq("platform", "android"),
    admin.from("user_settings").select("user_id,notifications").in("user_id", recipientIds),
  ]);
  if (tokenRows.error || settingRows.error) return response({ ok: false, error: "recipient_lookup_failed" }, 500, origin);
  const settings = new Map((settingRows.data ?? []).map((row) => [row.user_id, row.notifications ?? {}]));
  const notice = notices[0];
  const title = "پیام جدید در کاوه انتقامجو";
  // Keep private message text out of system notifications and email previews by default.
  const messageBody = "پیام جدید دریافت کردید.";
  const conversationId = String(message.conversation_id);
  const data = {
    kind: "chat_message",
    conversation_id: conversationId,
    message_id: messageId,
    priority: "high",
    click_url: `/chat?conversation_id=${encodeURIComponent(conversationId)}`,
  };

  let pushSent = 0;
  let emailSent = 0;
  const serviceAccountText = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (serviceAccountText) {
    try {
      const serviceAccount = JSON.parse(serviceAccountText) as Record<string, string>;
      for (const device of tokenRows.data ?? []) {
        const preferences = settings.get(device.user_id) as Record<string, unknown> | undefined;
        if (preferences?.push === false) continue;
        const sent = await sendPush(serviceAccount, device.token, title, messageBody, data);
        if (sent.ok) pushSent++;
        else if (sent.status === 404 || JSON.stringify(sent.body).includes("UNREGISTERED")) {
          await admin.from("device_tokens").delete().eq("id", device.id);
        }
      }
    } catch (error) {
      console.error("FCM delivery failed", error);
    }
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL");
  if (resendKey && fromEmail) {
    for (const recipientId of recipientIds) {
      const preferences = settings.get(recipientId) as Record<string, unknown> | undefined;
      if (preferences?.email !== true) continue;
      const { data: userData } = await admin.auth.admin.getUserById(recipientId);
      const email = userData.user?.email;
      if (!email) continue;
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: title,
          html: `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(messageBody)}</p><p>برای مشاهده پیام وارد برنامه کاوه انتقامجو شوید.</p></div>`,
        }),
      });
      if (emailResponse.ok) emailSent++;
    }
  }

  return response({
    ok: true,
    push_sent: pushSent,
    email_sent: emailSent,
    push_configured: Boolean(serviceAccountText),
    email_configured: Boolean(resendKey && fromEmail),
  }, 200, origin);
});
