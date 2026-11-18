'use client';

import { ArrowLeft, File, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BrandMark } from '@/components/ui';
import { authErrorMessage } from '@/lib/auth-errors';

export default function LoginScreen({ supabase, configured }: { supabase: SupabaseClient | null; configured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const signIn = async () => {
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'select_account' },
        },
      });
      if (authError) setError(authErrorMessage(authError));
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      // A successful OAuth call has already initiated navigation; failures must
      // always release the control so the user can retry.
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
      <button className="google-button" onClick={signIn} disabled={!configured || busy}>
        {busy ? <span className="spinner small"/> : <GoogleGlyph/>}
        <span>{busy ? 'در حال انتقال به گوگل…' : error ? 'تلاش دوباره با Google' : 'ورود امن با حساب گوگل'}</span><ArrowLeft size={17}/>
      </button>
      <p className="auth-foot"><ShieldCheck size={14}/> حساب مستقل کاوه؛ بدون نیاز به حساب تلگرام</p>
    </section>
    <span className="auth-version">KAVEH AVENGER · WEB</span>
  </main>;
}

function GoogleGlyph() {
  return <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#4A90E2" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"/><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z"/></svg>;
}
