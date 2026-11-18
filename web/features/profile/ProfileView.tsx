'use client';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types';
import type { Notify } from '@/lib/ui-types';
import { formatDate } from '@/lib/format';
import { Avatar, SectionHeader } from '@/components/ui';

export default function ProfileView({ supabase, userId, profile, accountLabel, onSaved, notify }: { supabase: SupabaseClient; userId: string; profile: Profile | null; accountLabel: string; onSaved: () => Promise<void>; notify: Notify }) {
  const [name, setName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [rank, setRank] = useState<{ title: string; score: number; min_score: number } | null>(null);
  const [badges, setBadges] = useState<{ badge_code: string; awarded_at: string }[]>([]);
  useEffect(() => { setName(profile?.display_name ?? ''); setUsername(profile?.username ?? ''); setBio(profile?.bio ?? ''); }, [profile]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [{ data: state }, { data: levels }, { data: earned }] = await Promise.all([
        supabase.from('user_rank_state').select('score,rank_code').eq('user_id', userId).maybeSingle(),
        supabase.from('rank_levels').select('code,title,min_score,sort_order').order('sort_order'),
        supabase.from('user_badges').select('badge_code,awarded_at').eq('user_id', userId),
      ]);
      if (!alive) return;
      const score = Number(state?.score ?? 0); const current = (levels ?? []).filter((r) => Number(r.min_score) <= score).at(-1);
      const next = (levels ?? []).find((r) => Number(r.min_score) > score);
      setRank({ title: current?.title ?? 'تازه‌وارد', score, min_score: Number(next?.min_score ?? current?.min_score ?? 0) });
      setBadges(earned ?? []);
    };
    void load(); return () => { alive = false; };
  }, [supabase, userId]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    const patch = { display_name: name.trim(), username: username.trim() || null, bio: bio.trim(), updated_at: new Date().toISOString() };
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
    setSaving(false); if (error) notify(`ذخیره پروفایل انجام نشد: ${error.message}`, 'error'); else { notify('پروفایل به‌روزرسانی شد.'); await onSaved(); }
  };
  return <div className="page-stack"><SectionHeader eyebrow="هویت شما" title="پروفایل من" description="اطلاعات عمومی و هویت اجتماعی‌ات را مدیریت کن."/><div className="profile-layout"><section className="profile-main-card"><div className="profile-cover"><div className="profile-cover-glow"/></div><div className="profile-identity"><Avatar profile={profile ?? { display_name: name }} size="lg"/><div><h2>{(profile?.display_name ?? name) || 'کاربر کاوه'}</h2><span>@{(profile?.username ?? username) || 'نام‌کاربری-ثبت‌نشده'}</span></div><span className="verified-pill"><ShieldCheck size={14}/> {accountLabel}</span></div><form className="profile-form" onSubmit={save}><label>نام نمایشی<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required/></label><label>نام کاربری<input value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30))} maxLength={30} placeholder="مثلاً kaveh_user"/><small>فقط حروف انگلیسی، عدد و زیرخط</small></label><label>درباره من<textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={300}/></label><button className="button button-primary" disabled={saving}>{saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}</button></form></section><aside className="profile-side"><div className="rank-card"><span className="eyebrow">جایگاه اجتماعی</span><div className="rank-emblem"><Sparkles size={26}/></div><h3>{rank?.title ?? 'تازه‌وارد'}</h3><strong>{(rank?.score ?? 0).toLocaleString('fa-IR')} امتیاز</strong><div className="rank-progress"><i style={{ width: `${rank ? Math.min(100, (rank.score / Math.max(1, rank.min_score)) * 100) : 0}%` }}/></div><small>امتیازدهی و ارتقا توسط سرور کنترل می‌شود.</small></div><div className="badge-card"><div className="side-info-title"><Sparkles size={17}/><strong>نشان‌های من</strong></div>{badges.length ? badges.map((b) => <div className="badge-row" key={b.badge_code}><span>✦</span><div><strong>{b.badge_code}</strong><small>{formatDate(b.awarded_at)}</small></div></div>) : <p>هنوز نشانی دریافت نکرده‌ای.</p>}</div></aside></div></div>;
}
