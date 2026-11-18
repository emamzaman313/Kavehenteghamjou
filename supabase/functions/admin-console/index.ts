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
  const { data: adminRow } = await admin.from("site_access_admins").select("user_id,role").eq("user_id", authData.user.id).maybeSingle();
  if (!adminRow) return respond({ ok: false, reason: "not_admin" }, 403, origin);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch { return respond({ ok: false, reason: "invalid_request" }, 400, origin); }

  async function beginAudit(
    action: "moderate_post" | "delete_post" | "warn_user" | "ban_user" | "unban_user",
    targetId: string,
    details: Record<string, unknown> = {},
    targetType: "post" | "user" = "post",
  ) {
    const { data, error } = await admin.from("admin_audit_logs").insert({
      actor_id: authData.user.id,
      action,
      target_type: targetType,
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

  if (body.action === "audit_logs") {
    if (!["owner", "admin"].includes(String(adminRow.role))) return respond({ ok: false, reason: "insufficient_role" }, 403, origin);
    const { data, error } = await admin.from("admin_audit_logs")
      .select("id,actor_id,action,target_type,target_id,status,details,created_at,completed_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return respond({ ok: false, reason: "audit_query_failed" }, 500, origin);
    return respond({ ok: true, events: data ?? [] }, 200, origin);
  }

  if (body.action === "users_list") {
    if (!["owner", "admin"].includes(String(adminRow.role))) return respond({ ok: false, reason: "insufficient_role" }, 403, origin);
    const [authUsersResult, profilesResult, adminsResult] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("profiles").select("id,display_name,username,created_at").limit(1000),
      admin.from("site_access_admins").select("user_id,role"),
    ]);
    if (authUsersResult.error || profilesResult.error || adminsResult.error) return respond({ ok: false, reason: "users_query_failed" }, 500, origin);
    const profileById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
    const adminRoleById = new Map((adminsResult.data ?? []).map((entry) => [entry.user_id, entry.role]));
    const users = (authUsersResult.data.users ?? []).map((user) => {
      const profile = profileById.get(user.id);
      return {
        id: user.id,
        email: user.email ?? null,
        is_anonymous: user.is_anonymous === true,
        display_name: profile?.display_name ?? (user.email ? user.email.split("@")[0] : "کاربر مهمان"),
        username: profile?.username ?? null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
        banned_until: user.banned_until ?? null,
        is_banned: Boolean(user.banned_until && Date.parse(user.banned_until) > Date.now()),
        admin_role: adminRoleById.get(user.id) ?? null,
      };
    }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return respond({ ok: true, users }, 200, origin);
  }

  if (["warn_user", "ban_user", "unban_user"].includes(String(body.action))) {
    if (!["owner", "admin"].includes(String(adminRow.role))) return respond({ ok: false, reason: "insufficient_role" }, 403, origin);
    if (!validId(body.userId)) return respond({ ok: false, reason: "invalid_user_id" }, 400, origin);
    if (body.userId === authData.user.id) return respond({ ok: false, reason: "cannot_moderate_self" }, 400, origin);
    const { data: protectedAdmin } = await admin.from("site_access_admins")
      .select("user_id").eq("user_id", body.userId).maybeSingle();
    if (protectedAdmin) return respond({ ok: false, reason: "cannot_moderate_admin" }, 403, origin);
    const { data: targetResult, error: targetError } = await admin.auth.admin.getUserById(body.userId);
    if (targetError || !targetResult.user) return respond({ ok: false, reason: "user_not_found" }, 404, origin);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 3 || reason.length > 500) return respond({ ok: false, reason: "invalid_reason" }, 400, origin);

    if (body.action === "warn_user") {
      const audit = await beginAudit("warn_user", body.userId, { reason }, "user");
      if (!audit.id) return respond({ ok: false, reason: "audit_log_unavailable" }, 500, origin);
      const { error: notificationError } = await admin.from("notifications").insert({
        recipient_id: body.userId,
        actor_id: authData.user.id,
        kind: "admin_warning",
        entity_type: "moderation",
        entity_id: audit.id,
        payload: { message: `اخطار مدیریتی: ${reason}`, moderation_action: "warning" },
      });
      if (notificationError) {
        await finishAudit(audit.id, "failed");
        return respond({ ok: false, reason: "warning_delivery_failed" }, 500, origin);
      }
      const auditRecorded = await finishAudit(audit.id, "succeeded");
      return respond({ ok: true, auditRecorded, notificationSent: true }, 200, origin);
    }

    if (body.action === "ban_user") {
      const duration = String(body.duration ?? "24h");
      const allowedDurations = new Set(["1h", "24h", "168h", "720h", "876000h"]);
      if (!allowedDurations.has(duration)) return respond({ ok: false, reason: "invalid_ban_duration" }, 400, origin);
      const audit = await beginAudit("ban_user", body.userId, { reason, duration }, "user");
      if (!audit.id) return respond({ ok: false, reason: "audit_log_unavailable" }, 500, origin);
      const { data: updatedUser, error } = await admin.auth.admin.updateUserById(body.userId, { ban_duration: duration });
      if (error || !updatedUser.user) {
        await finishAudit(audit.id, "failed");
        return respond({ ok: false, reason: "ban_failed" }, 500, origin);
      }
      const { error: notificationError } = await admin.from("notifications").insert({
        recipient_id: body.userId,
        actor_id: authData.user.id,
        kind: "admin_ban",
        entity_type: "moderation",
        entity_id: audit.id,
        payload: { message: `دسترسی ورود به حساب شما به دلیل زیر محدود شد: ${reason}`, moderation_action: "ban", banned_until: updatedUser.user.banned_until ?? null },
      });
      const auditRecorded = await finishAudit(audit.id, "succeeded");
      return respond({ ok: true, auditRecorded, notificationSent: !notificationError, banned_until: updatedUser.user.banned_until ?? null }, 200, origin);
    }

    const audit = await beginAudit("unban_user", body.userId, { reason }, "user");
    if (!audit.id) return respond({ ok: false, reason: "audit_log_unavailable" }, 500, origin);
    const { data: updatedUser, error } = await admin.auth.admin.updateUserById(body.userId, { ban_duration: "none" });
    if (error || !updatedUser.user) {
      await finishAudit(audit.id, "failed");
      return respond({ ok: false, reason: "unban_failed" }, 500, origin);
    }
    const { error: notificationError } = await admin.from("notifications").insert({
      recipient_id: body.userId,
      actor_id: authData.user.id,
      kind: "admin_unban",
      entity_type: "moderation",
      entity_id: audit.id,
      payload: { message: `محدودیت ورود حساب شما برداشته شد. دلیل ثبت‌شده: ${reason}`, moderation_action: "unban" },
    });
    const auditRecorded = await finishAudit(audit.id, "succeeded");
    return respond({ ok: true, auditRecorded, notificationSent: !notificationError, banned_until: updatedUser.user.banned_until ?? null }, 200, origin);
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
    if (!["owner", "admin", "moderator"].includes(String(adminRow.role))) return respond({ ok: false, reason: "insufficient_role" }, 403, origin);
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
    if (!["owner", "admin"].includes(String(adminRow.role))) return respond({ ok: false, reason: "insufficient_role" }, 403, origin);
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
