'use client';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const [rank, setRank] = useState<{ title: string; score: number; min_score: number } | null>(null);
  const [badges, setBadges] = useState<{ badge_code: string; awarded_at: string }[]>([]);
  const [followRequests, setFollowRequests] = useState<{ follower_id: string; display_name: string; username: string | null }[]>([]);
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
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
      const { data: requests, error: requestError } = await supabase.from('follows')
        .select('follower_id').eq('following_id', userId).eq('status', 'pending');
      if (!alive) return;
      if (requestError) notify('دریافت درخواست‌های دنبال‌کردن ناموفق بود: ' + requestError.message, 'error');
      const ids = (requests ?? []).map((row) => row.follower_id);
      if (ids.length) {
        const { data: people, error: peopleError } = await supabase.from('profiles')
          .select('id,display_name,username').in('id', ids);
        if (!alive) return;
        if (peopleError) notify('دریافت مشخصات درخواست‌دهندگان ناموفق بود: ' + peopleError.message, 'error');
        const byId = new Map((people ?? []).map((person) => [person.id, person]));
        setFollowRequests(ids.map((id) => ({
          follower_id: id,
          display_name: byId.get(id)?.display_name ?? 'کاربر کاوه',
          username: byId.get(id)?.username ?? null,
        })));
      } else setFollowRequests([]);
    };
    void load(); return () => { alive = false; };
  }, [supabase, userId]);
  const respondToFollowRequest = async (followerId: string, accept: boolean) => {
    setRequestBusy(followerId);
    const result = accept
      ? await supabase.from('follows').update({ status: 'accepted' }).eq('follower_id', followerId).eq('following_id', userId).eq('status', 'pending')
      : await supabase.from('follows').delete().eq('follower_id', followerId).eq('following_id', userId);
    setRequestBusy(null);
    if (result.error) notify('ثبت پاسخ به درخواست ناموفق بود: ' + result.error.message, 'error');
    else {
      setFollowRequests((old) => old.filter((request) => request.follower_id !== followerId));
      notify(accept ? 'درخواست دنبال‌کردن پذیرفته شد.' : 'درخواست دنبال‌کردن رد شد.');
    }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      let avatarPath = profile?.avatar_path ?? null;
      if (avatarFile) {
        if (!['image/jpeg','image/png','image/webp','image/avif'].includes(avatarFile.type) || avatarFile.size > 5 * 1024 * 1024) throw new Error('عکس باید JPG، PNG، WEBP یا AVIF و حداکثر ۵ مگابایت باشد.');
        const extension = avatarFile.type.split('/')[1].replace('jpeg','jpg');
        const path = `${userId}/avatar-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('profile-media').upload(path, avatarFile, { contentType: avatarFile.type, upsert: false });
        if (uploadError) throw uploadError;
        avatarPath = path;
      }
      const avatarUrl = avatarPath ? supabase.storage.from('profile-media').getPublicUrl(avatarPath).data.publicUrl : profile?.avatar_url ?? null;
      const patch = { display_name: name.trim(), username: username.trim() || null, bio: bio.trim(), avatar_path: avatarPath, avatar_url: avatarUrl, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
      if (error) throw error;
      setAvatarFile(null); setAvatarPreview(null);
      notify('پروفایل به‌روزرسانی شد.'); await onSaved();
    } catch (error) {
      notify(`ذخیره پروفایل انجام نشد: ${error instanceof Error ? error.message : 'خطای نامشخص'}`, 'error');
    } finally { setSaving(false); }
  };
  return <div className="page-stack"><SectionHeader eyebrow="هویت شما" title="پروفایل من" description="اطلاعات عمومی و هویت اجتماعی‌ات را مدیریت کن."/><div className="profile-layout"><section className="profile-main-card"><div className="profile-cover"><div className="profile-cover-glow"/></div><div className="profile-identity"><Avatar profile={profile ?? { display_name: name }} size="lg"/><div><h2>{(profile?.display_name ?? name) || 'کاربر کاوه'}</h2><span>@{(profile?.username ?? username) || 'نام‌کاربری-ثبت‌نشده'}</span></div><span className="verified-pill"><ShieldCheck size={14}/> {accountLabel}</span></div><form className="profile-form" onSubmit={save}><label>نام نمایشی<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required/></label><label>نام کاربری<input value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30))} maxLength={30} placeholder="مثلاً kaveh_user"/><small>فقط حروف انگلیسی، عدد و زیرخط</small></label><label>درباره من<textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={300}/></label><button className="button button-primary" disabled={saving}>{saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}</button></form></section><aside className="profile-side"><div className="rank-card"><span className="eyebrow">جایگاه اجتماعی</span><div className="rank-emblem"><Sparkles size={26}/></div><h3>{rank?.title ?? 'تازه‌وارد'}</h3><strong>{(rank?.score ?? 0).toLocaleString('fa-IR')} امتیاز</strong><div className="rank-progress"><i style={{ width: `${rank ? Math.min(100, (rank.score / Math.max(1, rank.min_score)) * 100) : 0}%` }}/></div><small>امتیازدهی و ارتقا توسط سرور کنترل می‌شود.</small></div><div className="badge-card"><div className="side-info-title"><Sparkles size={17}/><strong>نشان‌های من</strong></div>{badges.length ? badges.map((b) => <div className="badge-row" key={b.badge_code}><span>✦</span><div><strong>{b.badge_code}</strong><small>{formatDate(b.awarded_at)}</small></div></div>) : <p>هنوز نشانی دریافت نکرده‌ای.</p>}</div><div className="badge-card"><div className="side-info-title"><Sparkles size={17}/><strong>درخواست‌های دنبال‌کردن</strong></div>{followRequests.length ? followRequests.map((request) => <div className="badge-row" key={request.follower_id}><div><strong>{request.display_name}</strong><small>{request.username ? '@' + request.username : 'کاربر کاوه'}</small><div className="inline-actions"><button className="button button-primary button-small" disabled={requestBusy === request.follower_id} onClick={() => void respondToFollowRequest(request.follower_id, true)}>پذیرفتن</button><button className="button button-quiet button-small" disabled={requestBusy === request.follower_id} onClick={() => void respondToFollowRequest(request.follower_id, false)}>رد کردن</button></div></div></div>) : <p>درخواست تازه‌ای نداری.</p>}</div></aside></div></div>;
}
