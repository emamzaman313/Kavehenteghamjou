'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { authErrorMessage, getOAuthCallbackError } from '@/lib/auth-errors';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('در حال تکمیل ورود امن…');
  const [working, setWorking] = useState(true);

  useEffect(() => {
    let active = true;
    const finish = async () => {
      const callbackError = getOAuthCallbackError(
        window.location.search,
        window.location.hash,
      );
      if (callbackError) {
        if (active) {
          setMessage(authErrorMessage(callbackError));
          setWorking(false);
        }
        return;
      }

      const supabase = getSupabase();
      const code = new URLSearchParams(window.location.search).get('code');
      if (!supabase) {
        if (active) {
          setMessage('تنظیمات اتصال به سرویس احراز هویت کامل نیست. لطفاً دوباره از صفحه اصلی تلاش کنید.');
          setWorking(false);
        }
        return;
      }
      if (!code) {
        if (active) {
          setMessage('کد بازگشت ورود پیدا نشد یا منقضی شده است. از صفحه اصلی دوباره وارد شوید.');
          setWorking(false);
        }
        return;
      }

      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (error) {
          setMessage(authErrorMessage(error));
          setWorking(false);
          return;
        }
        router.replace('/');
      } catch (cause) {
        if (!active) return;
        setMessage(authErrorMessage(cause));
        setWorking(false);
      }
    };

    void finish();
    return () => { active = false; };
  }, [router]);

  return (
    <main className="callback-screen">
      {working && <div className="spinner" aria-hidden="true"/>}
      <p role={working ? undefined : 'alert'} aria-live="polite">{message}</p>
      {!working && <Link href="/">بازگشت به صفحه ورود و تلاش دوباره</Link>}
    </main>
  );
}
