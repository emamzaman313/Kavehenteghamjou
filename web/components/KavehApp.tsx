'use client';

import { Bell, Check, Compass, Home, LogOut, MessageCircle, Search, Settings, ShieldCheck, SunMoon, Users, FolderOpen, X, Film, LifeBuoy, Trophy } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { authErrorMessage, getOAuthCallbackError } from '@/lib/auth-errors';
import type { ToastTone } from '@/lib/ui-types';
import type { Profile } from '@/lib/types';
import { Avatar, BrandMark } from '@/components/ui';
import LoginScreen from '@/features/auth/LoginScreen';
import FeedView from '@/features/feed/FeedView';
import ChatView from '@/features/chat/ChatView';
import FilesView from '@/features/files/FilesView';
import DiscoverView from '@/features/discover/DiscoverView';
import ProfileView from '@/features/profile/ProfileView';
import NotificationsView from '@/features/notifications/NotificationsView';
import SettingsView from '@/features/settings/SettingsView';
import SocialHubView from '@/features/social/SocialHubView';
import AdminAccessCodePanel from '@/features/admin/AdminAccessCodePanel';
import GlobalAudioPlayer from '@/components/GlobalAudioPlayer';
import SupportCenter from '@/features/support/SupportCenter';
import KavehWorldView from '@/features/world/KavehWorldView';

type Toast = { id: number; text: string; tone?: ToastTone };
type Tab = 'home' | 'chats' | 'files' | 'discover' | 'social' | 'profile' | 'notifications' | 'settings' | 'support' | 'world' | 'admin';
const navItems = [
  { id: 'home', label: 'خانه', icon: Home },
  { id: 'chats', label: 'گفتگوها', icon: MessageCircle },
  { id: 'support', label: 'پشتیبانی', icon: LifeBuoy },
  { id: 'world', label: 'جهان کاوه', icon: Trophy },
  { id: 'files', label: 'فایل‌های من', icon: FolderOpen },
  { id: 'discover', label: 'اکتشاف', icon: Compass },
  { id: 'social', label: 'ریلز و موسیقی', icon: Film },
  { id: 'profile', label: 'پروفایل', icon: Users },
] as const;

function toastMessage(setToasts: (fn: (items: Toast[]) => Toast[]) => void, text: string, tone: ToastTone = 'success') {
  const id = Date.now() + Math.random();
  setToasts((items) => [...items.slice(-2), { id, text, tone }]);
  window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4200);
}

export default function KavehApp() {
  const supabase = useMemo(() => getSupabase(), []);
  const configured = Boolean(supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [tab, setTab] = useState<Tab>('home');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dark, setDark] = useState(true);
  const [appearance, setAppearance] = useState({ accent: '#168bff', background: '#07111f', surface: '#101b2c', radius: 16 });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unread, setUnread] = useState(0);
  const [search, setSearch] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [featureFlags, setFeatureFlags] = useState<Record<string,boolean>>({});
  const isSupportStaff = ['owner', 'admin', 'support'].includes(adminRole ?? '');

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) { setSession(data.session); setAuthReady(true); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [supabase]);

  const notify = useCallback((text: string, tone: Toast['tone'] = 'success') => toastMessage(setToasts, text, tone), []);

  useEffect(() => {
    if (!supabase || !session?.user.id) {
      setIsAdmin(false);
      setAdminRole(null);
      return;
    }
    let active = true;
    void supabase.functions.invoke('access-code-login', { body: { action: 'admin_get' } })
      .then(({ data, error }) => {
        if (active) {
          const role = !error && data?.ok === true && data?.isAdmin === true ? String(data.role ?? '') : '';
          setAdminRole(role || null);
          setIsAdmin(['owner', 'admin', 'moderator'].includes(role));
        }
      })
      .catch(() => { if (active) setIsAdmin(false); });
    return () => { active = false; };
  }, [supabase, session?.user.id]);

  useEffect(() => {
    const callbackError = getOAuthCallbackError(window.location.search, window.location.hash);
    if (callbackError) notify(authErrorMessage(callbackError), 'error');
  }, [notify]);


  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const loadAppearance = async () => {
      const { data } = await supabase.from('platform_appearance_versions')
        .select('config').eq('is_published', true).maybeSingle();
      const value = data?.config && typeof data.config === 'object'
        ? (data.config as { appearance?: { accent?: string; background?: string; surface?: string; radius?: number } }).appearance
        : undefined;
      if (active && value) setAppearance({
        accent: value.accent ?? '#168bff',
        background: value.background ?? '#07111f',
        surface: value.surface ?? '#101b2c',
        radius: value.radius ?? 16,
      });
    };
    const refreshOnFocus = () => { if (document.visibilityState === 'visible') void loadAppearance(); };
    void loadAppearance();
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    const interval = window.setInterval(() => { void loadAppearance(); }, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [supabase]);

  useEffect(() => {
    if(!supabase) return;
    let active=true;
    const loadFlags=async()=>{
      const {data,error}=await supabase.from('platform_feature_flags').select('key,enabled');
      if(!error&&active){const next:Record<string,boolean>={};(data??[]).forEach(row=>{next[row.key]=row.enabled;});setFeatureFlags(next);}
    };
    void loadFlags();
    const channel=supabase.channel('platform-feature-flags')
      .on('postgres_changes',{event:'*',schema:'public',table:'platform_feature_flags'},()=>{void loadFlags();})
      .subscribe();
    return ()=>{active=false;void supabase.removeChannel(channel);};
  },[supabase]);

  const loadProfile = useCallback(async () => {
    if (!supabase || !session?.user.id) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (error) notify(`دریافت پروفایل ناموفق بود: ${error.message}`, 'error');
    else setProfile(data as Profile | null);
  }, [supabase, session, notify]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (!supabase || !session?.user.id) return;
    let alive = true;
    const loadCount = async () => {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', session.user.id).is('read_at', null);
      if (alive) setUnread(count ?? 0);
    };
    void loadCount();
    const channel = supabase.channel(`inbox:${session.user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${session.user.id}` }, () => { void loadCount(); }).subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [supabase, session?.user.id]);

  if (!authReady) return <div className="boot-screen"><BrandMark/><span className="spinner"/><p>کاوه در حال آماده‌سازی است…</p></div>;
  const needsEmailPasswordSetup = Boolean(
    session?.user.email &&
    session.user.app_metadata?.provider === 'email' &&
    session.user.user_metadata?.access_method !== 'shared_code' &&
    session.user.user_metadata?.account_password_ready !== true
  );
  if (!session || needsEmailPasswordSetup) return <LoginScreen supabase={supabase} configured={configured}/>;
  if (!supabase) return null;

  const featureEnabled=(key:string)=>isAdmin || featureFlags[key] !== false;
  const visibleNavItems=navItems.filter(item=>{
    if(item.id==='home') return featureEnabled('posts');
    if(item.id==='chats') return featureEnabled('chat');
    if(item.id==='support') return featureEnabled('support');
    if(item.id==='files') return featureEnabled('uploads');
    if(item.id==='discover') return featureEnabled('social_discovery');
    if(item.id==='social') return featureEnabled('reels');
    return true;
  });
  useEffect(()=>{
    const required:Record<string,string>={home:'posts',chats:'chat',support:'support',files:'uploads',discover:'social_discovery',social:'reels'};
    const key=required[tab];
    if(key && featureFlags[key]===false && !isAdmin) setTab('profile');
  },[tab,featureFlags,isAdmin]);

  return <div className={`app-frame kaveh-premium-shell ${dark ? 'theme-dark' : 'theme-light'}`} style={{ '--remote-accent': appearance.accent, '--remote-background': appearance.background, '--remote-surface': appearance.surface, '--remote-radius': `${appearance.radius}px` } as CSSProperties}>
    <aside className="sidebar">
      <div className="sidebar-brand"><BrandMark/><div><strong>کاوه انتقامجو</strong><small>THE PRIVATE SOCIAL UNIVERSE</small></div></div>
      <div className="side-label"><span>01</span> فضای شما</div>
      <nav className="side-nav">
        {visibleNavItems.map((item) => <button key={item.id} className={`nav-item ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}><item.icon size={19}/><span>{item.label}</span>{item.id === 'chats' && unread > 0 && <b className="nav-count">{unread}</b>}</button>)}
      </nav>
      <div className="side-divider"/>
      <div className="side-label"><span>02</span> حساب و تنظیمات</div>
      <nav className="side-nav">
        <button className={`nav-item ${tab === 'notifications' ? 'active' : ''}`} onClick={() => setTab('notifications')}><Bell size={19}/><span>اعلان‌ها</span>{unread > 0 && <b className="nav-count">{unread}</b>}</button>
        <button className={`nav-item ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}><Settings size={19}/><span>تنظیمات</span></button>
        {isAdmin && <button className={`nav-item ${tab === 'admin' ? 'active' : ''}`} onClick={() => setTab('admin')}><ShieldCheck size={19}/><span>مدیریت سایت</span></button>}
      </nav>
      <div className="sidebar-bottom">
        <div className="mini-profile"><Avatar profile={profile} size="md"/><div className="mini-profile-text"><strong>{profile?.display_name || session.user.user_metadata?.full_name || 'کاربر کاوه'}</strong><small>{profile?.username ? `@${profile.username}` : session.user.email}</small></div><button className="icon-button" title="خروج" onClick={() => void supabase.auth.signOut()}><LogOut size={17}/></button></div>
        <div className="online-indicator"><i/> <span>اتصال امن برقرار است</span><small>LIVE</small></div>
      </div>
    </aside>

    <GlobalAudioPlayer supabase={supabase}/>
    <main className="main-area">
      <header className="topbar">
        <div className="topbar-title"><span className="eyebrow"><i/> KAVEH AVENGER <b>·</b> فضای اختصاصی</span><h2>{navItems.find((n) => n.id === tab)?.label ?? ({ notifications: 'اعلان‌ها', settings: 'تنظیمات', social: 'ریلز و موسیقی', support: isSupportStaff ? 'صندوق پشتیبانی' : 'پشتیبانی و ارتباط با مدیریت', admin: 'مدیریت' } as Record<string,string>)[tab]}</h2></div>
        <div className="topbar-actions"><label className="global-search"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجو در کاوه…" onKeyDown={(e) => { if (e.key === 'Enter') setTab('discover'); }}/><kbd>⌘ K</kbd></label><button className="icon-button theme-toggle" onClick={() => setDark((v) => !v)} title="تغییر تم"><SunMoon size={19}/></button><button className="icon-button notification-button" onClick={() => setTab('notifications')} title="اعلان‌ها"><Bell size={19}/>{unread > 0 && <i/>}</button><button className="icon-button mobile-signout" onClick={() => void supabase.auth.signOut()} title="خروج از حساب" aria-label="خروج از حساب"><LogOut size={18}/></button><Avatar profile={profile} size="sm"/></div>
      </header>
      <div className="content-scroll">
        {tab === 'home' && <FeedView supabase={supabase} userId={session.user.id} notify={notify} onGoChats={() => setTab('chats')}/>}
        {tab === 'chats' && <ChatView supabase={supabase} userId={session.user.id} notify={notify}/>}
        {tab === 'support' && <SupportCenter supabase={supabase} userId={session.user.id} notify={notify} staff={isSupportStaff}/>}
        {tab === 'world' && <KavehWorldView supabase={supabase} userId={session.user.id} isAdmin={isAdmin} notify={notify}/>}
        {tab === 'files' && <FilesView supabase={supabase} userId={session.user.id} notify={notify}/>}
        {tab === 'social' && <SocialHubView supabase={supabase} userId={session.user.id} isAdmin={isAdmin} notify={notify}/>}
        {tab === 'discover' && <DiscoverView supabase={supabase} userId={session.user.id} initialSearch={search} notify={notify} onOpenChat={() => setTab('chats')}/>}
        {tab === 'profile' && <ProfileView supabase={supabase} userId={session.user.id} profile={profile} accountLabel={session.user.user_metadata?.access_method === 'shared_code' ? 'حساب مهمان مستقل' : session.user.email ? 'حساب ایمیل' : 'حساب کاربری'} onSaved={loadProfile} notify={notify}/>}
        {tab === 'notifications' && <NotificationsView supabase={supabase} userId={session.user.id} notify={notify} onUnreadChange={setUnread}/>}
        {tab === 'settings' && <SettingsView supabase={supabase} userId={session.user.id} dark={dark} onTheme={setDark} notify={notify} onSignOut={() => void supabase.auth.signOut()}/>}
        {tab === 'admin' && isAdmin && <AdminAccessCodePanel supabase={supabase} notify={notify} role={adminRole === 'owner' || adminRole === 'admin' ? adminRole : 'moderator'}/>}
        {tab === 'admin' && !isAdmin && <section className="panel-card"><div className="notice notice-error">دسترسی مدیریت برای این حساب فعال نیست.</div></section>}
      </div>
      <nav className="mobile-nav">{visibleNavItems.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><item.icon size={19}/><span>{item.label}</span></button>)}{isAdmin && <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}><ShieldCheck size={19}/><span>مدیریت</span></button>}</nav>
    </main>
    <div className="toast-stack" aria-live="polite">{toasts.map((item) => <div key={item.id} className={`toast ${item.tone === 'error' ? 'toast-error' : ''}`}><span>{item.tone === 'error' ? <X size={16}/> : <Check size={16}/>}</span>{item.text}</div>)}</div>
  </div>;
}
