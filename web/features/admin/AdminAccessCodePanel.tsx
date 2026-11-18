'use client';

import { KeyRound, Save, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Notify } from '@/lib/ui-types';
import { SectionHeader } from '@/components/ui';

export default function AdminAccessCodePanel({ supabase, notify }: { supabase: SupabaseClient; notify: Notify }) {
  const [enabled, setEnabled] = useState(true);
  const [newCode, setNewCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

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
    if (normalizedCode && !/^[A-Z0-9]{6}$/.test(normalizedCode)) {
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
        eyebrow="مدیریت سایت"
        title="ورود با کد دسترسی"
        description="فعال یا غیرفعال‌کردن ورود مهمان و تغییر کد مشترک سایت."
      />
      <section className="settings-card admin-access-card">
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
              onChange={(event) => setNewCode(event.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase())}
              disabled={saving}
            />
            <p className="admin-security-note">کد اولیه 123456 است. برای امنیت بیشتر آن را به کدی غیرقابل حدس تغییر دهید. کد در پایگاه داده به‌صورت هش ذخیره می‌شود و پس از ذخیره قابل مشاهده نیست.</p>
            <div className="admin-access-footer">
              <span><KeyRound size={14}/> پنج تلاش اشتباه، محدودیت ۱۵ دقیقه‌ای ایجاد می‌کند.</span>
              <button className="button button-primary" type="button" onClick={() => void save()} disabled={saving}>
                <Save size={16}/>{saving ? 'در حال ذخیره…' : 'ذخیره تنظیمات'}
              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
