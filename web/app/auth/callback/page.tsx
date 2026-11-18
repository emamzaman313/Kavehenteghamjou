'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { authErrorMessage, getOAuthCallbackError } from '@/lib/auth-errors';

type CallbackResult = { ok: true } | { ok: false; message: string };

async function finishOAuthCallback(): Promise<CallbackResult> {
  const url = new URL(window.location.href);
  const callbackError = getOAuthCallbackError(url.search, url.hash);
  if (callbackError) {
    return { ok: false, message: authErrorMessage(callbackError) };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      ok: false,
      message: 'تنظیمات اتصال به سرویس احراز هویت کامل نیست. لطفاً دوباره از صفحه اصلی تلاش کنید.',
    };
  }

  try {
    // On a refresh after a successful callback, keep the already-persisted session.
    const { data: existingSession, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      return { ok: false, message: authErrorMessage(sessionError) };
    }
    if (existingSession.session) {
      window.history.replaceState({}, document.title, url.pathname);
      return { ok: true };
    }

    const code = url.searchParams.get('code');
    if (!code) {
      return {
        ok: false,
        message: 'کد بازگشت ورود پیدا نشد یا منقضی شده است. از صفحه اصلی دوباره وارد شوید.',
      };
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return { ok: false, message: authErrorMessage(error) };
    }
    if (!data.session) {
      return {
        ok: false,
        message: 'ورود تأیید شد، اما نشست کاربری ایجاد نشد. لطفاً دوباره تلاش کنید.',
      };
    }

    // OAuth authorization codes are one-time credentials. Remove them after exchange.
    window.history.replaceState({}, document.title, url.pathname);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: authErrorMessage(error) };
  }
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const completionRef = useRef<Promise<CallbackResult> | null>(null);
  const [message, setMessage] = useState('در حال تکمیل ورود امن…');
  const [working, setWorking] = useState(true);

  useEffect(() => {
    let active = true;
    // Keep one exchange promise across React Strict Mode's effect cleanup/replay.
    completionRef.current ??= finishOAuthCallback();

    void completionRef.current.then((result) => {
      if (!active) return;
      if (result.ok) {
        router.replace('/');
      } else {
        setMessage(result.message);
        setWorking(false);
      }
    });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="callback-screen">
      {working && <div className="spinner" aria-hidden="true"/>}
      <p role={working ? 'status' : 'alert'} aria-live="polite">{message}</p>
      {!working && <Link href="/">بازگشت به صفحه ورود و تلاش دوباره</Link>}
    </main>
  );
}
