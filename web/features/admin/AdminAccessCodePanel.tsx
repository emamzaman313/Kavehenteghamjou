'use client';

import { Activity, Eye, EyeOff, Film, KeyRound, LayoutDashboard, MessageCircle, Save, ShieldCheck, Trash2, Users } from 'lucide-react';
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
  const [adminTab, setAdminTab] = useState<'overview' | 'users' | 'posts' | 'audit' | 'access'>('overview');
  const [auditRows, setAuditRows] = useState<{ id: string; actor_id: string | null; action: string; target_id: string; status: string; details: Record<string, unknown>; created_at: string; completed_at: string | null }[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
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

  useEffect(() => { void refreshOverview(); }, [refreshOverview]);
  useEffect(() => {
    if (adminTab === 'audit') void refreshAudit();
  }, [adminTab, refreshAudit]);

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
          <button className={adminTab === 'audit' ? 'active' : ''} onClick={() => setAdminTab('audit')}><ShieldCheck size={15}/> گزارش مدیریت</button>
          <button className={adminTab === 'access' ? 'active' : ''} onClick={() => setAdminTab('access')}><KeyRound size={15}/> ورود مهمان</button>
        </div>
        {overviewLoading ? <div className="admin-loading"><span className="spinner"/><span>در حال دریافت اطلاعات پنل…</span></div> : null}
        {adminTab === 'overview' && !overviewLoading && <div className="admin-overview-grid">
          <div className="admin-console-card"><strong>آخرین فعالیت‌ها</strong>{(overview?.posts ?? []).slice(0,5).map((post) => <div className="admin-activity-row" key={post.id}><span className="admin-activity-dot"/><div><b>{post.body || 'پست رسانه‌ای'}</b><small>{post.visibility === 'public' ? 'عمومی' : 'محدود'} · {new Date(post.created_at).toLocaleDateString('fa-IR')}</small></div></div>)}{!overview?.posts.length && <p>هنوز فعالیتی ثبت نشده است.</p>}</div>
          <div className="admin-console-card"><strong>آخرین اعضا</strong>{(overview?.users ?? []).slice(0,5).map((user) => <div className="admin-user-row" key={user.id}><span className="admin-user-avatar">{(user.display_name || 'ک').slice(0,1)}</span><div><b>{user.display_name || 'کاربر کاوه'}</b><small>{user.username ? '@' + user.username : 'نام کاربری ثبت نشده'}</small></div></div>)}</div>
        </div>}
        {adminTab === 'users' && !overviewLoading && <div className="admin-console-card"><strong>فهرست کاربران ({overview?.users.length ?? 0})</strong>{(overview?.users ?? []).map((user) => <div className="admin-user-row" key={user.id}><span className="admin-user-avatar">{(user.display_name || 'ک').slice(0,1)}</span><div><b>{user.display_name || 'کاربر کاوه'}</b><small>{user.username ? '@' + user.username : 'نام کاربری ثبت نشده'} · {new Date(user.created_at).toLocaleDateString('fa-IR')}</small></div></div>)}</div>}
        {adminTab === 'posts' && !overviewLoading && <div className="admin-console-card"><strong>مدیریت محتوا ({overview?.posts.length ?? 0} پست اخیر)</strong>{(overview?.posts ?? []).map((post) => <div className="admin-post-row" key={post.id}><div><b>{post.body || 'پست رسانه‌ای'}</b><small>{post.visibility === 'public' ? 'قابل مشاهده برای عموم' : 'محدود / مخفی'} · {new Date(post.created_at).toLocaleDateString('fa-IR')}</small></div><div className="admin-post-actions"><button className="icon-button" title={post.visibility === 'public' ? 'مخفی‌کردن' : 'عمومی‌کردن'} onClick={() => void moderatePost(post.id, post.visibility === 'public' ? 'private' : 'public')}>{post.visibility === 'public' ? <EyeOff size={16}/> : <Eye size={16}/>}</button><button className="icon-button admin-delete" title={deleteCandidate === post.id ? 'برای تأیید دوباره بزن' : 'حذف پست'} onClick={() => void deletePost(post.id)}><Trash2 size={16}/></button></div></div>)}</div>}
        {adminTab === 'audit' && <div className="admin-console-card">
          <div className="admin-audit-heading"><strong>گزارش عملیات حساس (۱۰۰ مورد اخیر)</strong><button className="button button-quiet" type="button" onClick={() => void refreshAudit()}><Activity size={15}/> تازه‌سازی</button></div>
          {auditLoading ? <div className="admin-loading"><span className="spinner"/><span>در حال دریافت گزارش‌ها…</span></div> : auditRows.length === 0 ? <p>هنوز عملیات مدیریتی ثبت نشده است.</p> : auditRows.map((entry) => <div className="admin-activity-row" key={entry.id}>
            <span className="admin-activity-dot"/>
            <div>
              <b>{entry.action === 'delete_post' ? 'حذف پست' : entry.action === 'moderate_post' ? 'تغییر وضعیت پست' : entry.action}</b>
              <small>شناسه محتوا: {entry.target_id.slice(0, 8)}… · مدیر: {entry.actor_id?.slice(0, 8) ?? 'نامشخص'} · {entry.status === 'succeeded' ? 'موفق' : entry.status === 'failed' ? 'ناموفق' : 'در حال اجرا'}</small>
              <small>{entry.details?.visibility ? 'وضعیت مقصد: ' + String(entry.details.visibility) + ' · ' : ''}{new Date(entry.created_at).toLocaleString('fa-IR')}</small>
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
