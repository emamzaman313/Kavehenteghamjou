'use client';

import {
  Activity, ArrowLeft, Command, Compass, Eye, Film, FolderOpen, Home,
  MessageCircle, Moon, Palette, Search, ShieldCheck, Sparkles, Users, X, Zap,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type Destination =
  | 'home' | 'chats' | 'support' | 'world' | 'files' | 'discover'
  | 'social' | 'profile' | 'notifications' | 'settings' | 'admin';

type Route = { id: Destination; title: string; description: string; shortcut: string; icon: LucideIcon };

const routes: Route[] = [
  { id: 'home', title: 'خانه و جریان', description: 'پست‌ها و تازه‌ترین اتفاق‌ها', shortcut: 'H', icon: Home },
  { id: 'chats', title: 'گفتگوها', description: 'پیام‌ها، گروه‌ها و فضاهای گفتگو', shortcut: 'C', icon: MessageCircle },
  { id: 'world', title: 'جهان کاوه', description: 'مأموریت‌ها، رتبه‌ها و رویدادها', shortcut: 'W', icon: Activity },
  { id: 'discover', title: 'اکتشاف', description: 'افراد و محتوای تازه را پیدا کن', shortcut: 'E', icon: Compass },
  { id: 'social', title: 'استودیو و ریلز', description: 'ویدئوها، موسیقی و عنوان روز', shortcut: 'R', icon: Film },
  { id: 'files', title: 'خزانهٔ فایل‌ها', description: 'فایل‌های شخصی و فضای خصوصی', shortcut: 'F', icon: FolderOpen },
  { id: 'support', title: 'مرکز پشتیبانی', description: 'درخواست‌ها و ارتباط با تیم کاوه', shortcut: 'S', icon: Users },
  { id: 'profile', title: 'هویت و پروفایل', description: 'نمایه، نشان‌ها و مشخصات حساب', shortcut: 'P', icon: Users },
  { id: 'notifications', title: 'اعلان‌ها', description: 'رویدادها و پیام‌های سیستمی', shortcut: 'N', icon: Zap },
  { id: 'settings', title: 'تنظیمات', description: 'ظاهر، حریم خصوصی و ترجیحات', shortcut: 'T', icon: Palette },
  { id: 'admin', title: 'فرماندهی مدیریت', description: 'کنترل‌های مدیریتی پلتفرم', shortcut: 'A', icon: ShieldCheck },
];

const palettes = [
  { name: 'یخی', value: '#168bff' },
  { name: 'فیروزه‌ای', value: '#16b8a6' },
  { name: 'بنفش', value: '#9877f5' },
  { name: 'کهربایی', value: '#d59a42' },
  { name: 'رز', value: '#d66c91' },
] as const;

type Preferences = { accent: string; focus: boolean; motion: boolean };

export default function KavehCommandDock({
  activeTab,
  isAdmin,
  unread,
  onNavigate,
}: {
  activeTab: Destination;
  isAdmin: boolean;
  unread: number;
  onNavigate: (destination: Destination) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [prefs, setPrefs] = useState<Preferences>({ accent: palettes[0].value, focus: false, motion: true });
  const [ready, setReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousMagnet = useRef<HTMLElement | null>(null);
  const visibleRoutes = useMemo(() => routes.filter((route) => route.id !== 'admin' || isAdmin), [isAdmin]);
  const filteredRoutes = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fa');
    return term
      ? visibleRoutes.filter((route) => [route.title, route.description, route.shortcut].join(' ').toLocaleLowerCase('fa').includes(term))
      : visibleRoutes;
  }, [query, visibleRoutes]);
  const currentRoute = routes.find((route) => route.id === activeTab);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('kaveh-command-dock-v1');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Preferences>;
        setPrefs((current) => ({
          accent: palettes.some((item) => item.value === parsed.accent) ? parsed.accent! : current.accent,
          focus: typeof parsed.focus === 'boolean' ? parsed.focus : current.focus,
          motion: typeof parsed.motion === 'boolean' ? parsed.motion : current.motion,
        }));
      }
    } catch {
      // Keep safe defaults when browser storage is unavailable.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.style.setProperty('--kaveh-user-accent', prefs.accent);
    root.dataset.kavehCommandFocus = prefs.focus ? 'on' : 'off';
    root.dataset.kavehCommandMotion = prefs.motion ? 'on' : 'off';
    try {
      window.localStorage.setItem('kaveh-command-dock-v1', JSON.stringify(prefs));
    } catch {
      // Preferences still apply for the current session.
    }
  }, [prefs, ready]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target?.closest('input,textarea,select,[contenteditable="true"]'));
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'Space') {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (!open) {
        if (event.key === 'Escape') setPrefs((current) => current.focus ? { ...current, focus: false } : current);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        setQuery('');
        return;
      }
      if (typing && !['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, Math.max(filteredRoutes.length - 1, 0)));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === 'Enter') {
        const route = filteredRoutes[activeIndex];
        if (route) {
          onNavigate(route.id);
          setOpen(false);
          setQuery('');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, filteredRoutes, onNavigate, open]);

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reducedMotion) return;
    const clear = () => {
      previousMagnet.current?.style.removeProperty('--kaveh-magnet-x');
      previousMagnet.current?.style.removeProperty('--kaveh-magnet-y');
      previousMagnet.current = null;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        '.nav-item,.button,.icon-button,.mobile-nav button,.kaveh-command-trigger,.kaveh-command-route',
      ) ?? null;
      if (previousMagnet.current && previousMagnet.current !== target) clear();
      previousMagnet.current = target;
      if (!target || target.matches(':disabled')) return;
      const rect = target.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) / Math.max(rect.width / 2, 1);
      const y = (event.clientY - rect.top - rect.height / 2) / Math.max(rect.height / 2, 1);
      target.style.setProperty('--kaveh-magnet-x', (x * 2.6).toFixed(2) + 'px');
      target.style.setProperty('--kaveh-magnet-y', (y * 2.6).toFixed(2) + 'px');
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('blur', clear);
      clear();
    };
  }, []);

  const navigate = (destination: Destination) => {
    onNavigate(destination);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        type="button"
        className={'kaveh-command-trigger' + (open ? ' is-open' : '')}
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'بستن مرکز فرمان' : 'باز کردن مرکز فرمان'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="مرکز فرمان · Ctrl + Shift + Space"
      >
        {open ? <X size={19} /> : <Command size={19} />}
        <span className="kaveh-command-trigger-pulse" />
      </button>

      {open && (
        <>
          <button className="kaveh-command-backdrop" type="button" aria-label="بستن مرکز فرمان" onClick={() => setOpen(false)} />
          <section className="kaveh-command-panel" role="dialog" aria-modal="true" aria-labelledby="kaveh-command-title" dir="rtl">
            <header className="kaveh-command-heading">
              <div className="kaveh-command-brand">
                <span className="kaveh-command-brand-icon"><Sparkles size={18} /></span>
                <span><strong id="kaveh-command-title">مرکز فرمان کاوه</strong><small>فضای شخصی، میان‌برهای هوشمند</small></span>
              </div>
              <button type="button" className="kaveh-command-close" onClick={() => setOpen(false)} aria-label="بستن"><X size={17} /></button>
            </header>

            <div className="kaveh-command-current">
              <span className="kaveh-command-current-mark"><Activity size={15} /></span>
              <span><small>در حال مشاهده</small><strong>{currentRoute?.title ?? 'فضای کاوه'}</strong></span>
              {unread > 0 && <button type="button" onClick={() => navigate('notifications')}><b>{unread > 99 ? '۹۹+' : unread}</b> اعلان خوانده‌نشده <ArrowLeft size={13} /></button>}
            </div>

            <label className="kaveh-command-search">
              <Search size={17} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
                placeholder="بخش موردنظرت را پیدا کن…"
                aria-label="جست‌وجوی بخش‌ها"
                autoComplete="off"
              />
              <kbd>ESC</kbd>
            </label>

            <div className="kaveh-command-section-label"><span>دسترسی سریع</span><small>{filteredRoutes.length} بخش</small></div>
            <div className="kaveh-command-routes" role="listbox" aria-label="بخش‌های برنامه">
              {filteredRoutes.map((route, index) => {
                const Icon = route.icon;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    key={route.id}
                    className={'kaveh-command-route' + (route.id === activeTab ? ' is-current' : '') + (index === activeIndex ? ' is-highlighted' : '')}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => navigate(route.id)}
                  >
                    <span className="kaveh-command-route-icon"><Icon size={17} /></span>
                    <span className="kaveh-command-route-copy"><strong>{route.title}</strong><small>{route.description}</small></span>
                    <kbd>{route.shortcut}</kbd>
                    {route.id === activeTab && <i aria-label="بخش فعلی" />}
                  </button>
                );
              })}
              {!filteredRoutes.length && <p className="kaveh-command-empty">بخشی با این عبارت پیدا نشد.</p>}
            </div>

            <footer className="kaveh-command-settings">
              <div className="kaveh-command-settings-title"><Palette size={15} /><strong>شخصی‌سازی فضای کاوه</strong></div>
              <div className="kaveh-command-palettes" aria-label="انتخاب رنگ تأکیدی">
                {palettes.map((palette) => (
                  <button
                    type="button"
                    key={palette.value}
                    aria-label={'رنگ ' + palette.name}
                    aria-pressed={prefs.accent === palette.value}
                    className={'kaveh-command-swatch' + (prefs.accent === palette.value ? ' is-selected' : '')}
                    style={{ '--swatch': palette.value } as CSSProperties}
                    onClick={() => setPrefs((current) => ({ ...current, accent: palette.value }))}
                  />
                ))}
              </div>
              <div className="kaveh-command-toggles">
                <button type="button" aria-pressed={prefs.focus} onClick={() => setPrefs((current) => ({ ...current, focus: !current.focus }))}>
                  <Eye size={15} /><span>حالت تمرکز</span><i className={prefs.focus ? 'is-on' : ''} />
                </button>
                <button type="button" aria-pressed={!prefs.motion} onClick={() => setPrefs((current) => ({ ...current, motion: !current.motion }))}>
                  <Moon size={15} /><span>حرکت کمتر</span><i className={!prefs.motion ? 'is-on' : ''} />
                </button>
              </div>
            </footer>
            <div className="kaveh-command-footnote"><span><Zap size={12} /> میان‌بر بازکردن</span><kbd>Ctrl</kbd><b>+</b><kbd>Shift</kbd><b>+</b><kbd>Space</kbd></div>
          </section>
        </>
      )}
    </>
  );
}
