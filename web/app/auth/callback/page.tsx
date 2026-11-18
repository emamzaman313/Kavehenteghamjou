'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { getGoogleAuthErrorMessage } from '@/features/auth/auth-error-message';

type CallbackResult = { ok: true } | { ok: false; message: string };

async function completeOAuthCallback(): Promise<CallbackResult> {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const callbackError = params.get('error');
  const callbackDescription = params.get('error_description');

  if (callbackError || callbackDescription) {
    return {
      ok: false,
      message: getGoogleAuthErrorMessage(callbackDescription, callbackError),
    };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      ok: false,
      message: 'تنظیمات اتصال به سرویس احراز هویت کامل نیست. لطفاً بعداً دوباره تلاش کنید.',
    };
  }

  try {
    // A callback may be refreshed after the code has already been exchanged.
    const { data: existingSession, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      return { ok: false, message: getGoogleAuthErrorMessage(sessionError.message, sessionError.code) };
    }
    if (existingSession.session) return { ok: true };

    const code = params.get('code');
    if (!code) {
      return {
        ok: false,
        message: 'کد بازگشت از Google پیدا نشد یا منقضی شده است. از صفحه ورود دوباره شروع کنید.',
      };
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return { ok: false, message: getGoogleAuthErrorMessage(error.message, error.code) };
    }
    if (!data.session) {
      return {
        ok: false,
        message: 'ورود تأیید شد، اما نشست کاربری ایجاد نشد. لطفاً دوباره تلاش کنید.',
      };
    }

    // Remove the single-use authorization code from the visible address bar.
    window.history.replaceState({}, document.title, url.pathname);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: getGoogleAuthErrorMessage(error instanceof Error ? error.message : null),
    };
  }
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const completionRef = useRef<Promise<CallbackResult> | null>(null);
  const [message, setMessage] = useState('در حال تکمیل ورود امن…');

  useEffect(() => {
    let active = true;
    completionRef.current ??= completeOAuthCallback();

    void completionRef.current.then((result) => {
      if (!active) return;
      if (result.ok) {
        router.replace('/');
      } else {
        setMessage(result.message);
      }
    });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="callback-screen">
      <div className="spinner"/>
      <p role="status" aria-live="polite">{message}</p>
      <Link href="/">بازگشت به صفحه ورود و تلاش مجدد</Link>
    </main>
  );
}
