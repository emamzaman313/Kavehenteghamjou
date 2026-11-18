'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('در حال تکمیل ورود امن…');

  useEffect(() => {
    let active = true;
    const finish = async () => {
      const supabase = getSupabase();
      const code = new URLSearchParams(window.location.search).get('code');
      if (!supabase || !code) {
        setMessage('کد ورود معتبر نیست. به صفحه ورود بازگردید.');
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!active) return;
      if (error) {
        setMessage(`ورود تکمیل نشد: ${error.message}`);
        return;
      }
      router.replace('/');
    };
    void finish();
    return () => { active = false; };
  }, [router]);

  return <main className="callback-screen"><div className="spinner"/><p>{message}</p><a href="/">بازگشت به کاوه</a></main>;
}
