'use client';

import { ArrowLeft, File, KeyRound, Mail, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BrandMark } from '@/components/ui';
import { authErrorMessage } from '@/lib/auth-errors';
import { normalizeAccessCode } from '@/lib/access-code';

type LoginStep = 'email' | 'sent' | 'setup' | 'password' | 'access';

export default function LoginScreen({ supabase, configured }: { supabase: SupabaseClient | null; configured: boolean }) {
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
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
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (active && user?.email && user.user_metadata?.account_password_ready !== true) {
        setEmail(user.email);
        setStep('setup');
        setNotice('ایمیل شما تأیید شده است؛ برای تکمیل ثبت‌نام، رمز عبور بسازید.');
      }
    });
    return () => { active = false; };
  }, [supabase]);

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

  const sendSignupCode = async (event?: FormEvent<HTMLFormElement>) => {
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
        options: { shouldCreateUser: true },
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
      setNotice('کد تأیید به ایمیل ارسال شد. فقط کد آخرین ایمیل را وارد کنید.');
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
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: normalizeOtp(emailOtp),
        type: 'email',
      });
      if (verifyError) {
        setError(authErrorMessage(verifyError));
        return;
      }
      if (!data.session?.access_token || !data.session?.refresh_token) {
        setError('کد تأیید شد اما نشست ورود دریافت نشد. یک کد تازه درخواست کنید.');
        return;
      }
      setEmail(data.user?.email || email.trim().toLowerCase());
      setStep('setup');
      setNotice('ایمیل تأیید شد. اکنون رمز عبور حساب خود را انتخاب کنید.');
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const finishRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy) return;
    if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError('رمز عبور باید حداقل ۱۰ نویسه و شامل حروف کوچک و بزرگ انگلیسی، عدد و نماد باشد.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('تکرار رمز عبور دقیقاً با رمز اول یکسان نیست.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { account_password_ready: true },
      });
      if (updateError) {
        setError(authErrorMessage(updateError));
        return;
      }
      setNotice('ثبت‌نام با موفقیت تکمیل شد. حساب شما اکنون با ایمیل و رمز عبور قابل ورود است.');
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
      setPassword('');
      setPasswordConfirm('');
    }
  };

  const loginWithPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy || !email.trim() || !password) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (loginError) {
        setError('ایمیل یا رمز عبور صحیح نیست. اگر هنوز حساب نساخته‌اید، ثبت‌نام با کد ایمیل را انجام دهید.');
        return;
      }
      if (data.user?.user_metadata?.account_password_ready !== true) {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: { account_password_ready: true },
        });
        if (metadataError) {
          setError('ورود انجام شد اما تکمیل وضعیت حساب ناموفق بود. دوباره تلاش کنید.');
          return;
        }
      }
      setNotice('ورود با موفقیت انجام شد.');
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
      setPassword('');
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
      if (sessionError) setError(authErrorMessage(sessionError));
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const openStep = (next: LoginStep) => {
    setStep(next);
    setPassword('');
    setPasswordConfirm('');
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

      {step === 'email' && <>
        <form className="auth-form" onSubmit={(event) => void sendSignupCode(event)}>
          <label className="auth-label" htmlFor="login-email">آدرس ایمیل</label>
          <input id="login-email" className="auth-input" type="email" inputMode="email" autoComplete="email" dir="ltr" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={!configured || busy}/>
          <button className="google-button" type="submit" disabled={!configured || busy || !email.trim() || resendIn > 0}>
            {busy ? <span className="spinner small"/> : <Mail size={18}/>}
            <span>{busy ? 'در حال ارسال کد…' : resendIn > 0 ? 'ارسال کد (' + resendIn + ')' : 'ثبت‌نام با ایمیل و کد تأیید'}</span><ArrowLeft size={17}/>
          </button>
        </form>
        <button className="auth-alternate-button" type="button" onClick={() => openStep('password')} disabled={!configured || busy}>
          <KeyRound size={17}/> ورود با ایمیل و رمز عبور
        </button>
        <button className="auth-text-button" type="button" onClick={() => openStep('access')} disabled={!configured || busy}>ورود با کد دسترسی</button>
      </>}

      {step === 'sent' && <div className="auth-form">
        <p className="auth-code-hint">کد تأیید برای <b dir="ltr">{email}</b> ارسال شد. تمام ارقام کد آخرین ایمیل را وارد کنید.</p>
        <form className="auth-form" onSubmit={(event) => void verifyEmailOtp(event)}>
          <label className="auth-label" htmlFor="login-email-otp">کد تأیید ایمیل (هر تعداد رقم)</label>
          <input id="login-email-otp" className="auth-input auth-code-input" type="text" inputMode="numeric" autoComplete="one-time-code" dir="ltr" placeholder="تمام ارقام کد ایمیل را وارد کنید" value={emailOtp} onChange={(event) => setEmailOtp(normalizeOtp(event.target.value))} required disabled={busy} aria-label="کد تأیید ایمیل"/>
          <button className="google-button" type="submit" disabled={busy || !/^\d+$/.test(normalizeOtp(emailOtp))}>
            {busy ? <span className="spinner small"/> : <ShieldCheck size={18}/>}
            <span>{busy ? 'در حال بررسی کد…' : 'تأیید ایمیل و ادامه ثبت‌نام'}</span><ArrowLeft size={17}/>
          </button>
        </form>
        <div className="auth-secondary-actions">
          <button type="button" onClick={() => openStep('email')} disabled={busy}>تغییر ایمیل</button>
          <button type="button" onClick={() => void sendSignupCode()} disabled={busy || resendIn > 0}>{busy ? 'در حال ارسال…' : resendIn > 0 ? 'ارسال دوباره (' + resendIn + ')' : 'ارسال دوباره کد'}</button>
        </div>
      </div>}

      {step === 'setup' && <form className="auth-form" onSubmit={(event) => void finishRegistration(event)}>
        <p className="auth-code-hint">ایمیل <b dir="ltr">{email}</b> تأیید شده است. یک رمز امن بسازید تا دفعات بعد بدون کد ایمیل وارد شوید.</p>
        <label className="auth-label" htmlFor="signup-password">انتخاب رمز عبور</label>
        <input id="signup-password" className="auth-input" type="password" autoComplete="new-password" dir="ltr" minLength={8} placeholder="حداقل ۱۰ نویسه، حروف بزرگ و کوچک، عدد و نماد" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy}/>
        <label className="auth-label" htmlFor="signup-password-confirm">تکرار رمز عبور</label>
        <input id="signup-password-confirm" className="auth-input" type="password" autoComplete="new-password" dir="ltr" minLength={8} placeholder="دقیقاً همان رمز را دوباره وارد کنید" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} required disabled={busy}/>
        {passwordConfirm && password !== passwordConfirm && <p className="auth-code-hint">دو رمز با هم یکسان نیستند.</p>}
        <button className="google-button" type="submit" disabled={busy || password.length < 8 || password !== passwordConfirm}>
          {busy ? <span className="spinner small"/> : <ShieldCheck size={18}/>}
          <span>{busy ? 'در حال ساخت حساب…' : 'تکمیل ثبت‌نام و ساخت حساب'}</span><ArrowLeft size={17}/>
        </button>
      </form>}

      {step === 'password' && <form className="auth-form" onSubmit={(event) => void loginWithPassword(event)}>
        <p className="auth-code-hint">با ایمیل و رمز عبوری که هنگام ثبت‌نام ساخته‌اید وارد شوید.</p>
        <label className="auth-label" htmlFor="login-password-email">آدرس ایمیل</label>
        <input id="login-password-email" className="auth-input" type="email" inputMode="email" autoComplete="email" dir="ltr" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy}/>
        <label className="auth-label" htmlFor="login-password">رمز عبور</label>
        <input id="login-password" className="auth-input" type="password" autoComplete="current-password" dir="ltr" placeholder="رمز عبور حساب" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy}/>
        <button className="google-button" type="submit" disabled={busy || !email.trim() || !password}>
          {busy ? <span className="spinner small"/> : <KeyRound size={18}/>}
          <span>{busy ? 'در حال ورود…' : 'ورود به حساب'}</span><ArrowLeft size={17}/>
        </button>
        <div className="auth-secondary-actions"><button type="button" onClick={() => openStep('email')} disabled={busy}>بازگشت</button></div>
      </form>}

      {step === 'access' && <form className="auth-form" onSubmit={(event) => void loginWithAccessCode(event)}>
        <p className="auth-code-hint">کد شش‌کاراکتری دسترسی را وارد کنید. با این روش یک حساب مهمان مستقل برای شما ساخته می‌شود.</p>
        {accessEnabled === false && <div className="notice notice-warn">ورود با کد دسترسی فعلاً غیرفعال است یا سرویس آن در دسترس نیست.</div>}
        <label className="auth-label" htmlFor="login-access-code">کد دسترسی ۶ کاراکتری</label>
        <input id="login-access-code" className="auth-input auth-code-input" type="text" inputMode="text" autoComplete="one-time-code" pattern="[A-Za-z0-9]{6}" maxLength={6} dir="ltr" placeholder="••••••" value={accessCode} onChange={(event) => setAccessCode(normalizeAccessCode(event.target.value))} required disabled={busy || accessEnabled !== true}/>
        <button className="google-button" type="submit" disabled={busy || accessEnabled !== true || accessCode.length !== 6}>
          {busy ? <span className="spinner small"/> : <KeyRound size={18}/>}
          <span>{busy ? 'در حال بررسی کد…' : 'ورود بدون ثبت‌نام ایمیلی'}</span><ArrowLeft size={17}/>
        </button>
        <p className="auth-access-foot">هر مهمان حساب جداگانه دارد. حساب مهمان با خروج یا پاک‌شدن داده‌های مرورگر قابل بازیابی نیست.</p>
        <div className="auth-secondary-actions"><button type="button" onClick={() => openStep('email')} disabled={busy}>بازگشت</button></div>
      </form>}

      <p className="auth-foot"><ShieldCheck size={14}/> رمز عبور فقط به‌صورت هش‌شده در سرویس احراز هویت ذخیره می‌شود.</p>
    </section>
    <span className="auth-version">KAVEH AVENGER · WEB</span>
  </main>;
}
