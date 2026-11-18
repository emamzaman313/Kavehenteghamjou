'use client';

import { Bell, Check, Compass, Home, LogOut, MessageCircle, Search, Settings, ShieldCheck, SunMoon, Users, FolderOpen, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
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

type Toast = { id: number; text: string; tone?: ToastTone };
type Tab = 'home' | 'chats' | 'files' | 'discover' | 'profile' | 'notifications' | 'settings' | 'admin';
const navItems = [
  { id: 'home', label: 'خانه', icon: Home },
  { id: 'chats', label: 'گفتگوها', icon: MessageCircle },
  { id: 'files', label: 'فایل‌های من', icon: FolderOpen },
  { id: 'discover', label: 'اکتشاف', icon: Compass },
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
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dark, setDark] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unread, setUnread] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
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

  const loadProfile = useCallback(async () => {
    if (!supabase || !session?.user.id) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (error) notify(`دریافت پروفایل ناموفق بود: ${error.message}`, 'error');
    else setProfile(data as Profile | null);
  }, [supabase, session?.user.id, notify]);

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
  if (!session) return <LoginScreen supabase={supabase} configured={configured}/>;
  if (!supabase) return null;

  return <div className={`app-frame ${dark ? 'theme-dark' : 'theme-light'}`}>
    <aside className="sidebar">
      <div className="sidebar-brand"><BrandMark/><div><strong>کاوه انتقامجو</strong><small>فضای ارتباطی مستقل</small></div></div>
      <div className="side-label">فضای شما</div>
      <nav className="side-nav">
        {navItems.map((item) => <button key={item.id} className={`nav-item ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}><item.icon size={19}/><span>{item.label}</span>{item.id === 'chats' && unread > 0 && <b className="nav-count">{unread}</b>}</button>)}
      </nav>
      <div className="side-divider"/>
      <div className="side-label">حساب و تنظیمات</div>
      <nav className="side-nav">
        <button className={`nav-item ${tab === 'notifications' ? 'active' : ''}`} onClick={() => setTab('notifications')}><Bell size={19}/><span>اعلان‌ها</span>{unread > 0 && <b className="nav-count">{unread}</b>}</button>
        <button className={`nav-item ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}><Settings size={19}/><span>تنظیمات</span></button>
      </nav>
      <div className="sidebar-bottom">
        <div className="mini-profile"><Avatar profile={profile} size="md"/><div className="mini-profile-text"><strong>{profile?.display_name || session.user.user_metadata?.full_name || 'کاربر کاوه'}</strong><small>{profile?.username ? `@${profile.username}` : session.user.email}</small></div><button className="icon-button" title="خروج" onClick={() => void supabase.auth.signOut()}><LogOut size={17}/></button></div>
        <div className="online-indicator"><i/> نشست شما فعال است</div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="topbar-title"><span className="eyebrow"><i/> فضای شخصی شما</span><h2>{navItems.find((n) => n.id === tab)?.label ?? ({ notifications: 'اعلان‌ها', settings: 'تنظیمات', admin: 'مدیریت' } as Record<string,string>)[tab]}</h2></div>
        <div className="topbar-actions"><label className="global-search"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجو در کاوه…" onKeyDown={(e) => { if (e.key === 'Enter') setTab('discover'); }}/><kbd>⌘ K</kbd></label><button className="icon-button theme-toggle" onClick={() => setDark((v) => !v)} title="تغییر تم"><SunMoon size={19}/></button><button className="icon-button notification-button" onClick={() => setTab('notifications')} title="اعلان‌ها"><Bell size={19}/>{unread > 0 && <i/>}</button><Avatar profile={profile} size="sm"/></div>
      </header>
      <div className="content-scroll">
        {tab === 'home' && <FeedView supabase={supabase} userId={session.user.id} notify={notify} onGoChats={() => setTab('chats')}/>}
        {tab === 'chats' && <ChatView supabase={supabase} userId={session.user.id} notify={notify}/>}
        {tab === 'files' && <FilesView supabase={supabase} userId={session.user.id} notify={notify}/>}
        {tab === 'discover' && <DiscoverView supabase={supabase} userId={session.user.id} initialSearch={search} notify={notify} onOpenChat={() => setTab('chats')}/>}
        {tab === 'profile' && <ProfileView supabase={supabase} userId={session.user.id} profile={profile} onSaved={loadProfile} notify={notify}/>}
        {tab === 'notifications' && <NotificationsView supabase={supabase} userId={session.user.id} notify={notify} onUnreadChange={setUnread}/>}
        {tab === 'settings' && <SettingsView supabase={supabase} userId={session.user.id} dark={dark} onTheme={setDark} notify={notify} onSignOut={() => void supabase.auth.signOut()}/>}
        {tab === 'admin' && <section className="panel-card"><div className="section-heading"><ShieldCheck/><h3>پنل مدیریت</h3></div><div className="notice notice-warn">در طرح‌وارهٔ فعلی، جدول نقش‌های مدیریتی و سیاست‌های مجازکنندهٔ عملیات مدیریت تعریف نشده است. برای جلوگیری از ارتقای جعلی دسترسی، ابزار مدیریتی در این نسخه فعال نمی‌شود.</div></section>}
      </div>
      <nav className="mobile-nav">{navItems.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><item.icon size={19}/><span>{item.label}</span></button>)}</nav>
    </main>
    <div className="toast-stack" aria-live="polite">{toasts.map((item) => <div key={item.id} className={`toast ${item.tone === 'error' ? 'toast-error' : ''}`}><span>{item.tone === 'error' ? <X size={16}/> : <Check size={16}/>}</span>{item.text}</div>)}</div>
  </div>;
}
