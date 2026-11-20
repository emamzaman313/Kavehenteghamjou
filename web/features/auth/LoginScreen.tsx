'use client';

import { ArrowLeft, Eye, EyeOff, File, KeyRound, Mail, MessageCircle, ShieldCheck, Sparkles, LockKeyhole, Zap, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BrandMark } from '@/components/ui';
import { useOperationProgress } from '@/components/OperationProgress';
import { authErrorMessage } from '@/lib/auth-errors';
import { normalizeAccessCode } from '@/lib/access-code';
import { getSignupPasswordError, getSignupPasswordChecks, normalizePasswordDigits } from '@/lib/password-policy';

type LoginStep = 'email' | 'sent' | 'setup' | 'password' | 'access';

export default function LoginScreen({ supabase, configured }: { supabase: SupabaseClient | null; configured: boolean }) {
  const [step, setStep] = useState<LoginStep>('password');
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupPasswordConfirm, setShowSignupPasswordConfirm] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [authLightMode, setAuthLightMode] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  const [openSecurityTip, setOpenSecurityTip] = useState<number | null>(0);
  const [accessEnabled, setAccessEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const { runOperation } = useOperationProgress();
  const passwordChecks = getSignupPasswordChecks(password, passwordConfirm);
  const passwordRules = passwordChecks.slice(0, 5);
  const passwordReady = passwordRules.every((check) => check.ok);
  const passwordMatches = passwordChecks[5]?.ok === true;
  const passedPasswordRules = passwordRules.filter((check) => check.ok).length;
  const passwordStrength = password.length === 0 ? 0 : passedPasswordRules <= 1 ? 1 : passedPasswordRules <= 3 ? 2 : 3;
  const generatePassword = () => {
    const groups = {
      upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
      lower: 'abcdefghijkmnopqrstuvwxyz',
      digits: '23456789',
      symbols: '!@#$%^&*',
    };
    const pick = (source: string) => source[window.crypto.getRandomValues(new Uint32Array(1))[0] % source.length];
    const alphabet = Object.values(groups).join('');
    const chars = [pick(groups.upper), pick(groups.lower), pick(groups.digits), pick(groups.symbols)];
    while (chars.length < 16) chars.push(pick(alphabet));
    for (let index = chars.length - 1; index > 0; index -= 1) {
      const swapIndex = window.crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
      [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
    }
    const generated = chars.join('');
    setPassword(generated);
    setPasswordConfirm(generated);
    setShowSignupPassword(true);
    setShowSignupPasswordConfirm(true);
    setError('');
  };

  const normalizeOtp = (value: string) => value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\D/g, '');

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('kaveh.auth.theme');
    setAuthLightMode(savedTheme === 'light');
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (themeReady) window.localStorage.setItem('kaveh.auth.theme', authLightMode ? 'light' : 'dark');
  }, [authLightMode, themeReady]);

  // Keep the last email on this device so returning users land on password login.
  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem('kaveh.auth.email');
    if (rememberedEmail) setEmail((current) => current || rememberedEmail);
  }, []);

  useEffect(() => {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.includes('@')) window.localStorage.setItem('kaveh.auth.email', normalizedEmail);
  }, [email]);

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
      await runOperation('ارسال کد ثبت‌نام', async (advance) => {
        advance(18, 'بررسی قالب و آدرس ایمیل');
        advance(42, 'ارسال درخواست امن به سرویس احراز هویت');
        const { error: authError } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: { shouldCreateUser: true },
        });
        if (authError) throw authError;
        advance(88, 'درخواست ارسال کد توسط سرور پذیرفته شد');
      });
      setEmail(normalizedEmail);
      setEmailOtp('');
      setStep('sent');
      setResendIn(30);
      setNotice('کد تأیید به ایمیل ارسال شد. فقط کد آخرین ایمیل را وارد کنید.');
    } catch (cause) {
      setError(authErrorMessage(cause));
      if (Number((cause as { status?: unknown })?.status) === 429) setResendIn(30);
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
      const data = await runOperation('تأیید ایمیل', async (advance) => {
        advance(20, 'اعتبارسنجی قالب و کد واردشده');
        advance(48, 'بررسی کد یک‌بارمصرف با سرور');
        const result = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: normalizeOtp(emailOtp),
          type: 'email',
        });
        if (result.error) throw result.error;
        if (!result.data.session?.access_token || !result.data.session?.refresh_token) {
          throw new Error('کد تأیید شد اما نشست ورود دریافت نشد. یک کد تازه درخواست کنید.');
        }
        advance(79, 'کد تأیید شد؛ نشست امن ایجاد شد');
        return result.data;
      });
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
    const passwordValidationError = getSignupPasswordError(password, passwordConfirm);
    if (passwordValidationError) {
      setError(passwordValidationError);
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    let passwordSaved = false;
    try {
      await runOperation('تکمیل ثبت‌نام و ساخت رمز', async (advance) => {
        advance(14, 'بررسی نشست تأییدشدهٔ ایمیل');
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session?.access_token || !sessionData.session.user.email) {
          throw new Error('نشست تأیید ایمیل منقضی شده است. دوباره کد تأیید ایمیل را دریافت و وارد کنید.');
        }
        advance(30, 'اعتبارسنجی قدرت رمز و تطابق تکرار آن');
        advance(52, 'ثبت رمز در سرویس امن احراز هویت');
        const { data: updateData, error: updateError } = await supabase.auth.updateUser({
          password,
          data: { account_password_ready: true },
        });
        if (updateError) throw updateError;
        if (updateData.user?.user_metadata?.account_password_ready !== true) {
          throw new Error('سرور رمز را دریافت کرد، اما تأیید نهایی ثبت حساب انجام نشد. دوباره تلاش کنید.');
        }
        advance(78, 'بررسی ثبت نهایی رمز روی حساب');
        const { data: verifiedUser, error: verifyError } = await supabase.auth.getUser();
        if (verifyError) throw verifyError;
        if (verifiedUser.user?.id !== sessionData.session.user.id ||
            verifiedUser.user.user_metadata?.account_password_ready !== true) {
          throw new Error('ثبت رمز روی حساب تأیید نشد. اتصال را بررسی و دوباره تلاش کنید.');
        }
        passwordSaved = true;
        advance(94, 'رمز ثبت و از سرور تأیید شد؛ ورود به کاوه انجام می‌شود');
      });
      setNotice('رمز عبور با موفقیت در حساب شما ثبت و از سرور تأیید شد. در حال ورود به فضای کاوه…');
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
      if (passwordSaved) {
        setPassword('');
        setPasswordConfirm('');
        // Refresh from the persisted Supabase session so the app shell re-checks
        // account_password_ready instead of leaving the user on the setup form.
        window.location.assign('/');
      }
    }
  };

  const loginWithPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy || !email.trim() || !password) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await runOperation('ورود به حساب', async (advance) => {
        advance(18, 'آماده‌سازی اطلاعات ورود');
        advance(48, 'بررسی ایمیل و رمز عبور در سرور');
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (loginError) {
          const code = String((loginError as { code?: unknown }).code ?? '');
          if (code === 'invalid_credentials' || code === 'invalid_login_credentials') {
            throw new Error('ایمیل یا رمز عبور صحیح نیست. اگر رمز را تازه ساخته‌اید، صفحه را تازه‌سازی کنید؛ در غیر این صورت ثبت‌نام با کد ایمیل را برای تنظیم رمز انجام دهید.');
          }
          throw loginError;
        }
        advance(88, 'نشست معتبر حساب ایجاد شد');
      });
      // Password sign-in already established a valid session. Do not add a
      // second metadata write here: signup sets account_password_ready, and a
      // failed follow-up mutation must never turn a successful login into an error.
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
      await runOperation('ورود با کد دسترسی', async (advance) => {
        advance(16, 'بررسی ساختار و اعتبار کد');
        advance(42, 'ارسال کد برای اعتبارسنجی سروری');
        const { data, error: functionError } = await supabase.functions.invoke('access-code-login', {
          body: { action: 'login', code: accessCode },
        });
        if (functionError) {
          const status = Number((functionError as { context?: { status?: unknown } }).context?.status);
          throw new Error(status === 429
            ? 'به‌دلیل چند تلاش ناموفق، ورود با کد موقتاً محدود شده است. ۱۵ دقیقه بعد دوباره تلاش کنید.'
            : 'اتصال به سرویس ورود با کد برقرار نشد. کمی بعد دوباره تلاش کنید.');
        }
        if (data?.ok !== true || !data?.session?.access_token || !data?.session?.refresh_token) {
          const messages: Record<string, string> = {
            invalid_code: 'کد دسترسی نادرست است. دوباره بررسی کنید.',
            disabled: 'ورود با کد دسترسی فعلاً توسط مدیر غیرفعال شده است.',
            rate_limited: 'تعداد تلاش‌های ناموفق زیاد شده است. کمی بعد دوباره تلاش کنید.',
            not_configured: 'تنظیمات ورود با کد هنوز کامل نشده است.',
          };
          throw new Error(messages[String(data?.reason)] || 'ورود مهمان انجام نشد. دوباره تلاش کنید.');
        }
        advance(78, 'کد تأیید شد؛ حساب مهمان سروری آماده است');
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (sessionError) throw sessionError;
        advance(92, 'نشست مهمان روی دستگاه فعال شد');
      });
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

  return <main className={`auth-screen kaveh-auth-experience ${authLightMode ? 'auth-light-mode' : ''}`}>
    <div className="auth-ambient-grid" aria-hidden="true"/>
    <div className="auth-orbit auth-orbit-one" aria-hidden="true"><i/><i/><i/></div><div className="auth-orbit auth-orbit-two" aria-hidden="true"><i/><i/></div>
    <div className="auth-glow auth-glow-a"/><div className="auth-glow auth-glow-b"/>
    <div className="auth-topbar"><span className="auth-top-brand"><BrandMark/><span><b>KAVEH</b><small>فضای ارتباطی مستقل</small></span></span>
      <button type="button" className={"auth-theme-toggle "+(authLightMode ? "is-light" : "is-dark")} onClick={() => setAuthLightMode(value => !value)} aria-pressed={authLightMode} aria-label={authLightMode ? "تغییر به حالت شب" : "تغییر به حالت روز"}><span className="auth-theme-track"><span className="auth-theme-thumb"><Sun className="theme-sun" size={15}/><Moon className="theme-moon" size={15}/></span><span className="auth-theme-stars"><i/><i/><i/></span></span><span className="auth-theme-copy"><b>{authLightMode ? "روز روشن" : "شب آرام"}</b><small>{authLightMode ? "Light mode" : "Dark mode"}</small></span><span className="auth-theme-spark" aria-hidden="true">✦</span></button>
    </div>
    <div className="auth-stage-layout">
    <aside className="auth-showcase" aria-label="ویژگی‌های کاوه">
      <div className="auth-showcase-kicker"><span className="auth-live-dot"/> ارتباط امن، تجربه‌ای تازه</div>
      <h2>جایی برای<br/><em>ارتباط واقعی.</em></h2>
      <p>حساب خودت را بساز و وارد فضای مستقل کاوه شو؛ گفتگو، انتشار و اشتراک‌گذاری در یک تجربهٔ یکپارچه.</p>
      <div className="auth-showcase-art" aria-hidden="true"><div className="auth-art-ring ring-a"/><div className="auth-art-ring ring-b"/><div className="auth-art-core"><BrandMark/></div>
        <span className="auth-art-chip chip-chat"><MessageCircle size={15}/> گفتگو</span><span className="auth-art-chip chip-file"><File size={15}/> فضای فایل</span><span className="auth-art-chip chip-social"><Sparkles size={15}/> اجتماع</span>
      </div>
      <div className="auth-showcase-points">
        <div><span><LockKeyhole size={17}/></span><section><b>حساب شخصی</b><small>ورود با رمز انتخابی خودت</small></section></div>
        <div><span><ShieldCheck size={17}/></span><section><b>تأیید مالکیت ایمیل</b><small>کد یک‌بارمصرف فقط برای شروع</small></section></div>
        <div><span><Zap size={17}/></span><section><b>ورود سریع‌تر</b><small>دفعات بعد بدون انتظار برای کد</small></section></div>
      </div>
      <div className="auth-showcase-foot">KAVEH ENTEGHAMJOU <span>•</span> YOUR SPACE, YOUR IDENTITY</div>
    </aside>
    <section className="auth-card">
      <BrandMark />
      <div className="eyebrow"><span/> فضای ارتباطی مستقل</div>
      <h1>کاوه <em>انتقامجو</em></h1>
      <p className="auth-copy">گفتگو، انتشار و اشتراک‌گذاری فایل؛ در یک فضای شخصی و امن.</p>
      <div className="auth-features"><span><MessageCircle size={15}/> گفتگوهای زنده</span><span><File size={15}/> فضای فایل خصوصی</span><span><Sparkles size={15}/> هویت اجتماعی</span></div>
      <div className="auth-journey" aria-label="مراحل ثبت‌نام">{['ایمیل','تأیید','ساخت رمز'].map((label,index)=><div className={`auth-journey-step ${step==='setup'&&index<2||step==='sent'&&index===0?'is-done':step==='email'&&index===0||step==='sent'&&index===1||step==='setup'&&index===2?'is-active':''}`} key={label}><span>{step==='setup'&&index<2||step==='sent'&&index===0?'✓':index+1}</span><small>{label}</small></div>)}<div className="auth-journey-track"><i style={{width:step==='email'?'0%':step==='sent'?'50%':step==='setup'?'100%':'0%'}}/></div></div>
      {!configured && <div className="notice notice-error">تنظیمات اتصال Supabase در محیط وب کامل نیست. مدیر فنی باید متغیرهای عمومی Supabase را در محیط Production بررسی کند.</div>}
      {error && <div className="notice notice-error" role="alert" aria-live="polite">{error}</div>}
      {notice && <div className="notice notice-success" role="status" aria-live="polite">{notice}</div>}

      {(step === 'email' || step === 'password') && <div className="auth-mode-switch" role="tablist" aria-label="نوع ورود">
        <button type="button" role="tab" aria-selected={step === 'password'} className={step === 'password' ? 'active' : ''} onClick={() => openStep('password')}>ورود به حساب</button>
        <button type="button" role="tab" aria-selected={step === 'email'} className={step === 'email' ? 'active' : ''} onClick={() => openStep('email')}>ثبت‌نام جدید</button>
      </div>}

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

      {step === 'setup' && <form className="auth-form signup-password-form" onSubmit={(event) => void finishRegistration(event)}>
        <div className="signup-step-kicker"><span>مرحلهٔ آخر</span><span>۳ از ۳</span></div>
        <div className="signup-password-hero"><span className="signup-password-symbol"><ShieldCheck size={25}/></span><strong>حساب خودت را امن کن</strong><small>ایمیل <b dir="ltr">{email}</b> با موفقیت تأیید شد. حالا رمز دلخواهت را انتخاب کن.</small></div>
        <label className="auth-label" htmlFor="signup-password">رمز عبور دلخواه</label>
        <div className="signup-password-control"><input id="signup-password" className="auth-input" type={showSignupPassword ? 'text' : 'password'} autoComplete="new-password" dir="auto" minLength={10} placeholder="حداقل ۱۰ نویسه؛ حروف کوچک و بزرگ، عدد و نماد" value={password} onChange={(event) => setPassword(normalizePasswordDigits(event.target.value))} required disabled={busy}/><button type="button" aria-label={showSignupPassword ? 'پنهان کردن رمز' : 'نمایش رمز'} onClick={() => setShowSignupPassword((value) => !value)} disabled={busy}>{showSignupPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
        <div className="signup-password-meter" aria-label="قدرت رمز عبور"><i className={password.length >= 12 ? 'strong' : password.length >= 8 ? 'good' : password.length ? 'weak' : ''}/></div>
        <div className="signup-strength-panel"><div className="signup-strength-heading"><span>قدرت رمز عبور</span><b>{["رمزی وارد نشده","نیاز به تقویت","مناسب","قوی"][passwordStrength]}</b></div><div className="signup-strength-track"><i style={{width:(passwordStrength*33.333)+"%"}}/></div><div className="signup-checklist">{passwordChecks.map(item=><span className={item.ok?"passed":""} key={item.label}>{item.ok?<ShieldCheck size={13}/>:<span className="check-empty"/>}{item.label}</span>)}</div></div><div className="signup-password-actions"><p className="signup-password-help">حداقل ۱۰ نویسه با یک حرف کوچک و بزرگ انگلیسی، یک عدد و یک نماد. ارقام فارسی هنگام ورود خودکار به عدد انگلیسی تبدیل می‌شوند.</p><button type="button" onClick={generatePassword} disabled={busy}><Sparkles size={14}/> ساخت رمز پیشنهادی</button></div>
        <label className="auth-label" htmlFor="signup-password-confirm">تکرار رمز عبور</label>
        <div className="signup-password-control"><input id="signup-password-confirm" className="auth-input" type={showSignupPasswordConfirm ? 'text' : 'password'} autoComplete="new-password" dir="auto" minLength={10} placeholder="همان رمز را با همان ترتیب تکرار کنید" value={passwordConfirm} onChange={(event) => setPasswordConfirm(normalizePasswordDigits(event.target.value))} required disabled={busy}/><button type="button" aria-label={showSignupPasswordConfirm ? 'پنهان کردن تکرار رمز' : 'نمایش تکرار رمز'} onClick={() => setShowSignupPasswordConfirm((value) => !value)} disabled={busy}>{showSignupPasswordConfirm ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
        {passwordConfirm && password !== passwordConfirm && <p className="signup-password-mismatch">رمزها یکسان نیستند؛ دوباره بررسی کن.</p>}
        {passwordReady && passwordMatches && <p className="signup-password-match"><ShieldCheck size={14}/> رمز قوی است و هر دو کادر دقیقاً مطابقت دارند.</p>}
        <button className="google-button signup-finish-button" type="submit" disabled={busy || !passwordReady || !passwordMatches}>
          {busy ? <span className="spinner small"/> : <ShieldCheck size={18}/>}
          <span>{busy ? 'در حال ساخت حساب…' : 'تکمیل ثبت‌نام و ساخت حساب'}</span><ArrowLeft size={17}/>
        </button>
      </form>}

      {step === 'password' && <form className="auth-form" onSubmit={(event) => void loginWithPassword(event)}>
        <p className="auth-code-hint">با ایمیل و رمز عبوری که هنگام ثبت‌نام ساخته‌اید وارد شوید.</p>
        <label className="auth-label" htmlFor="login-password-email">آدرس ایمیل</label>
        <input id="login-password-email" className="auth-input" type="email" inputMode="email" autoComplete="email" dir="ltr" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy}/>
        <label className="auth-label" htmlFor="login-password">رمز عبور</label>
        <div className="signup-password-control"><input id="login-password" className="auth-input" type={showLoginPassword ? "text" : "password"} autoComplete="current-password" dir="auto" placeholder="رمز عبور حساب" value={password} onChange={(event) => setPassword(normalizePasswordDigits(event.target.value))} required disabled={busy}/><button type="button" onClick={() => setShowLoginPassword(value => !value)} aria-label="نمایش یا پنهان‌کردن رمز">{showLoginPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
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

      <div className="auth-security-accordion">{[['چرا باید ایمیلم را تأیید کنم؟','برای اطمینان از اینکه ایمیل واقعاً متعلق به شماست و کمک به بازیابی حساب.'],['آیا هر بار کد می‌گیرم؟','خیر. پس از تأیید ایمیل و ساخت رمز، دفعات بعد با ایمیل و رمز عبور وارد می‌شوید.'],['رمز من کجا نگهداری می‌شود؟','رمز از طریق سرویس احراز هویت ثبت می‌شود و نباید به‌صورت متن ساده در پایگاه داده برنامه ذخیره شود.']].map(([question,answer],index)=><div className={openSecurityTip===index?'auth-tip open':'auth-tip'} key={question}><button type="button" onClick={()=>setOpenSecurityTip(current=>current===index?null:index)} aria-expanded={openSecurityTip===index}><span>{question}</span><span>⌄</span></button>{openSecurityTip===index&&<p>{answer}</p>}</div>)}</div>
      <p className="auth-foot"><ShieldCheck size={14}/> رمز عبور فقط به‌صورت هش‌شده در سرویس احراز هویت ذخیره می‌شود.</p>
    </section>
    </div>
    <span className="auth-version">KAVEH AVENGER · WEB</span>
  </main>;
}
