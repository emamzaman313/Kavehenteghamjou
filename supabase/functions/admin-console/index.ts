import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const allowedOrigins = new Set(["https://kaveh-avenger.vercel.app", "http://localhost:3000", "http://127.0.0.1:3000"]);

function cors(origin: string | null) {
  const allowed = !origin ? "https://kaveh-avenger.vercel.app" : origin === "null" || allowedOrigins.has(origin) ? origin : "https://kaveh-avenger.vercel.app";
  return { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
}
function respond(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function validId(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (request.method !== "POST") return respond({ ok: false, reason: "method_not_allowed" }, 405, origin);
  if (origin && !allowedOrigins.has(origin) && origin !== "null") return respond({ ok: false, reason: "origin_not_allowed" }, 403, origin);

  const bearer = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer || bearer === anonKey) return respond({ ok: false, reason: "unauthorized" }, 401, origin);
  const { data: authData, error: authError } = await auth.auth.getUser(bearer);
  if (authError || !authData.user) return respond({ ok: false, reason: "unauthorized" }, 401, origin);
  const { data: adminRow } = await admin.from("site_access_admins").select("user_id").eq("user_id", authData.user.id).maybeSingle();
  if (!adminRow) return respond({ ok: false, reason: "not_admin" }, 403, origin);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch { return respond({ ok: false, reason: "invalid_request" }, 400, origin); }

  async function beginAudit(action: "moderate_post" | "delete_post", targetId: string, details: Record<string, unknown> = {}) {
    const { data, error } = await admin.from("admin_audit_logs").insert({
      actor_id: authData.user.id,
      action,
      target_type: "post",
      target_id: targetId,
      status: "started",
      details,
    }).select("id").single();
    if (error || !data?.id) return { id: null as string | null, error };
    return { id: data.id as string, error: null };
  }

  async function finishAudit(id: string, status: "succeeded" | "failed") {
    const { error } = await admin.from("admin_audit_logs").update({
      status,
      completed_at: new Date().toISOString(),
    }).eq("id", id);
    return !error;
  }

  if (body.action === "overview") {
    const [users, userCount, posts, comments, media, latestPosts] = await Promise.all([
      admin.from("profiles").select("id,display_name,username,created_at").order("created_at", { ascending: false }).limit(30),
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("posts").select("id", { count: "exact", head: true }),
      admin.from("comments").select("id", { count: "exact", head: true }),
      admin.from("post_attachments").select("id", { count: "exact", head: true }),
      admin.from("posts").select("id,author_id,body,visibility,created_at").order("created_at", { ascending: false }).limit(30),
    ]);
    const firstError = users.error || userCount.error || posts.error || comments.error || media.error || latestPosts.error;
    if (firstError) return respond({ ok: false, reason: "query_failed" }, 500, origin);
    return respond({ ok: true, stats: { users: userCount.count ?? 0, posts: posts.count ?? 0, comments: comments.count ?? 0, media: media.count ?? 0 }, users: users.data ?? [], posts: latestPosts.data ?? [] }, 200, origin);
  }

  if (body.action === "moderate_post") {
    if (!validId(body.postId) || !["public", "private", "followers"].includes(String(body.visibility))) return respond({ ok: false, reason: "invalid_post_update" }, 400, origin);
    const audit = await beginAudit("moderate_post", body.postId, { visibility: body.visibility });
    if (!audit.id) return respond({ ok: false, reason: "audit_log_unavailable" }, 500, origin);
    const { error } = await admin.from("posts").update({ visibility: body.visibility, updated_at: new Date().toISOString() }).eq("id", body.postId);
    if (error) {
      await finishAudit(audit.id, "failed");
      return respond({ ok: false, reason: "update_failed" }, 500, origin);
    }
    const auditRecorded = await finishAudit(audit.id, "succeeded");
    return respond({ ok: true, auditRecorded }, 200, origin);
  }

  if (body.action === "delete_post") {
    if (!validId(body.postId)) return respond({ ok: false, reason: "invalid_post_id" }, 400, origin);
    const audit = await beginAudit("delete_post", body.postId);
    if (!audit.id) return respond({ ok: false, reason: "audit_log_unavailable" }, 500, origin);
    const { data: files, error: fileError } = await admin.from("post_attachments").select("bucket_id,object_path").eq("post_id", body.postId);
    if (fileError) {
      await finishAudit(audit.id, "failed");
      return respond({ ok: false, reason: "lookup_failed" }, 500, origin);
    }
    for (const bucket of [...new Set((files ?? []).map((file) => file.bucket_id))]) {
      const paths = (files ?? []).filter((file) => file.bucket_id === bucket).map((file) => file.object_path);
      if (paths.length) {
        const { error } = await admin.storage.from(bucket).remove(paths);
        if (error) {
          await finishAudit(audit.id, "failed");
          return respond({ ok: false, reason: "media_delete_failed" }, 500, origin);
        }
      }
    }
    const { error } = await admin.from("posts").delete().eq("id", body.postId);
    if (error) {
      await finishAudit(audit.id, "failed");
      return respond({ ok: false, reason: "delete_failed" }, 500, origin);
    }
    const auditRecorded = await finishAudit(audit.id, "succeeded");
    return respond({ ok: true, auditRecorded }, 200, origin);
  }

  return respond({ ok: false, reason: "unknown_action" }, 400, origin);
});
