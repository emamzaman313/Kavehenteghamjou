'use client';

import { ArrowLeft, File, Mail, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BrandMark } from '@/components/ui';
import { authErrorMessage } from '@/lib/auth-errors';

type LoginStep = 'email' | 'sent';

export default function LoginScreen({ supabase, configured }: { supabase: SupabaseClient | null; configured: boolean }) {
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

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
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) {
        setError(authErrorMessage(authError));
        if (Number((authError as { status?: unknown }).status) === 429) setResendIn(10);
        return;
      }

      setEmail(normalizedEmail);
      setStep('sent');
      setResendIn(10);
      setNotice('پیوند یک‌بارمصرف ورود ارسال شد. ایمیل را باز کنید و روی لینک ورود بزنید؛ نیازی به واردکردن کد ۶ رقمی نیست. پوشه هرزنامه را هم بررسی کنید.');
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
        <form className="auth-form" onSubmit={(event) => void sendLink(event)}>
          <label className="auth-label" htmlFor="login-email">آدرس ایمیل</label>
          <input id="login-email" className="auth-input" type="email" inputMode="email" autoComplete="email" dir="ltr" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={!configured || busy}/>
          <button className="google-button" type="submit" disabled={!configured || busy || !email.trim()}>
            {busy ? <span className="spinner small"/> : <Mail size={18}/>}
            <span>{busy ? 'در حال ارسال لینک…' : 'ارسال لینک ورود به ایمیل'}</span><ArrowLeft size={17}/>
          </button>
        </form>
      ) : (
        <div className="auth-form">
          <p className="auth-code-hint">پیوند ورود برای <b dir="ltr">{email}</b> ارسال شد. صندوق ورودی را باز کنید و روی لینک ورود به کاوه انتقامجو بزنید.</p>
          <div className="auth-secondary-actions">
            <button type="button" onClick={() => { setStep('email'); setError(''); setNotice(''); }} disabled={busy}>تغییر ایمیل</button>
            <button type="button" onClick={() => void sendLink()} disabled={busy || resendIn > 0}>{busy ? 'در حال ارسال…' : resendIn > 0 ? `ارسال دوباره لینک (${resendIn})` : 'ارسال دوباره لینک'}</button>
          </div>
        </div>
      )}
      <p className="auth-foot"><ShieldCheck size={14}/> ورود امن با پیوند یک‌بارمصرف ایمیل؛ بدون نیاز به حساب گوگل</p>
    </section>
    <span className="auth-version">KAVEH AVENGER · WEB</span>
  </main>;
}
