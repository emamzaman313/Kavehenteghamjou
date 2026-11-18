'use client';

import { ArrowLeft, File, Mail, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BrandMark } from '@/components/ui';
import { authErrorMessage } from '@/lib/auth-errors';

type LoginStep = 'email' | 'code';

export default function LoginScreen({ supabase, configured }: { supabase: SupabaseClient | null; configured: boolean }) {
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const sendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy) return;
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
        return;
      }
      setEmail(normalizedEmail);
      setStep('code');
      setNotice('کد ۶ رقمی به ایمیل شما ارسال شد. صندوق ورودی و پوشه هرزنامه را بررسی کنید.');
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy || code.length !== 6) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: authError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: 'email',
      });
      if (authError) {
        setError(authErrorMessage(authError));
        return;
      }
      // KavehApp listens to onAuthStateChange and opens the signed-in app.
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
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

      {step === 'email' ? (
        <form className="auth-form" onSubmit={sendCode}>
          <label className="auth-label" htmlFor="login-email">آدرس ایمیل</label>
          <input id="login-email" className="auth-input" type="email" inputMode="email" autoComplete="email" dir="ltr" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={!configured || busy}/>
          <button className="google-button" type="submit" disabled={!configured || busy || !email.trim()}>
            {busy ? <span className="spinner small"/> : <Mail size={18}/>}
            <span>{busy ? 'در حال ارسال کد…' : 'ارسال کد ورود به ایمیل'}</span><ArrowLeft size={17}/>
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={verifyCode}>
          <p className="auth-code-hint">کد ارسال‌شده به <b dir="ltr">{email}</b> را وارد کنید.</p>
          <label className="auth-label" htmlFor="login-code">کد تأیید ۶ رقمی</label>
          <input id="login-code" className="auth-input auth-code-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} dir="ltr" placeholder="۱۲۳۴۵۶" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required disabled={busy}/>
          <button className="google-button" type="submit" disabled={busy || code.length !== 6}>
            {busy ? <span className="spinner small"/> : <ShieldCheck size={18}/>}
            <span>{busy ? 'در حال بررسی کد…' : 'تأیید کد و ورود به کاوه'}</span><ArrowLeft size={17}/>
          </button>
          <div className="auth-secondary-actions">
            <button type="button" onClick={() => { setStep('email'); setCode(''); setError(''); setNotice(''); }} disabled={busy}>تغییر ایمیل</button>
            <button type="button" onClick={(event) => void sendCode(event as unknown as FormEvent<HTMLFormElement>)} disabled={busy}>ارسال دوباره کد</button>
          </div>
        </form>
      )}
      <p className="auth-foot"><ShieldCheck size={14}/> ورود امن با کد یک‌بارمصرف ایمیل؛ بدون نیاز به حساب گوگل</p>
    </section>
    <span className="auth-version">KAVEH AVENGER · WEB</span>
  </main>;
}
