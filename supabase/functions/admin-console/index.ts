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
    action: "moderate_post" | "delete_post" | "warn_user" | "ban_user" | "unban_user" | "set_admin_role" | "remove_admin_role" | "review_report" | "appearance_publish" | "appearance_rollback",
    targetId: string,
    details: Record<string, unknown> = {},
    targetType: "post" | "user" | "report" | "appearance" = "post",
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


  if (body.action === "appearance_history") {
    if (!["owner", "admin"].includes(String(adminRow.role))) return respond({ ok: false, reason: "insufficient_role" }, 403, origin);
    const { data, error } = await admin.from("platform_appearance_versions")
      .select("id,version,config,is_published,created_by,created_at")
      .order("version", { ascending: false })
      .limit(30);
    if (error) return respond({ ok: false, reason: "appearance_history_failed" }, 500, origin);
    return respond({ ok: true, versions: data ?? [], can_rollback: adminRow.role === "owner" }, 200, origin);
  }

  if (body.action === "appearance_publish" || body.action === "appearance_rollback") {
    if (!["owner", "admin"].includes(String(adminRow.role))) return respond({ ok: false, reason: "insufficient_role" }, 403, origin);
    let sourceConfig: unknown = body.config;
    if (body.action === "appearance_rollback") {
      if (adminRow.role !== "owner") return respond({ ok: false, reason: "owner_only_rollback" }, 403, origin);
      const version = Number(body.version);
      if (!Number.isSafeInteger(version) || version < 1) return respond({ ok: false, reason: "invalid_version" }, 400, origin);
      const { data: previous, error: previousError } = await admin.from("platform_appearance_versions")
        .select("config").eq("version", version).maybeSingle();
      if (previousError || !previous) return respond({ ok: false, reason: "version_not_found" }, 404, origin);
      sourceConfig = previous.config;
    }
    if (!sourceConfig || typeof sourceConfig !== "object" || Array.isArray(sourceConfig)) return respond({ ok: false, reason: "invalid_config" }, 400, origin);
    const raw = sourceConfig as Record<string, unknown>;
    const appearance = raw.appearance && typeof raw.appearance === "object" && !Array.isArray(raw.appearance)
      ? raw.appearance as Record<string, unknown> : {};
    const hex = (value: unknown, fallback: string) => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
    const radius = Number(appearance.radius);
    const config = {
      appearance: {
        accent: hex(appearance.accent, "#168bff"),
        background: hex(appearance.background, "#07111f"),
        surface: hex(appearance.surface, "#101b2c"),
        radius: Number.isFinite(radius) ? Math.min(28, Math.max(8, Math.round(radius))) : 16,
      },
    };
    const action = body.action === "appearance_rollback" ? "appearance_rollback" : "appearance_publish";
    const audit = await beginAudit(action, authData.user.id, {
      source_version: body.action === "appearance_rollback" ? Number(body.version) : null,
    }, "appearance");
    if (!audit.id) return respond({ ok: false, reason: "audit_log_unavailable" }, 500, origin);
    const { data: published, error: publishError } = await admin.rpc("publish_platform_appearance", {
      p_config: config,
      p_actor: authData.user.id,
    });
    if (publishError || !Array.isArray(published) || !published[0]?.id) {
      await finishAudit(audit.id, "failed");
      return respond({ ok: false, reason: "appearance_publish_failed" }, 500, origin);
    }
    const auditRecorded = await finishAudit(audit.id, "succeeded");
    return respond({ ok: true, appearance: published[0], auditRecorded }, 200, origin);
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

  if (body.action === "reports_list") {
    if (!["owner", "admin", "moderator"].includes(String(adminRow.role))) return respond({ ok: false, reason: "insufficient_role" }, 403, origin);
    const { data, error } = await admin.from("reports")
      .select("id,reporter_id,target_type,target_id,reason,details,status,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return respond({ ok: false, reason: "reports_query_failed" }, 500, origin);
    const postIds = [...new Set((data ?? []).filter((row) => row.target_type === "post").map((row) => row.target_id))];
    const userIds = [...new Set((data ?? []).filter((row) => row.target_type === "user").map((row) => row.target_id))];
    const commentIds = [...new Set((data ?? []).filter((row) => row.target_type === "comment").map((row) => row.target_id))];
    const [postTargets, userTargets, commentTargets] = await Promise.all([
      postIds.length ? admin.from("posts").select("id,body,author_id,visibility").in("id", postIds) : Promise.resolve({ data: [], error: null }),
      userIds.length ? admin.from("profiles").select("id,display_name,username").in("id", userIds) : Promise.resolve({ data: [], error: null }),
      commentIds.length ? admin.from("comments").select("id,body,author_id").in("id", commentIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (postTargets.error || userTargets.error || commentTargets.error) return respond({ ok: false, reason: "report_targets_query_failed" }, 500, origin);
    const postById = new Map((postTargets.data ?? []).map((row) => [row.id, row]));
    const userById = new Map((userTargets.data ?? []).map((row) => [row.id, row]));
    const commentById = new Map((commentTargets.data ?? []).map((row) => [row.id, row]));
    const reports = (data ?? []).map((row) => ({
      ...row,
      target_summary: row.target_type === "post"
        ? (postById.get(row.target_id)?.body || "پست رسانه‌ای")
        : row.target_type === "user"
          ? (userById.get(row.target_id)?.display_name || userById.get(row.target_id)?.username || "کاربر")
          : row.target_type === "comment"
            ? (commentById.get(row.target_id)?.body || "دیدگاه حذف‌شده یا بدون متن")
            : null,
      target_author_id: row.target_type === "post"
        ? postById.get(row.target_id)?.author_id ?? null
        : row.target_type === "comment" ? commentById.get(row.target_id)?.author_id ?? null : null,
    }));
    return respond({ ok: true, reports }, 200, origin);
  }

  if (body.action === "review_report") {
    if (!["owner", "admin", "moderator"].includes(String(adminRow.role))) return respond({ ok: false, reason: "insufficient_role" }, 403, origin);
    if (!validId(body.reportId)) return respond({ ok: false, reason: "invalid_report_id" }, 400, origin);
    const status = String(body.status ?? "");
    if (!["reviewing", "resolved", "rejected"].includes(status)) return respond({ ok: false, reason: "invalid_report_status" }, 400, origin);
    const { data: report, error: reportError } = await admin.from("reports")
      .select("id,reporter_id,target_type,target_id,status")
      .eq("id", body.reportId).maybeSingle();
    if (reportError || !report) return respond({ ok: false, reason: "report_not_found" }, 404, origin);
    const audit = await beginAudit("review_report", report.id, {
      status,
      reported_target_type: report.target_type,
      reported_target_id: report.target_id,
      previous_status: report.status,
    }, "report");
    if (!audit.id) return respond({ ok: false, reason: "audit_log_unavailable" }, 500, origin);
    const { error } = await admin.from("reports").update({ status }).eq("id", report.id);
    if (error) {
      await finishAudit(audit.id, "failed");
      return respond({ ok: false, reason: "report_update_failed" }, 500, origin);
    }
    let notificationSent = true;
    if (status === "resolved" || status === "rejected") {
      const message = status === "resolved"
        ? "گزارشی که ثبت کرده بودید بررسی و تأیید شد."
        : "گزارشی که ثبت کرده بودید بررسی شد و تخلفی برای آن تأیید نشد.";
      const { error: notificationError } = await admin.from("notifications").insert({
        recipient_id: report.reporter_id,
        actor_id: authData.user.id,
        kind: "report_update",
        entity_type: "report",
        entity_id: report.id,
        payload: { message, status },
      });
      notificationSent = !notificationError;
    }
    const auditRecorded = await finishAudit(audit.id, "succeeded");
    return respond({ ok: true, auditRecorded, notificationSent }, 200, origin);
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
    return respond({ ok: true, users, can_manage_admins: adminRow.role === "owner" }, 200, origin);
  }

  if (body.action === "set_admin_role" || body.action === "remove_admin_role") {
    if (adminRow.role !== "owner") return respond({ ok: false, reason: "owner_only" }, 403, origin);
    if (!validId(body.userId)) return respond({ ok: false, reason: "invalid_user_id" }, 400, origin);
    if (body.userId === authData.user.id) return respond({ ok: false, reason: "cannot_change_own_role" }, 400, origin);
    const { data: targetResult, error: targetError } = await admin.auth.admin.getUserById(body.userId);
    if (targetError || !targetResult.user) return respond({ ok: false, reason: "user_not_found" }, 404, origin);
    const { data: existingRole, error: roleLookupError } = await admin.from("site_access_admins")
      .select("user_id,role").eq("user_id", body.userId).maybeSingle();
    if (roleLookupError) return respond({ ok: false, reason: "role_lookup_failed" }, 500, origin);

    if (body.action === "set_admin_role") {
      const role = String(body.role ?? "");
      if (!["admin", "moderator", "support"].includes(role)) return respond({ ok: false, reason: "invalid_admin_role" }, 400, origin);
      if (existingRole?.role === "owner") return respond({ ok: false, reason: "owner_role_protected" }, 403, origin);
      const audit = await beginAudit("set_admin_role", body.userId, { role }, "user");
      if (!audit.id) return respond({ ok: false, reason: "audit_log_unavailable" }, 500, origin);
      const { error } = await admin.from("site_access_admins").upsert({ user_id: body.userId, role }, { onConflict: "user_id" });
      if (error) {
        await finishAudit(audit.id, "failed");
        return respond({ ok: false, reason: "role_update_failed" }, 500, origin);
      }
      const roleLabel = role === "admin" ? "مدیر" : role === "moderator" ? "ناظر" : "پشتیبانی";
      const { error: notificationError } = await admin.from("notifications").insert({
        recipient_id: body.userId, actor_id: authData.user.id, kind: "admin_role_changed",
        entity_type: "moderation", entity_id: audit.id,
        payload: { message: `نقش مدیریتی حساب شما به «${roleLabel}» تغییر کرد.`, moderation_action: "role_changed", role },
      });
      const auditRecorded = await finishAudit(audit.id, "succeeded");
      return respond({ ok: true, auditRecorded, notificationSent: !notificationError }, 200, origin);
    }

    if (!existingRole) return respond({ ok: false, reason: "user_is_not_admin" }, 404, origin);
    if (existingRole.role === "owner") return respond({ ok: false, reason: "owner_role_protected" }, 403, origin);
    const audit = await beginAudit("remove_admin_role", body.userId, { previous_role: existingRole.role }, "user");
    if (!audit.id) return respond({ ok: false, reason: "audit_log_unavailable" }, 500, origin);
    const { error } = await admin.from("site_access_admins").delete().eq("user_id", body.userId);
    if (error) {
      await finishAudit(audit.id, "failed");
      return respond({ ok: false, reason: "role_removal_failed" }, 500, origin);
    }
    const { error: notificationError } = await admin.from("notifications").insert({
      recipient_id: body.userId, actor_id: authData.user.id, kind: "admin_role_removed",
      entity_type: "moderation", entity_id: audit.id,
      payload: { message: "دسترسی مدیریتی حساب شما برداشته شد.", moderation_action: "role_removed" },
    });
    const auditRecorded = await finishAudit(audit.id, "succeeded");
    return respond({ ok: true, auditRecorded, notificationSent: !notificationError }, 200, origin);
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

  if (body.action === "process_scheduled_notifications") {
    if (!["owner", "admin"].includes(String(adminRow.role))) return respond({ ok: false, reason: "insufficient_role" }, 403, origin);
    const { data: dueRows, error: dueError } = await admin.from("scheduled_notifications")
      .select("id,title,body,audience,recipient_ids,scheduled_at")
      .eq("status", "pending").lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true }).limit(50);
    if (dueError) return respond({ ok: false, reason: "scheduled_lookup_failed" }, 500, origin);
    let processed = 0;
    for (const item of dueRows ?? []) {
      const { data: claimed, error: claimError } = await admin.from("scheduled_notifications")
        .update({ status: "processing", error_message: null }).eq("id", item.id).eq("status", "pending").select("id").maybeSingle();
      if (claimError || !claimed) continue;
      let recipientIds: string[] = [];
      if (item.audience === "admins") {
        const { data } = await admin.from("site_access_admins").select("user_id").limit(1000);
        recipientIds = (data ?? []).map((row) => row.user_id);
      } else if (item.audience === "specific") {
        recipientIds = Array.isArray(item.recipient_ids) ? item.recipient_ids.filter((id): id is string => validId(id)) : [];
      } else {
        const { data } = await admin.from("profiles").select("id").limit(1000);
        recipientIds = (data ?? []).map((row) => row.id);
      }
      const rows = [...new Set(recipientIds)].map((recipient_id) => ({
        recipient_id, actor_id: authData.user.id, kind: "scheduled_announcement",
        entity_type: "announcement", entity_id: item.id,
        payload: { title: item.title, message: item.body },
      }));
      const { error: deliveryError } = rows.length ? await admin.from("notifications").insert(rows) : { error: null };
      if (deliveryError) {
        await admin.from("scheduled_notifications").update({ status: "failed", error_message: "in_app_delivery_failed" }).eq("id", item.id);
      } else {
        await admin.from("scheduled_notifications").update({ status: "sent", sent_at: new Date().toISOString(), error_message: null }).eq("id", item.id);
      }
      processed += 1;
    }
    return respond({ ok: true, processed }, 200, origin);
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
