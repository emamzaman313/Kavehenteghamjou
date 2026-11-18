'use client';

import { ArrowLeft, File, KeyRound, Mail, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BrandMark } from '@/components/ui';
import { authErrorMessage } from '@/lib/auth-errors';
import { normalizeAccessCode } from '@/lib/access-code';

type LoginStep = 'email' | 'sent' | 'access';

export default function LoginScreen({ supabase, configured }: { supabase: SupabaseClient | null; configured: boolean }) {
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [accessEnabled, setAccessEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendIn, setResendIn] = useState(0);

  const normalizeOtp = (value: string) => value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\D/g, '');

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.functions.invoke('access-code-login', { body: { action: 'status' } })
      .then(({ data, error: functionError }) => {
        if (active) setAccessEnabled(!functionError && data?.ok === true && data?.enabled === true);
      })
      .catch(() => { if (active) setAccessEnabled(false); });
    return () => { active = false; };
  }, [supabase]);

  const sendLink = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!supabase || busy || resendIn > 0) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
        },
      });
      if (authError) {
        setError(authErrorMessage(authError));
        if (Number((authError as { status?: unknown }).status) === 429) setResendIn(30);
        return;
      }

      setEmail(normalizedEmail);
      setEmailOtp('');
      setStep('sent');
      setResendIn(30);
      setNotice('کد ورود به ایمیل ارسال شد. تمام ارقام کد آخرین ایمیل را وارد کنید؛ ایمیل‌های قبلی را نادیده بگیرید.');
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const verifyEmailOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy || !/^\d+$/.test(normalizeOtp(emailOtp))) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: normalizeOtp(emailOtp),
        type: 'email',
      });
      if (verifyError) {
        setError(authErrorMessage(verifyError));
        return;
      }
      if (!verifyData.session?.access_token || !verifyData.session?.refresh_token) {
        setError('کد تأیید شد اما نشست ورود از سرویس دریافت نشد. دوباره کد تازه درخواست کنید.');
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: verifyData.session.access_token,
        refresh_token: verifyData.session.refresh_token,
      });
      if (sessionError) {
        setError(authErrorMessage(sessionError));
        return;
      }
      setNotice('کد تأیید شد. در حال ورود به حساب شما…');
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const loginWithAccessCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy || accessCode.length !== 6 || accessEnabled !== true) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: functionError } = await supabase.functions.invoke('access-code-login', {
        body: { action: 'login', code: accessCode },
      });
      if (functionError) {
        const status = Number((functionError as { context?: { status?: unknown } }).context?.status);
        setError(status === 429
          ? 'به‌دلیل چند تلاش ناموفق، ورود با کد موقتاً محدود شده است. ۱۵ دقیقه بعد دوباره تلاش کنید.'
          : 'اتصال به سرویس ورود با کد برقرار نشد. کمی بعد دوباره تلاش کنید.');
        return;
      }
      if (data?.ok !== true || !data?.session?.access_token || !data?.session?.refresh_token) {
        const messages: Record<string, string> = {
          invalid_code: 'کد دسترسی نادرست است. دوباره بررسی کنید.',
          disabled: 'ورود با کد دسترسی فعلاً توسط مدیر غیرفعال شده است.',
          rate_limited: 'تعداد تلاش‌های ناموفق زیاد شده است. کمی بعد دوباره تلاش کنید.',
          not_configured: 'تنظیمات ورود با کد هنوز کامل نشده است.',
        };
        setError(messages[String(data?.reason)] || 'ورود مهمان انجام نشد. دوباره تلاش کنید.');
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (sessionError) {
        setError(authErrorMessage(sessionError));
        return;
      }
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const openAccessCode = () => {
    setStep('access');
    setAccessCode('');
    setError('');
    setNotice('');
  };

  return <main className="auth-screen">
    <div className="auth-glow auth-glow-a"/><div className="auth-glow auth-glow-b"/>
    <section className="auth-card">
      <BrandMark />
      <div className="eyebrow"><span/> فضای ارتباطی مستقل</div>
      <h1>کاوه <em>انتقامجو</em></h1>
      <p className="auth-copy">گفتگو، انتشار و اشتراک‌گذاری فایل؛ در یک فضای شخصی و امن.</p>
      <div className="auth-features"><span><MessageCircle size={15}/> گفتگوهای زنده</span><span><File size={15}/> فضای فایل خصوصی</span><span><Sparkles size={15}/> هویت اجتماعی</span></div>
      {!configured && <div className="notice notice-error">تنظیمات اتصال Supabase در محیط وب کامل نیست. مدیر فنی باید متغیرهای عمومی Supabase را در محیط Production بررسی کند.</div>}
      {error && <div className="notice notice-error" role="alert" aria-live="polite">{error}</div>}
      {notice && <div className="notice notice-success" role="status" aria-live="polite">{notice}</div>}

      {step === 'email' && (
        <>
          <form className="auth-form" onSubmit={(event) => void sendLink(event)}>
            <label className="auth-label" htmlFor="login-email">آدرس ایمیل</label>
            <input id="login-email" className="auth-input" type="email" inputMode="email" autoComplete="email" dir="ltr" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={!configured || busy}/>
            <button className="google-button" type="submit" disabled={!configured || busy || !email.trim()}>
              {busy ? <span className="spinner small"/> : <Mail size={18}/>}
              <span>{busy ? 'در حال ارسال کد…' : 'ورود / ثبت‌نام با کد ایمیل'}</span><ArrowLeft size={17}/>
            </button>
          </form>
          <button className="auth-alternate-button" type="button" onClick={openAccessCode} disabled={!configured || busy}>
            <KeyRound size={17}/> ورود با کد دسترسی
          </button>
        </>
      )}

      {step === 'sent' && (
        <div className="auth-form">
          <p className="auth-code-hint">کد ورود برای <b dir="ltr">{email}</b> ارسال شد. تمام ارقام کد آخرین ایمیل را در کادر زیر وارد کنید.</p>
          <form className="auth-form" onSubmit={(event) => void verifyEmailOtp(event)}>
            <label className="auth-label" htmlFor="login-email-otp">کد تأیید ایمیل</label>
            <input
              id="login-email-otp"
              className="auth-input auth-code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              placeholder="۱۲۳۴۵۶"
              value={emailOtp}
              onChange={(event) => setEmailOtp(normalizeOtp(event.target.value))}
              required
              disabled={busy}
              aria-label="کد تأیید ایمیل"
            />
            <button className="google-button" type="submit" disabled={busy || !/^\d+$/.test(normalizeOtp(emailOtp))}>
              {busy ? <span className="spinner small"/> : <ShieldCheck size={18}/>}
              <span>{busy ? 'در حال بررسی کد…' : 'تأیید کد و ورود'}</span><ArrowLeft size={17}/>
            </button>
          </form>
          <div className="auth-secondary-actions">
            <button type="button" onClick={() => { setStep('email'); setError(''); setNotice(''); }} disabled={busy}>تغییر ایمیل</button>
            <button type="button" onClick={() => void sendLink()} disabled={busy || resendIn > 0}>{busy ? 'در حال ارسال…' : resendIn > 0 ? `ارسال دوباره کد (${resendIn})` : 'ارسال دوباره ایمیل'}</button>
          </div>
          <button className="auth-text-button" type="button" onClick={openAccessCode}>ورود با کد دسترسی</button>
        </div>
      )}

      {step === 'access' && (
        <form className="auth-form" onSubmit={(event) => void loginWithAccessCode(event)}>
          <p className="auth-code-hint">کد شش‌کاراکتری دسترسی را وارد کنید. با این روش یک حساب مهمان مستقل برای شما ساخته می‌شود و نیازی به ثبت‌نام ایمیلی نیست.</p>
          {accessEnabled === false && <div className="notice notice-warn">ورود با کد دسترسی فعلاً غیرفعال است یا سرویس آن در دسترس نیست.</div>}
          <label className="auth-label" htmlFor="login-access-code">کد دسترسی ۶ کاراکتری</label>
          <input
            id="login-access-code"
            className="auth-input auth-code-input"
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            pattern="[A-Za-z0-9]{6}"
            maxLength={6}
            dir="ltr"
            placeholder="••••••"
            value={accessCode}
            onChange={(event) => setAccessCode(normalizeAccessCode(event.target.value))}
            required
            disabled={busy || accessEnabled !== true}
          />
          <button className="google-button" type="submit" disabled={busy || accessEnabled !== true || accessCode.length !== 6}>
            {busy ? <span className="spinner small"/> : <KeyRound size={18}/>}
            <span>{busy ? 'در حال بررسی کد…' : 'ورود بدون ثبت‌نام ایمیلی'}</span><ArrowLeft size={17}/>
          </button>
          <p className="auth-access-foot">هر مهمان حساب جداگانه دارد و به حساب دیگران دسترسی پیدا نمی‌کند. چون ورود ایمیلی انجام نمی‌شود، پس از خروج یا پاک‌شدن داده‌های مرورگر، حساب مهمان قابل بازیابی نیست؛ برای حساب دائمی از ورود ایمیلی استفاده کنید.</p>
          <div className="auth-secondary-actions">
            <button type="button" onClick={() => { setStep('email'); setError(''); setNotice(''); }} disabled={busy}>ثبت‌نام / ورود با ایمیل</button>
          </div>
        </form>
      )}

      <p className="auth-foot"><ShieldCheck size={14}/> ورود امن با کد ایمیل یا کد دسترسی مدیریت‌شده</p>
    </section>
    <span className="auth-version">KAVEH AVENGER · WEB</span>
  </main>;
}
