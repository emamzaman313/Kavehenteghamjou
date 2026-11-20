'use client';
import { Check, LogOut, Palette, ShieldCheck, SunMoon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Notify } from '@/lib/ui-types';
import { SectionHeader } from '@/components/ui';

export default function SettingsView({ supabase, userId, dark, onTheme, notify, onSignOut }: { supabase: SupabaseClient; userId: string; dark: boolean; onTheme: (v: boolean) => void; notify: Notify; onSignOut: () => void }) {
  const [locale, setLocale] = useState('fa'); const [saving, setSaving] = useState(false);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [accentPalette, setAccentPalette] = useState<'ice' | 'teal' | 'violet' | 'amber' | 'rose'>('ice');
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const palettes = [
    { id: 'ice', title: 'یخی', color: '#168bff' },
    { id: 'teal', title: 'فیروزه‌ای', color: '#16b8a5' },
    { id: 'violet', title: 'بنفش', color: '#9471ed' },
    { id: 'amber', title: 'کهربایی', color: '#d99b3d' },
    { id: 'rose', title: 'رز', color: '#e87991' },
  ] as const;
  useEffect(() => {
    try {
      const savedDensity = localStorage.getItem('kaveh-density');
      const savedMotion = localStorage.getItem('kaveh-reduced-motion');
      const savedAccent = localStorage.getItem('kaveh-accent-palette');
      if (savedDensity === 'compact' || savedDensity === 'comfortable') setDensity(savedDensity);
      setReducedMotion(savedMotion === 'true');
      if (['ice','teal','violet','amber','rose'].includes(savedAccent ?? '')) setAccentPalette(savedAccent as typeof accentPalette);
    } catch { /* Keep safe defaults when browser storage is unavailable. */ } finally { setPreferencesLoaded(true); }
  }, []);
  useEffect(() => {
    if (!preferencesLoaded) return;
    document.documentElement.dataset.kavehDensity = density;
    document.documentElement.dataset.kavehMotion = reducedMotion ? 'reduced' : 'full';
    document.documentElement.dataset.kavehAccent = accentPalette;
    localStorage.setItem('kaveh-density', density);
    localStorage.setItem('kaveh-reduced-motion', String(reducedMotion));
    localStorage.setItem('kaveh-accent-palette', accentPalette);
  }, [density, reducedMotion, accentPalette, preferencesLoaded]);
  useEffect(() => { void supabase.from('user_settings').select('theme_preference,locale').eq('user_id', userId).maybeSingle().then(({ data }) => { if (data?.theme_preference) onTheme(data.theme_preference === 'dark'); if (data?.locale) setLocale(data.locale); }); }, [supabase, userId, onTheme]);
  const save = async () => { setSaving(true); const { error } = await supabase.from('user_settings').upsert({ user_id: userId, theme_preference: dark ? 'dark' : 'light', locale, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }); setSaving(false); if (error) notify(error.message, 'error'); else notify('تنظیمات ذخیره شد.'); };
  return <div className="page-stack"><SectionHeader eyebrow="شخصی‌سازی" title="تنظیمات" description="ظاهر، آسایش دیداری و ترجیحات حساب خودت را تنظیم کن."/>
    <div className="settings-grid">
      <section className="settings-card settings-appearance-lab">
        <div className="side-info-title"><Palette size={18}/><strong>آزمایشگاه ظاهر</strong></div>
        <p>رنگ تأکیدی، تراکم چیدمان و حرکت‌های رابط را مطابق سلیقه‌ات تنظیم کن. این ترجیحات روی همین مرورگر ذخیره می‌شوند.</p>
        <div className="settings-accent-picker" role="group" aria-label="رنگ تأکیدی">
          {palettes.map((palette) => <button key={palette.id} type="button" aria-label={palette.title} aria-pressed={accentPalette === palette.id} className={accentPalette === palette.id ? 'active' : ''} onClick={() => setAccentPalette(palette.id)}><i style={{ background: palette.color }}/><span>{palette.title}</span>{accentPalette === palette.id && <Check size={13}/>}</button>)}
        </div>
        <div className="settings-choice-block"><div><strong>تراکم رابط</strong><small>فاصله و اندازه کارت‌ها و فهرست‌ها</small></div><div className="settings-segmented"><button type="button" className={density === 'comfortable' ? 'active' : ''} aria-pressed={density === 'comfortable'} onClick={() => setDensity('comfortable')}>راحت</button><button type="button" className={density === 'compact' ? 'active' : ''} aria-pressed={density === 'compact'} onClick={() => setDensity('compact')}>فشرده</button></div></div>
        <div className="settings-choice-block"><div><strong>حرکت‌های رابط</strong><small>کاهش انیمیشن برای تمرکز و آسایش دیداری</small></div><button type="button" role="switch" aria-checked={reducedMotion} className={'switch '+(reducedMotion?'on':'')} onClick={() => setReducedMotion(value => !value)} aria-label="کاهش حرکت‌های رابط"><i/></button></div>
        <div className="settings-mini-preview" data-density={density}><div className="settings-mini-preview-top"><i style={{ background: palettes.find(p => p.id === accentPalette)?.color }}/> <b>پیش‌نمایش محیط کاوه</b><small>{density === 'compact' ? 'فشرده' : 'راحت'}</small></div><div className="settings-mini-preview-card"><span style={{ background: palettes.find(p => p.id === accentPalette)?.color }}/> <div><b>جریان جامعه</b><small>رابط با تنظیمات انتخاب‌شده</small></div></div></div>
      </section>
      <section className="settings-card"><div className="side-info-title"><SunMoon size={18}/><strong>نمایش و زبان</strong></div><p>تم برنامه در وب و ترجیح ذخیره‌شدهٔ حساب.</p><div className="setting-choice"><span>{dark ? 'حالت تیره' : 'حالت روشن'}</span><button className={'switch '+(dark?'on':'')} onClick={() => onTheme(!dark)} aria-label="تغییر حالت نمایش"><i/></button></div><div className="setting-choice"><span>زبان رابط</span><select value={locale} onChange={(e) => setLocale(e.target.value)}><option value="fa">فارسی</option><option value="en" disabled>English (به‌زودی)</option></select></div><button className="button button-primary" onClick={() => void save()} disabled={saving}>{saving ? 'ذخیره…' : 'ذخیره تنظیمات حساب'}</button></section>
      <section className="settings-card"><div className="side-info-title"><ShieldCheck size={18}/><strong>امنیت و نشست</strong></div><p>ورود با ایمیل یا کد دسترسی مدیریت می‌شود. کلیدهای خصوصی سرور در مرورگر نگهداری نمی‌شوند.</p><div className="setting-choice"><span>احراز هویت</span><b className="status-tag">فعال</b></div><div className="setting-choice"><span>دسترسی فایل</span><b className="status-tag">خصوصی</b></div><button className="button button-danger" onClick={onSignOut}><LogOut size={16}/> خروج از حساب</button></section>
    </div>
  </div>;
}
