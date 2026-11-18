'use client';

import { Activity, Ban, CheckCircle2, Eye, EyeOff, Film, Flag, KeyRound, LayoutDashboard, MessageCircle, Save, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Notify } from '@/lib/ui-types';
import { SectionHeader } from '@/components/ui';
import { isValidAccessCode, normalizeAccessCode } from '@/lib/access-code';

export default function AdminAccessCodePanel({ supabase, notify }: { supabase: SupabaseClient; notify: Notify }) {
  const [enabled, setEnabled] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [adminTab, setAdminTab] = useState<'overview' | 'users' | 'posts' | 'reports' | 'audit' | 'access'>('overview');
  const [auditRows, setAuditRows] = useState<{ id: string; actor_id: string | null; action: string; target_type: string; target_id: string; status: string; details: Record<string, unknown>; created_at: string; completed_at: string | null }[]>([]);
  const [managedUsers, setManagedUsers] = useState<{ id: string; email: string | null; is_anonymous: boolean; display_name: string; username: string | null; created_at: string; last_sign_in_at: string | null; banned_until: string | null; is_banned: boolean; admin_role: string | null }[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [canManageAdmins, setCanManageAdmins] = useState(false);
  const [adminRoleDrafts, setAdminRoleDrafts] = useState<Record<string, string>>({});
  const [userReasons, setUserReasons] = useState<Record<string, string>>({});
  const [userDurations, setUserDurations] = useState<Record<string, string>>({});
  const [userBusy, setUserBusy] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [reportRows, setReportRows] = useState<{ id: string; reporter_id: string; target_type: string; target_id: string; reason: string; details: string | null; status: string; created_at: string }[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [overview, setOverview] = useState<{ stats: { users: number; posts: number; comments: number; media: number }; users: { id: string; display_name: string; username: string | null; created_at: string }[]; posts: { id: string; author_id: string; body: string; visibility: string; created_at: string }[] } | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);

  const refreshOverview = useCallback(async () => {
    setOverviewLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'overview' } });
    setOverviewLoading(false);
    if (error || data?.ok !== true) {
      notify('دریافت آمار مدیریت ناموفق بود.', 'error');
      return;
    }
    setOverview(data);
  }, [supabase, notify]);

  const refreshAudit = useCallback(async () => {
    setAuditLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'audit_logs' } });
    setAuditLoading(false);
    if (error || data?.ok !== true) {
      notify('دریافت گزارش عملیات مدیریتی ناموفق بود.', 'error');
      return;
    }
    setAuditRows(data.events ?? []);
  }, [supabase, notify]);

  const refreshReports = useCallback(async () => {
    setReportsLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'reports_list' } });
    setReportsLoading(false);
    if (error || data?.ok !== true) {
      notify('دریافت گزارش‌های کاربران ناموفق بود.', 'error');
      return;
    }
    setReportRows(data.reports ?? []);
  }, [supabase, notify]);

  const refreshUsers = useCallback(async () => {
    setUsersLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'users_list' } });
    setUsersLoading(false);
    if (error || data?.ok !== true) {
      notify('دریافت فهرست کاربران یا مجوز مدیریت ناموفق بود.', 'error');
      return;
    }
    setManagedUsers(data.users ?? []);
    setCanManageAdmins(data.can_manage_admins === true);
  }, [supabase, notify]);

  useEffect(() => { void refreshOverview(); }, [refreshOverview]);
  useEffect(() => {
    if (adminTab === 'audit') void refreshAudit();
  }, [adminTab, refreshAudit]);
  useEffect(() => {
    if (adminTab === 'users') void refreshUsers();
  }, [adminTab, refreshUsers]);
  useEffect(() => {
    if (adminTab === 'reports') void refreshReports();
  }, [adminTab, refreshReports]);

  const reviewReport = async (reportId: string, status: 'reviewing' | 'resolved' | 'rejected') => {
    if (userBusy) return;
    setUserBusy(reportId);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'review_report', reportId, status } });
    setUserBusy(null);
    if (error || data?.ok !== true) {
      notify('ثبت نتیجه بررسی گزارش ناموفق بود.', 'error');
      return;
    }
    notify(status === 'reviewing' ? 'گزارش به صف بررسی منتقل شد.' : status === 'resolved' ? 'گزارش تأیید و تعیین تکلیف شد.' : 'گزارش رد شد.');
    await Promise.all([refreshReports(), refreshAudit()]);
  };

  const manageAdminRole = async (action: 'set_admin_role' | 'remove_admin_role', userId: string) => {
    if (userBusy) return;
    setUserBusy(userId);
    const { data, error } = await supabase.functions.invoke('admin-console', {
      body: { action, userId, ...(action === 'set_admin_role' ? { role: adminRoleDrafts[userId] ?? 'admin' } : {}) },
    });
    setUserBusy(null);
    if (error || data?.ok !== true) {
      const messages: Record<string, string> = {
        owner_only: 'فقط مالک اصلی می‌تواند نقش مدیران را تغییر دهد.',
        owner_role_protected: 'نقش مالک اصلی قابل تغییر یا لغو نیست.',
        cannot_change_own_role: 'تغییر نقش حساب خودتان مجاز نیست.',
      };
      notify(messages[data?.reason] ?? 'تغییر دسترسی مدیریتی انجام نشد.', 'error');
      return;
    }
    notify(action === 'set_admin_role' ? 'نقش مدیریتی ذخیره شد.' : 'دسترسی مدیریتی کاربر لغو شد.');
    await Promise.all([refreshUsers(), refreshAudit()]);
  };

  const moderateUser = async (action: 'warn_user' | 'ban_user' | 'unban_user', userId: string) => {
    if (userBusy) return;
    const reason = (userReasons[userId] ?? '').trim();
    if (reason.length < 3 || reason.length > 500) {
      notify('برای ثبت عملیات، دلیل ۳ تا ۵۰۰ حرفی وارد کنید.', 'error');
      return;
    }
    setUserBusy(userId);
    const { data, error } = await supabase.functions.invoke('admin-console', {
      body: {
        action,
        userId,
        reason,
        ...(action === 'ban_user' ? { duration: userDurations[userId] ?? '24h' } : {}),
      },
    });
    setUserBusy(null);
    if (error || data?.ok !== true) {
      const messages: Record<string, string> = {
        cannot_moderate_admin: 'حساب‌های مدیریتی قابل مسدودسازی از این بخش نیستند.',
        cannot_moderate_self: 'نمی‌توانید حساب خودتان را محدود کنید.',
        insufficient_role: 'نقش مدیریتی شما اجازه این عملیات را ندارد.',
      };
      notify(messages[data?.reason] ?? 'عملیات مدیریت کاربر انجام نشد.', 'error');
      return;
    }
    notify(action === 'warn_user' ? 'اخطار در سابقه مدیریتی ثبت شد.' : action === 'ban_user' ? 'محدودیت ورود کاربر اعمال شد.' : 'محدودیت ورود کاربر برداشته شد.');
    setUserReasons((current) => ({ ...current, [userId]: '' }));
    await Promise.all([refreshUsers(), refreshAudit()]);
  };

  const moderatePost = async (postId: string, visibility: 'public' | 'private') => {
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'moderate_post', postId, visibility } });
    if (error || data?.ok !== true) return notify('تغییر وضعیت پست انجام نشد.', 'error');
    notify(visibility === 'private' ? 'پست از دید عموم مخفی شد.' : 'پست دوباره عمومی شد.');
    await refreshOverview();
  };

  const deletePost = async (postId: string) => {
    if (deleteCandidate !== postId) { setDeleteCandidate(postId); return; }
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'delete_post', postId } });
    setDeleteCandidate(null);
    if (error || data?.ok !== true) return notify('حذف پست انجام نشد.', 'error');
    notify('پست و رسانه‌های پیوست آن حذف شدند.');
    await refreshOverview();
  };

  useEffect(() => {
    let active = true;
    void supabase.functions.invoke('access-code-login', { body: { action: 'admin_get' } })
      .then(({ data, error }) => {
        if (!active) return;
        if (error || data?.isAdmin !== true || data?.ok !== true) {
          setLoadError('دسترسی مدیریت این بخش تأیید نشد. با حساب مدیر وارد شوید.');
          return;
        }
        setEnabled(data.enabled === true);
      })
      .catch(() => {
        if (active) setLoadError('دریافت تنظیمات ورود با کد ناموفق بود.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [supabase]);

  const save = async () => {
    if (saving || loadError) return;
    const normalizedCode = newCode.trim().toUpperCase();
    if (normalizedCode && !isValidAccessCode(normalizedCode)) {
      notify('کد جدید باید دقیقاً ۶ حرف یا عدد انگلیسی باشد.', 'error');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.functions.invoke('access-code-login', {
      body: {
        action: 'admin_update',
        enabled,
        ...(normalizedCode ? { code: normalizedCode } : {}),
      },
    });
    setSaving(false);

    if (error || data?.ok !== true) {
      notify('ذخیره تنظیمات ورود با کد ناموفق بود.', 'error');
      return;
    }
    setNewCode('');
    notify('تنظیمات ورود با کد ذخیره شد.');
  };

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="مرکز فرماندهی"
        title="پنل مدیریت کاوه"
        description="نمای کلی جامعه، مدیریت محتوا و کنترل دسترسی مهمان‌ها."
        action={<button className="button button-quiet" type="button" onClick={() => void refreshOverview()}><Activity size={16}/> تازه‌سازی</button>}
      />
      <section className="admin-dashboard">
        <div className="admin-stat-grid">
          <div className="admin-stat"><Users/><span>کاربران</span><strong>{overview?.stats.users ?? '—'}</strong></div>
          <div className="admin-stat"><LayoutDashboard/><span>پست‌ها</span><strong>{overview?.stats.posts ?? '—'}</strong></div>
          <div className="admin-stat"><MessageCircle/><span>دیدگاه‌ها</span><strong>{overview?.stats.comments ?? '—'}</strong></div>
          <div className="admin-stat"><Film/><span>رسانه‌ها</span><strong>{overview?.stats.media ?? '—'}</strong></div>
        </div>
        <div className="admin-tabs">
          <button className={adminTab === 'overview' ? 'active' : ''} onClick={() => setAdminTab('overview')}><Activity size={15}/> نمای کلی</button>
          <button className={adminTab === 'users' ? 'active' : ''} onClick={() => setAdminTab('users')}><Users size={15}/> کاربران</button>
          <button className={adminTab === 'posts' ? 'active' : ''} onClick={() => setAdminTab('posts')}><LayoutDashboard size={15}/> مدیریت پست‌ها</button>
          <button className={adminTab === 'reports' ? 'active' : ''} onClick={() => setAdminTab('reports')}><Flag size={15}/> گزارش تخلف‌ها</button>
          <button className={adminTab === 'audit' ? 'active' : ''} onClick={() => setAdminTab('audit')}><ShieldCheck size={15}/> گزارش مدیریت</button>
          <button className={adminTab === 'access' ? 'active' : ''} onClick={() => setAdminTab('access')}><KeyRound size={15}/> ورود مهمان</button>
        </div>
        {overviewLoading ? <div className="admin-loading"><span className="spinner"/><span>در حال دریافت اطلاعات پنل…</span></div> : null}
        {adminTab === 'overview' && !overviewLoading && <div className="admin-overview-grid">
          <div className="admin-console-card"><strong>آخرین فعالیت‌ها</strong>{(overview?.posts ?? []).slice(0,5).map((post) => <div className="admin-activity-row" key={post.id}><span className="admin-activity-dot"/><div><b>{post.body || 'پست رسانه‌ای'}</b><small>{post.visibility === 'public' ? 'عمومی' : 'محدود'} · {new Date(post.created_at).toLocaleDateString('fa-IR')}</small></div></div>)}{!overview?.posts.length && <p>هنوز فعالیتی ثبت نشده است.</p>}</div>
          <div className="admin-console-card"><strong>آخرین اعضا</strong>{(overview?.users ?? []).slice(0,5).map((user) => <div className="admin-user-row" key={user.id}><span className="admin-user-avatar">{(user.display_name || 'ک').slice(0,1)}</span><div><b>{user.display_name || 'کاربر کاوه'}</b><small>{user.username ? '@' + user.username : 'نام کاربری ثبت نشده'}</small></div></div>)}</div>
        </div>}
        {adminTab === 'users' && <div className="admin-console-card">
          <div className="admin-audit-heading"><strong>مدیریت کاربران ({managedUsers.length})</strong><button className="button button-quiet" type="button" onClick={() => void refreshUsers()}><Activity size={15}/> تازه‌سازی</button></div>
          <p className="admin-user-policy-note">اخطار فقط در سوابق ثبت می‌شود. مسدودسازی ورود، ورود و تمدید نشست‌های جدید را متوقف می‌کند؛ نشست‌های دارای توکن فعال ممکن است تا زمان انقضای توکن دسترسی فعلی کار کنند. حساب‌های مدیریتی از این عملیات محافظت شده‌اند.</p>
          {usersLoading ? <div className="admin-loading"><span className="spinner"/><span>در حال دریافت کاربران…</span></div> : managedUsers.length === 0 ? <p>کاربری برای نمایش پیدا نشد.</p> : managedUsers.map((user) => {
            const isBanned = user.is_banned;
            const roleLabel = user.admin_role === 'owner' ? 'مالک' : user.admin_role === 'admin' ? 'مدیر' : user.admin_role === 'moderator' ? 'ناظر' : user.admin_role === 'support' ? 'پشتیبانی' : '';
            return <div className="admin-managed-user" key={user.id}>
              <div className="admin-user-row">
                <span className="admin-user-avatar">{(user.display_name || 'ک').slice(0,1)}</span>
                <div className="admin-managed-user-info">
                  <b>{user.display_name || 'کاربر کاوه'}</b>
                  <small>{user.email || (user.is_anonymous ? 'حساب مهمان' : 'ایمیل ثبت نشده')} · {user.username ? '@' + user.username : 'نام کاربری ثبت نشده'}</small>
                  <small>عضویت: {new Date(user.created_at).toLocaleDateString('fa-IR')} · آخرین ورود: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('fa-IR') : 'ثبت نشده'}</small>
                  {roleLabel ? <small className="admin-protected-label">حساب مدیریتی: {roleLabel} — محافظت‌شده</small> : isBanned ? <small className="admin-banned-label">محدود تا {new Date(user.banned_until!).toLocaleString('fa-IR')}</small> : <small>وضعیت حساب: عادی</small>}
                </div>
              </div>
              {canManageAdmins && user.admin_role !== 'owner' && <div className="admin-role-management">
                <select className="auth-input admin-role-select" value={adminRoleDrafts[user.id] ?? user.admin_role ?? 'admin'} onChange={(event) => setAdminRoleDrafts((current) => ({ ...current, [user.id]: event.target.value }))} disabled={userBusy !== null}>
                  <option value="admin">مدیر</option><option value="moderator">ناظر</option><option value="support">پشتیبانی</option>
                </select>
                <button className="button button-quiet" type="button" disabled={userBusy !== null} onClick={() => void manageAdminRole('set_admin_role', user.id)}>{user.admin_role ? 'ذخیره نقش' : 'افزودن به مدیران'}</button>
                {user.admin_role && <button className="button button-quiet admin-ban-button" type="button" disabled={userBusy !== null} onClick={() => void manageAdminRole('remove_admin_role', user.id)}>لغو دسترسی</button>}
              </div>}
              {!user.admin_role && <div className="admin-user-moderation">
                <input className="auth-input" type="text" maxLength={500} value={userReasons[user.id] ?? ''} onChange={(event) => setUserReasons((current) => ({ ...current, [user.id]: event.target.value }))} placeholder="دلیل اخطار یا محدودیت را بنویسید" disabled={userBusy === user.id}/>
                <div className="admin-user-actions">
                  <button className="button button-quiet" type="button" disabled={userBusy !== null} onClick={() => void moderateUser('warn_user', user.id)}>ثبت اخطار</button>
                  {isBanned ? <button className="button button-quiet" type="button" disabled={userBusy !== null} onClick={() => void moderateUser('unban_user', user.id)}><CheckCircle2 size={14}/> رفع محدودیت</button> : <>
                    <select className="auth-input admin-ban-duration" value={userDurations[user.id] ?? '24h'} onChange={(event) => setUserDurations((current) => ({ ...current, [user.id]: event.target.value }))} disabled={userBusy !== null}>
                      <option value="1h">۱ ساعت</option><option value="24h">۲۴ ساعت</option><option value="168h">۷ روز</option><option value="720h">۳۰ روز</option><option value="876000h">بلندمدت</option>
                    </select>
                    <button className="button button-quiet admin-ban-button" type="button" disabled={userBusy !== null} onClick={() => void moderateUser('ban_user', user.id)}><Ban size={14}/> مسدودسازی</button>
                  </>}
                </div>
              </div>}
              {userBusy === user.id && <small className="admin-user-busy">در حال اجرای عملیات…</small>}
            </div>;
          })}
        </div>}
        {adminTab === 'posts' && !overviewLoading && <div className="admin-console-card"><strong>مدیریت محتوا ({overview?.posts.length ?? 0} پست اخیر)</strong>{(overview?.posts ?? []).map((post) => <div className="admin-post-row" key={post.id}><div><b>{post.body || 'پست رسانه‌ای'}</b><small>{post.visibility === 'public' ? 'قابل مشاهده برای عموم' : 'محدود / مخفی'} · {new Date(post.created_at).toLocaleDateString('fa-IR')}</small></div><div className="admin-post-actions"><button className="icon-button" title={post.visibility === 'public' ? 'مخفی‌کردن' : 'عمومی‌کردن'} onClick={() => void moderatePost(post.id, post.visibility === 'public' ? 'private' : 'public')}>{post.visibility === 'public' ? <EyeOff size={16}/> : <Eye size={16}/>}</button><button className="icon-button admin-delete" title={deleteCandidate === post.id ? 'برای تأیید دوباره بزن' : 'حذف پست'} onClick={() => void deletePost(post.id)}><Trash2 size={16}/></button></div></div>)}</div>}
        {adminTab === 'reports' && <div className="admin-console-card">
          <div className="admin-audit-heading"><strong>صف بررسی گزارش‌ها ({reportRows.length})</strong><button className="button button-quiet" type="button" onClick={() => void refreshReports()}><Activity size={15}/> تازه‌سازی</button></div>
          {reportsLoading ? <div className="admin-loading"><span className="spinner"/><span>در حال دریافت گزارش‌ها…</span></div> : reportRows.length === 0 ? <p>گزارش ثبت‌شده‌ای برای بررسی وجود ندارد.</p> : reportRows.map((report) => <div className="admin-report-row" key={report.id}>
            <div className="admin-report-heading">
              <b>{report.target_type === 'user' ? 'گزارش درباره کاربر' : report.target_type === 'post' ? 'گزارش درباره پست' : report.target_type === 'comment' ? 'گزارش درباره دیدگاه' : report.target_type === 'message' ? 'گزارش درباره پیام' : report.target_type === 'group' ? 'گزارش درباره گروه' : report.target_type === 'channel' ? 'گزارش درباره کانال' : report.target_type === 'file' ? 'گزارش درباره فایل' : 'گزارش تخلف'}</b>
              <span className={`admin-report-status status-${report.status}`}>{report.status === 'open' ? 'باز' : report.status === 'reviewing' ? 'در حال بررسی' : report.status === 'resolved' ? 'تأیید و بسته‌شده' : 'ردشده'}</span>
            </div>
            <small>دلیل: {report.reason} · گزارش‌دهنده: {report.reporter_id.slice(0, 8)}… · شناسه هدف: {report.target_id.slice(0, 8)}…</small>
            {report.details && <p className="admin-report-details">{report.details}</p>}
            <small>{new Date(report.created_at).toLocaleString('fa-IR')}</small>
            {report.status !== 'resolved' && report.status !== 'rejected' && <div className="admin-report-actions">
              {report.status === 'open' && <button className="button button-quiet" type="button" disabled={userBusy !== null} onClick={() => void reviewReport(report.id, 'reviewing')}>شروع بررسی</button>}
              <button className="button button-quiet" type="button" disabled={userBusy !== null} onClick={() => void reviewReport(report.id, 'resolved')}>تأیید گزارش</button>
              <button className="button button-quiet admin-ban-button" type="button" disabled={userBusy !== null} onClick={() => void reviewReport(report.id, 'rejected')}>رد گزارش</button>
            </div>}
            {userBusy === report.id && <small className="admin-user-busy">در حال ثبت نتیجه…</small>}
          </div>)}
        </div>}
        {adminTab === 'audit' && <div className="admin-console-card">
          <div className="admin-audit-heading"><strong>گزارش عملیات حساس (۱۰۰ مورد اخیر)</strong><button className="button button-quiet" type="button" onClick={() => void refreshAudit()}><Activity size={15}/> تازه‌سازی</button></div>
          {auditLoading ? <div className="admin-loading"><span className="spinner"/><span>در حال دریافت گزارش‌ها…</span></div> : auditRows.length === 0 ? <p>هنوز عملیات مدیریتی ثبت نشده است.</p> : auditRows.map((entry) => <div className="admin-activity-row" key={entry.id}>
            <span className="admin-activity-dot"/>
            <div>
              <b>{entry.action === 'delete_post' ? 'حذف پست' : entry.action === 'moderate_post' ? 'تغییر وضعیت پست' : entry.action === 'warn_user' ? 'اخطار به کاربر' : entry.action === 'ban_user' ? 'مسدودسازی کاربر' : entry.action === 'unban_user' ? 'رفع مسدودی کاربر' : entry.action === 'set_admin_role' ? 'تغییر نقش مدیریتی' : entry.action === 'remove_admin_role' ? 'لغو دسترسی مدیریتی' : entry.action === 'review_report' ? 'بررسی گزارش تخلف' : entry.action}</b>
              <small>{entry.target_type === 'user' ? 'شناسه کاربر: ' : entry.target_type === 'report' ? 'شناسه گزارش: ' : 'شناسه محتوا: '}{entry.target_id.slice(0, 8)}… · مدیر: {entry.actor_id?.slice(0, 8) ?? 'نامشخص'} · {entry.status === 'succeeded' ? 'موفق' : entry.status === 'failed' ? 'ناموفق' : 'در حال اجرا'}</small>
              <small>{entry.details?.visibility ? 'وضعیت مقصد: ' + String(entry.details.visibility) + ' · ' : ''}{entry.details?.duration ? 'مدت محدودیت: ' + String(entry.details.duration) + ' · ' : ''}{entry.details?.role ? 'نقش: ' + String(entry.details.role) + ' · ' : ''}{entry.details?.previous_role ? 'نقش قبلی: ' + String(entry.details.previous_role) + ' · ' : ''}{entry.details?.reason ? 'دلیل: ' + String(entry.details.reason) + ' · ' : ''}{new Date(entry.created_at).toLocaleString('fa-IR')}</small>
            </div>
          </div>)}
        </div>}
      </section>
      {adminTab === 'access' && <section className="settings-card admin-access-card">
        <div className="side-info-title"><ShieldCheck size={19}/><strong>تنظیمات دسترسی مهمان</strong></div>
        {loadError && <div className="notice notice-error" role="alert">{loadError}</div>}
        {loading ? (
          <div className="admin-loading"><span className="spinner"/><span>در حال دریافت تنظیمات…</span></div>
        ) : !loadError ? (
          <>
            <p>هر فردی که کد معتبر را داشته باشد، یک حساب مهمان مستقل می‌سازد. این روش به ایمیل نیاز ندارد و به حساب مدیر یا کاربران دیگر وارد نمی‌شود.</p>
            <div className="setting-choice admin-toggle-row">
              <div><strong>فعال بودن ورود با کد</strong><small>{enabled ? 'کاربران می‌توانند با کد وارد شوند.' : 'ورود با کد برای همه غیرفعال است.'}</small></div>
              <button
                className={`switch ${enabled ? 'on' : ''}`}
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => setEnabled((value) => !value)}
                disabled={saving}
                aria-label="فعال یا غیرفعال کردن ورود با کد"
              ><i/></button>
            </div>
            <label className="auth-label" htmlFor="admin-access-code">تنظیم کد جدید (اختیاری)</label>
            <input
              id="admin-access-code"
              className="auth-input admin-code-input"
              type="text"
              inputMode="text"
              autoComplete="off"
              maxLength={6}
              pattern="[A-Za-z0-9]{6}"
              dir="ltr"
              placeholder="برای حفظ کد فعلی خالی بگذارید"
              value={newCode}
              onChange={(event) => setNewCode(normalizeAccessCode(event.target.value))}
              disabled={saving}
            />
            <p className="admin-security-note">کد دسترسی فقط به‌صورت هش امن در پایگاه داده نگهداری می‌شود و پس از ذخیره قابل مشاهده نیست. برای استفاده عمومی، یک کد تصادفی و غیرقابل حدس انتخاب کنید.</p>
            <div className="admin-access-footer">
              <span><KeyRound size={14}/> پنج تلاش اشتباه، محدودیت ۱۵ دقیقه‌ای ایجاد می‌کند.</span>
              <button className="button button-primary" type="button" onClick={() => void save()} disabled={saving}>
                <Save size={16}/>{saving ? 'در حال ذخیره…' : 'ذخیره تنظیمات'}
              </button>
            </div>
          </>
        ) : null}
      </section>}
    </div>
  );
}
