'use client';

import { Activity, ArrowLeft, Bell, Command, Compass, Film, FolderOpen, Home, LifeBuoy, MessageCircle, Search, Settings, ShieldCheck, Trophy, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type Destination = 'home' | 'chats' | 'support' | 'world' | 'files' | 'discover' | 'social' | 'profile' | 'notifications' | 'settings' | 'admin';
type Item = { id: Destination; title: string; description: string; key: string; icon: typeof Home };

const destinations: Item[] = [
  { id: 'home', title: 'خانه و جریان', description: 'پست‌ها و اتفاق‌های مهم', key: 'H', icon: Home },
  { id: 'chats', title: 'گفتگوها', description: 'پیام‌ها، گروه‌ها و کانال‌ها', key: 'C', icon: MessageCircle },
  { id: 'world', title: 'جهان کاوه', description: 'مأموریت‌ها، رتبه‌ها و رویدادها', key: 'W', icon: Trophy },
  { id: 'discover', title: 'اکتشاف', description: 'پیدا کردن افراد و محتوای تازه', key: 'E', icon: Compass },
  { id: 'social', title: 'استودیو و ریلز', description: 'ویدئوها، موسیقی و عنوان روز', key: 'R', icon: Film },
  { id: 'files', title: 'خزانهٔ فایل‌ها', description: 'فایل‌های شخصی و فضای خصوصی', key: 'F', icon: FolderOpen },
  { id: 'support', title: 'مرکز پشتیبانی', description: 'درخواست‌ها و ارتباط با تیم کاوه', key: 'S', icon: LifeBuoy },
  { id: 'profile', title: 'هویت و پروفایل', description: 'نمایه و اطلاعات حساب', key: 'P', icon: Users },
  { id: 'notifications', title: 'اعلان‌ها', description: 'پیام‌های سیستمی و رویدادها', key: 'N', icon: Bell },
  { id: 'settings', title: 'تنظیمات', description: 'ظاهر، حریم خصوصی و ترجیحات', key: 'T', icon: Settings },
  { id: 'admin', title: 'فرماندهی مدیریت', description: 'کنترل‌های مدیریتی پلتفرم', key: 'A', icon: ShieldCheck },
];

export default function KavehExperienceLayer({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate: (destination: Destination) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const items = useMemo(() => destinations.filter((item) => item.id !== 'admin' || isAdmin), [isAdmin]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('fa');
    return q ? items.filter((item) => (item.title + ' ' + item.description + ' ' + item.key).toLocaleLowerCase('fa').includes(q)) : items;
  }, [items, query]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (!open) {
        const target = event.target as HTMLElement | null;
        const isTyping = Boolean(target?.closest('input,textarea,select,[contenteditable="true"]'));
        if (!isTyping && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
          const shortcut = destinations.find((item) => item.key.toLowerCase() === event.key.toLowerCase() && (item.id !== 'admin' || isAdmin));
          if (shortcut) onNavigate(shortcut.id);
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        setQuery('');
        triggerRef.current?.focus();
      }
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])');
        if (focusable?.length) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
      if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((n) => Math.min(n + 1, Math.max(0, filtered.length - 1))); }
      if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((n) => Math.max(0, n - 1)); }
      if (event.key === 'Enter') {
        const next = filtered[activeIndex];
        if (next) { onNavigate(next.id); setOpen(false); setQuery(''); }
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [activeIndex, filtered, isAdmin, onNavigate, open]);

  useEffect(() => { if (open) { setActiveIndex(0); window.requestAnimationFrame(() => inputRef.current?.focus()); } }, [open]);

  useEffect(() => {
    const root = document.documentElement;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;
    let frame = 0;
    let pointer: PointerEvent | null = null;
    let currentCard: HTMLElement | null = null;
    const paint = () => {
      frame = 0;
      if (!pointer) return;
      const x = pointer.clientX;
      const y = pointer.clientY;
      root.style.setProperty('--kaveh-pointer-x', x + 'px');
      root.style.setProperty('--kaveh-pointer-y', y + 'px');
      root.style.setProperty('--kaveh-pointer-opacity', '1');
      const element = document.elementFromPoint(x, y);
      const card = element?.closest<HTMLElement>('.post-card,.panel-card,.welcome-card,.side-info-card,.reel-card,.community-card,.profile-main-card,.settings-card,.rank-card,.badge-card') ?? null;
      if (currentCard && currentCard !== card) {
        currentCard.style.removeProperty('--kaveh-card-rx');
        currentCard.style.removeProperty('--kaveh-card-ry');
        currentCard.style.removeProperty('--kaveh-card-spot-x');
        currentCard.style.removeProperty('--kaveh-card-spot-y');
      }
      currentCard = card;
      if (card) {
        const rect = card.getBoundingClientRect();
        const px = Math.max(0, Math.min(1, (x - rect.left) / Math.max(1, rect.width)));
        const py = Math.max(0, Math.min(1, (y - rect.top) / Math.max(1, rect.height)));
        card.style.setProperty('--kaveh-card-rx', ((0.5 - py) * 2.2).toFixed(2) + 'deg');
        card.style.setProperty('--kaveh-card-ry', ((px - 0.5) * 2.2).toFixed(2) + 'deg');
        card.style.setProperty('--kaveh-card-spot-x', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--kaveh-card-spot-y', (py * 100).toFixed(1) + '%');
      }
      pointer = null;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pointer = event;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const leave = () => {
      root.style.setProperty('--kaveh-pointer-opacity', '0');
      currentCard?.style.removeProperty('--kaveh-card-rx');
      currentCard?.style.removeProperty('--kaveh-card-ry');
      currentCard = null;
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', leave);
    root.dataset.kavehPointer = 'ready';
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('blur', leave);
      if (frame) cancelAnimationFrame(frame);
      delete root.dataset.kavehPointer;
      root.style.removeProperty('--kaveh-pointer-opacity');
      currentCard?.style.removeProperty('--kaveh-card-rx');
      currentCard?.style.removeProperty('--kaveh-card-ry');
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = Math.max(1, root.scrollHeight - window.innerHeight);
      root.style.setProperty('--kaveh-scroll-progress', Math.min(100, Math.max(0, window.scrollY / max * 100)).toFixed(2) + '%');
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', scroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('resize', scroll);
      if (frame) cancelAnimationFrame(frame);
      root.style.removeProperty('--kaveh-scroll-progress');
    };
  }, []);

  return <>
    <div className="kaveh-ambient-layer" aria-hidden="true"><span className="kaveh-ambient-orb kaveh-ambient-orb-one" /><span className="kaveh-ambient-orb kaveh-ambient-orb-two" /><span className="kaveh-ambient-grid" /></div>
    <div className="kaveh-pointer-glow" aria-hidden="true" />
    <div className="kaveh-scroll-progress" aria-hidden="true" />
    <button type="button" className="kaveh-command-trigger" ref={triggerRef} onClick={() => setOpen(true)} aria-label="باز کردن فرمان‌مرکز" title="فرمان‌مرکز (Ctrl یا ⌘ + K)">
      <Command size={17} /><span>فرمان‌مرکز</span><kbd>⌘ K</kbd>
    </button>
    {open && <div className="kaveh-command-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) { setOpen(false); setQuery(''); triggerRef.current?.focus(); }
    }}>
      <section ref={dialogRef} className="kaveh-command-dialog" role="dialog" aria-modal="true" aria-label="فرمان‌مرکز کاوه">
        <header className="kaveh-command-heading">
          <div className="kaveh-command-brand"><span><Command size={18} /></span><div><strong>فرمان‌مرکز کاوه</strong><small>میانبرها و مسیرهای سریع فضای شما</small></div></div>
          <button type="button" className="kaveh-command-close" onClick={() => { setOpen(false); setQuery(''); triggerRef.current?.focus(); }} aria-label="بستن"><X size={18} /></button>
        </header>
        <label className="kaveh-command-search"><Search size={18} />
          <input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} placeholder="کجا می‌خواهی بروی؟ نام بخش را بنویس…" aria-label="جست‌وجوی فرمان‌ها" role="combobox" aria-expanded="true" aria-controls="kaveh-command-results" aria-activedescendant={filtered[activeIndex] ? "kaveh-command-item-" + filtered[activeIndex].id : undefined} />
          <kbd>ESC</kbd>
        </label>
        <div className="kaveh-command-section-label"><span>دسترسی سریع</span><small>{filtered.length} مسیر</small></div>
        <div id="kaveh-command-results" className="kaveh-command-results" role="listbox" aria-label="بخش‌های کاوه">
          {filtered.map((item, index) => <button type="button" role="option" aria-selected={activeIndex === index} id={"kaveh-command-item-" + item.id} key={item.id} className={'kaveh-command-item' + (activeIndex === index ? ' is-active' : '')}
            onMouseEnter={() => setActiveIndex(index)} onClick={() => { onNavigate(item.id); setOpen(false); setQuery(''); }}>
            <span className="kaveh-command-item-icon"><item.icon size={18} /></span>
            <span className="kaveh-command-item-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
            <kbd>{item.key}</kbd><ArrowLeft className="kaveh-command-arrow" size={15} />
          </button>)}
          {filtered.length === 0 && <div className="kaveh-command-empty"><Activity size={22} /><strong>چیزی پیدا نشد</strong><span>عبارت دیگری جست‌وجو کن.</span></div>}
        </div>
        <footer className="kaveh-command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> حرکت</span><span><kbd>Enter</kbd> انتخاب</span><span><kbd>Esc</kbd> بستن</span><span className="kaveh-command-footer-brand">KAVEH · PRIVATE SOCIAL UNIVERSE</span></footer>
      </section>
    </div>}
  </>;
}
