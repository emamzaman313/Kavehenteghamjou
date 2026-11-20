'use client';
import { ShieldCheck, Sparkles, Music2, Palette, LockKeyhole, Award } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types';
import type { Notify } from '@/lib/ui-types';
import { formatDate } from '@/lib/format';
import { planProfileAssetCleanup } from '@/lib/profile-assets';
import { Avatar, SectionHeader } from '@/components/ui';
import { useOperationProgress } from '@/components/OperationProgress';

const PROFILE_PALETTES = [
  { name: 'یخی', accent: '#62c8ff', surface: '#102033', text: '#f2f8ff' },
  { name: 'زمردی', accent: '#4fd1a5', surface: '#10251f', text: '#effcf6' },
  { name: 'بنفش', accent: '#b49aff', surface: '#211a34', text: '#f7f2ff' },
  { name: 'کهربایی', accent: '#f0b65c', surface: '#2a2115', text: '#fff8eb' },
  { name: 'رز', accent: '#ff8fa8', surface: '#2b1821', text: '#fff1f4' },
] as const;

export default function ProfileView({ supabase, userId, profile, accountLabel, onSaved, notify }: { supabase: SupabaseClient; userId: string; profile: Profile | null; accountLabel: string; onSaved: () => Promise<void>; notify: Notify }) {
  const { runOperation } = useOperationProgress();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [profileVisibility, setProfileVisibility] = useState<'public'|'followers'|'private'>(profile?.profile_visibility === 'private' ? 'private' : profile?.profile_visibility === 'followers' ? 'followers' : 'public');
  const [profileTheme, setProfileTheme] = useState({accent:'#168bff',surface:'#101b2c',text:'#f4f1eb'});
  const [featuredBadges, setFeaturedBadges] = useState<string[]>([]);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicTitle, setMusicTitle] = useState('');
  const [removeProfileMusic, setRemoveProfileMusic] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const musicInput = useRef<HTMLInputElement>(null);
  const [rank, setRank] = useState<{ title: string; score: number; current_min_score: number; next_min_score: number | null } | null>(null);
  const [badges, setBadges] = useState<{ badge_code: string; awarded_at: string; title: string }[]>([]);
  const [followRequests, setFollowRequests] = useState<{ follower_id: string; display_name: string; username: string | null }[]>([]);
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  useEffect(() => { setName(profile?.display_name ?? ''); setUsername(profile?.username ?? ''); setBio(profile?.bio ?? ''); const p = profile as (Profile & {profile_theme?:{accent?:string;surface?:string;text?:string};featured_badges?:string[];profile_music_title?:string|null}) | null; setProfileVisibility(p?.profile_visibility === 'private' ? 'private' : p?.profile_visibility === 'followers' ? 'followers' : 'public'); setProfileTheme({accent:p?.profile_theme?.accent ?? '#168bff',surface:p?.profile_theme?.surface ?? '#101b2c',text:p?.profile_theme?.text ?? '#f4f1eb'}); setFeaturedBadges(p?.featured_badges ?? []); setMusicTitle(p?.profile_music_title ?? ''); }, [profile]);
  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);
  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);
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
      setRank({ title: current?.title ?? 'تازه‌وارد', score, current_min_score: Number(current?.min_score ?? 0), next_min_score: next ? Number(next.min_score) : null });
      const earnedCodes = (earned ?? []).map((row) => row.badge_code);
      const { data: definitions } = earnedCodes.length ? await supabase.from('badges').select('code,title').in('code', earnedCodes) : { data: [] };
      const titleByCode = new Map((definitions ?? []).map((row) => [row.code, row.title]));
      setBadges((earned ?? []).map((row) => ({ ...row, title: titleByCode.get(row.badge_code) ?? row.badge_code })));
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
    const uploadedAssets: { bucket: string; path: string }[] = [];
    let profileUpdateAttempted = false;
    try {
      await runOperation('ذخیره هویت پروفایل', async (advance) => {
      advance(10, 'اعتبارسنجی اطلاعات و تنظیمات هویت');
      let avatarPath = profile?.avatar_path ?? null;
      let coverPath = profile?.cover_path ?? null;
      if (avatarFile) {
        if (!['image/jpeg','image/png','image/webp','image/avif'].includes(avatarFile.type) || avatarFile.size > 5 * 1024 * 1024) throw new Error('عکس باید JPG، PNG، WEBP یا AVIF و حداکثر ۵ مگابایت باشد.');
        const extension = avatarFile.type.split('/')[1].replace('jpeg','jpg');
        const path = `${userId}/avatar-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('profile-media').upload(path, avatarFile, { contentType: avatarFile.type, upsert: false });
        if (uploadError) throw uploadError;
        uploadedAssets.push({ bucket: 'profile-media', path });
        avatarPath = path;
        advance(34, 'تصویر پروفایل بارگذاری شد');
      }
      if (coverFile) {
        if (!['image/jpeg','image/png','image/webp','image/avif','image/gif'].includes(coverFile.type) || coverFile.size > 5 * 1024 * 1024) throw new Error('کاور باید JPG، PNG، WEBP، AVIF یا GIF متحرک و حداکثر ۵ مگابایت باشد.');
        const extension = coverFile.type.split('/')[1].replace('jpeg','jpg');
        coverPath = `${userId}/cover-${crypto.randomUUID()}.${extension}`;
        const { error: coverUploadError } = await supabase.storage.from('profile-media').upload(coverPath, coverFile, { contentType: coverFile.type, upsert: false });
        if (coverUploadError) throw coverUploadError;
        uploadedAssets.push({ bucket: 'profile-media', path: coverPath });
        advance(54, 'کاور پروفایل در فضای رسانه ذخیره شد');
      }
      const avatarUrl = avatarPath ? supabase.storage.from('profile-media').getPublicUrl(avatarPath).data.publicUrl : profile?.avatar_url ?? null;
      let profileMusicPath = (profile as Profile & {profile_music_path?:string|null} | null)?.profile_music_path ?? null;
      if (removeProfileMusic) profileMusicPath = null;
      if (musicFile) {
        if (!musicFile.type.startsWith('audio/') || musicFile.size < 1 || musicFile.size > 20 * 1024 * 1024) throw new Error('موسیقی پروفایل باید فایل صوتی معتبر و حداکثر ۲۰ مگابایت باشد.');
        const extension = musicFile.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8) || 'audio';
        const path = userId + '/profile-music-' + crypto.randomUUID() + '.' + extension;
        const { error: musicUploadError } = await supabase.storage.from('post-media').upload(path,musicFile,{contentType:musicFile.type,upsert:false});
        if (musicUploadError) throw musicUploadError;
        uploadedAssets.push({ bucket: 'post-media', path });
        profileMusicPath = path;
        advance(72, 'موسیقی پروفایل بارگذاری شد');
      }
      const safeTheme = {
        accent: /^#[0-9a-fA-F]{6}$/.test(profileTheme.accent) ? profileTheme.accent : '#168bff',
        surface: /^#[0-9a-fA-F]{6}$/.test(profileTheme.surface) ? profileTheme.surface : '#101b2c',
        text: /^#[0-9a-fA-F]{6}$/.test(profileTheme.text) ? profileTheme.text : '#f4f1eb',
      };
      const patch = { display_name: name.trim(), username: username.trim() || null, bio: bio.trim(), avatar_path: avatarPath, avatar_url: avatarUrl, cover_path: coverPath, profile_visibility: profileVisibility, profile_theme: safeTheme, featured_badges: featuredBadges.filter(code => badges.some(b => b.badge_code === code)).slice(0,6), profile_music_path: profileMusicPath, profile_music_title: profileMusicPath ? musicTitle.trim().slice(0,120) || 'موسیقی پروفایل' : null, updated_at: new Date().toISOString() };
      advance(82, 'اعتبارسنجی نهایی و ثبت اطلاعات پروفایل');
      profileUpdateAttempted = true;
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
      if (error) throw error;
      advance(94, 'اطلاعات هویت با موفقیت در سرور ذخیره شد');
      const obsoleteAssets = [
        profile?.avatar_path && profile.avatar_path !== avatarPath ? { bucket: 'profile-media', path: profile.avatar_path } : null,
        profile?.cover_path && profile.cover_path !== coverPath ? { bucket: 'profile-media', path: profile.cover_path } : null,
        (profile as Profile & {profile_music_path?:string|null} | null)?.profile_music_path && (profile as Profile & {profile_music_path?:string|null}).profile_music_path !== profileMusicPath ? { bucket: 'post-media', path: (profile as Profile & {profile_music_path:string}).profile_music_path } : null,
      ].filter((asset): asset is {bucket:string;path:string} => Boolean(asset && asset.path.startsWith(userId + '/')));
      await Promise.allSettled(obsoleteAssets.map(asset => supabase.storage.from(asset.bucket).remove([asset.path])));
      setAvatarFile(null); setAvatarPreview(null); setCoverFile(null); setCoverPreview(null); setMusicFile(null); setRemoveProfileMusic(false);
      notify('پروفایل به‌روزرسانی شد.'); await onSaved();
      });
    } catch (error) {
      // Compensate successful Storage uploads when the profile write did not
      // commit. If the write result was ambiguous, read saved pointers first;
      // never delete an asset that may already be referenced by the profile.
      let savedProfile: { avatar_path: string | null; cover_path: string | null; profile_music_path: string | null } | null = null;
      if (profileUpdateAttempted && uploadedAssets.length) {
        const { data, error: readError } = await supabase
          .from('profiles')
          .select('avatar_path,cover_path,profile_music_path')
          .eq('id', userId)
          .maybeSingle();
        if (!readError) savedProfile = data;
      }
      const cleanupPlan = planProfileAssetCleanup(uploadedAssets, profileUpdateAttempted, savedProfile);
      if (cleanupPlan) {
        await Promise.allSettled(cleanupPlan.map(asset =>
          supabase.storage.from(asset.bucket).remove([asset.path])
        ));
      }
      notify(`ذخیره پروفایل انجام نشد: ${error instanceof Error ? error.message : 'خطای نامشخص'}`, 'error');
    } finally { setSaving(false); }
  };
  const rankProgress = rank?.next_min_score ? Math.max(0, Math.min(100, ((rank.score - rank.current_min_score) / Math.max(1, rank.next_min_score - rank.current_min_score)) * 100)) : 100;
  const profileChecks = [
    { label: 'نام نمایشی', done: Boolean(name.trim()) },
    { label: 'نام کاربری', done: Boolean(username.trim()) },
    { label: 'معرفی کوتاه', done: Boolean(bio.trim()) },
    { label: 'تصویر پروفایل', done: Boolean(avatarFile || avatarPreview || profile?.avatar_path || profile?.avatar_url) },
    { label: 'کاور اختصاصی', done: Boolean(coverFile || coverPreview || profile?.cover_path) },
    { label: 'موسیقی پروفایل', done: Boolean(musicFile || (!removeProfileMusic && (profile as Profile & {profile_music_path?:string|null} | null)?.profile_music_path)) },
    { label: 'نشان منتخب', done: featuredBadges.length > 0 },
  ];
  const profileCompletion = Math.round(profileChecks.filter((item) => item.done).length / profileChecks.length * 100);
  const coverUrl = coverPreview ?? (profile?.cover_path ? supabase.storage.from('profile-media').getPublicUrl(profile.cover_path).data.publicUrl : null);
  return <div className="page-stack"><SectionHeader eyebrow="هویت شما" title="پروفایل من" description="اطلاعات عمومی و هویت اجتماعی‌ات را مدیریت کن."/><div className="profile-layout"><section className="profile-main-card" style={{borderColor:profileTheme.accent}}><div className="profile-cover" style={coverUrl ? { backgroundImage: 'linear-gradient(110deg,rgba(7,17,31,.24),rgba(7,17,31,.5)),url("' + coverUrl + '")', backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}><div className="profile-cover-glow"/><button type="button" className="profile-cover-edit" onClick={() => coverInput.current?.click()}>تغییر کاور</button><input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); } }}/></div><div className="profile-identity"><button type="button" className="profile-avatar-edit" onClick={() => avatarInput.current?.click()} aria-label="انتخاب عکس پروفایل"><Avatar profile={{ ...(profile ?? { display_name: name }), display_name: name, avatar_url: avatarPreview ?? profile?.avatar_url }} size="lg"/><span>تغییر عکس</span></button><input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); } }}/><div><h2>{name || 'کاربر کاوه'}</h2><span>@{username || 'نام‌کاربری-ثبت‌نشده'}</span></div><span className="verified-pill"><ShieldCheck size={14}/> {accountLabel}</span></div><section className="profile-identity-meter" aria-label="میزان تکمیل پروفایل"><div className="profile-meter-heading"><div><span>قدرت هویت دیجیتال</span><strong>{profileCompletion.toLocaleString('fa-IR')}٪ <small>تکمیل‌شده</small></strong></div><span className="profile-meter-orbit"><Sparkles size={18}/></span></div><div className="profile-meter-track" role="progressbar" aria-valuenow={profileCompletion} aria-valuemin={0} aria-valuemax={100} aria-label="درصد تکمیل پروفایل"><i style={{ width: profileCompletion + '%' }}/></div><div className="profile-meter-checks">{profileChecks.map((item) => <span key={item.label} className={item.done ? 'is-done' : ''}><i>{item.done ? '✓' : '＋'}</i>{item.label}</span>)}</div><p>{profileCompletion === 100 ? 'هویتت کامل است؛ آماده‌ای که در جهان کاوه بدرخشی.' : 'با تکمیل موارد باقی‌مانده، پروفایلت را به یک کارت هویت کامل تبدیل کن.'}</p></section><form className="profile-form" onSubmit={save}><label>نام نمایشی<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required/></label><label>نام کاربری<input value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30))} maxLength={30} placeholder="مثلاً kaveh_user"/><small>فقط حروف انگلیسی، عدد و زیرخط</small></label><label>درباره من<textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={300}/></label><section className="profile-customization">
  <div className="side-info-title"><Palette size={17}/><strong>شخصی‌سازی پروفایل</strong></div>
  <div className="profile-custom-grid">
    <label>رنگ تأکیدی <input type="color" value={profileTheme.accent} onChange={e=>setProfileTheme(v=>({...v,accent:e.target.value}))}/></label>
    <label>پس‌زمینه کارت <input type="color" value={profileTheme.surface} onChange={e=>setProfileTheme(v=>({...v,surface:e.target.value}))}/></label>
    <label>رنگ نوشته <input type="color" value={profileTheme.text} onChange={e=>setProfileTheme(v=>({...v,text:e.target.value}))}/></label>
  </div>
  <div className="profile-palette-presets" role="group" aria-label="قالب‌های آماده پروفایل">
    {PROFILE_PALETTES.map((palette) => <button key={palette.name} type="button" className={profileTheme.accent === palette.accent ? 'active' : ''} onClick={() => setProfileTheme({ accent: palette.accent, surface: palette.surface, text: palette.text })}>
      <i style={{ background: palette.accent }}/>{palette.name}
    </button>)}
  </div>
  <div className="profile-live-preview" style={{ '--profile-accent': profileTheme.accent, '--profile-surface': profileTheme.surface, '--profile-text': profileTheme.text } as React.CSSProperties} aria-label="پیش‌نمایش زنده پروفایل">
    <div className="profile-live-cover" style={coverUrl ? { backgroundImage: 'linear-gradient(110deg,rgba(4,10,20,.12),rgba(4,10,20,.64)),url("' + coverUrl + '")' } : undefined}>
      <span>پیش‌نمایش زنده</span><i/>
    </div>
    <div className="profile-live-body">
      <Avatar profile={{ ...(profile ?? { display_name: name }), display_name: name, avatar_url: avatarPreview ?? profile?.avatar_url }} size="lg"/>
      <div className="profile-live-identity"><strong>{name.trim() || 'نام نمایشی شما'}</strong><small dir="ltr">@{username || 'kaveh_user'}</small></div>
      <span className="profile-live-mark"><ShieldCheck size={13}/>{accountLabel}</span>
      <p>{bio.trim() || 'اینجا پیش‌نمایش معرفی کوتاه تو نمایش داده می‌شود.'}</p>
      <div className="profile-live-badges">{badges.filter((badge) => featuredBadges.includes(badge.badge_code)).slice(0,6).map((badge) => <span key={badge.badge_code}>✦ {badge.title}</span>)}{featuredBadges.length === 0 && <small>نشان‌های منتخب اینجا دیده می‌شوند</small>}</div>
      <div className="profile-live-footer"><span>کاوه انتقامجو</span><b>هویت دیجیتال من</b></div>
    </div>
  </div>
  <small className="profile-preview-hint">تغییر رنگ، تصویر، نام و توضیحات را همین‌جا زنده ببین؛ با ذخیره، تنظیمات روی پروفایل اعمال می‌شوند.</small>
  <label className="profile-privacy-field"><LockKeyhole size={15}/> حریم خصوصی پروفایل
    <select value={profileVisibility} onChange={e=>setProfileVisibility(e.target.value as typeof profileVisibility)}><option value="public">عمومی — همه کاربران</option><option value="followers">دنبال‌کنندگان تأییدشده</option><option value="private">خصوصی — فقط خودم</option></select>
  </label>
  <div className="profile-music-editor"><div className="side-info-title"><Music2 size={17}/><strong>موسیقی اختصاصی پروفایل</strong></div>
    <input ref={musicInput} type="file" accept="audio/*" hidden onChange={e=>setMusicFile(e.target.files?.[0]??null)}/>
    <input value={musicTitle} onChange={e=>setMusicTitle(e.target.value)} maxLength={120} placeholder="نام قطعه موسیقی"/>
    <div className="inline-actions"><button className="button button-quiet button-small" type="button" onClick={()=>musicInput.current?.click()}>انتخاب موسیقی (حداکثر ۲۰ مگابایت)</button>{(musicFile || (profile as Profile & {profile_music_path?:string|null} | null)?.profile_music_path) && <button className="button button-quiet button-small" type="button" onClick={()=>{setMusicFile(null);setRemoveProfileMusic(true);setMusicTitle('');}}>حذف موسیقی</button>}</div>
    {musicFile && <small>فایل جدید: {musicFile.name}</small>}
    {(profile as Profile & {profile_music_path?:string|null} | null)?.profile_music_path && !removeProfileMusic && !musicFile && <audio controls preload="none" src={supabase.storage.from('post-media').getPublicUrl((profile as Profile & {profile_music_path:string}).profile_music_path).data.publicUrl}/>}
    <small>پخش موسیقی در مرورگر ممکن است به اقدام کاربر نیاز داشته باشد؛ پخش اجباری و بی‌اجازه انجام نمی‌شود.</small>
  </div>
  <div className="profile-featured-badges"><div className="side-info-title"><Award size={17}/><strong>ویترین دستاوردها (حداکثر ۶ نشان)</strong></div>
    {badges.length ? <div className="profile-featured-grid">{badges.map(b=><label key={b.badge_code}><input type="checkbox" checked={featuredBadges.includes(b.badge_code)} disabled={!featuredBadges.includes(b.badge_code)&&featuredBadges.length>=6} onChange={e=>setFeaturedBadges(old=>e.target.checked?[...old,b.badge_code]:old.filter(code=>code!==b.badge_code))}/><span>✦ {b.title}</span></label>)}</div> : <small>پس از دریافت نشان، می‌توانی آن را در ویترین نمایش دهی.</small>}
  </div>
</section>
<button className="button button-primary" disabled={saving}>{saving ? 'در حال ذخیره…' : 'ذخیره همه تنظیمات پروفایل'}</button></form></section><aside className="profile-side"><div className="rank-card"><span className="eyebrow">جایگاه اجتماعی</span><div className="rank-emblem"><Sparkles size={26}/></div><h3>{rank?.title ?? 'تازه‌وارد'}</h3><strong>{(rank?.score ?? 0).toLocaleString('fa-IR')} امتیاز</strong><div className="rank-progress"><i style={{ width: `${rankProgress}%` }}/></div><small>امتیازدهی و ارتقا توسط سرور کنترل می‌شود.</small></div><div className="badge-card"><div className="side-info-title"><Sparkles size={17}/><strong>نشان‌های من</strong></div>{badges.length ? badges.map((b) => <div className="badge-row" key={b.badge_code}><span>✦</span><div><strong>{b.title}</strong><small>{formatDate(b.awarded_at)}</small></div></div>) : <p>هنوز نشانی دریافت نکرده‌ای.</p>}</div><div className="badge-card profile-showcase"><div className="side-info-title"><Award size={17}/><strong>ویترین دستاوردهای منتخب</strong></div>{featuredBadges.length ? badges.filter(b=>featuredBadges.includes(b.badge_code)).map(b=><div className="badge-row" key={b.badge_code}><span>✦</span><div><strong>{b.title}</strong><small>نمایش در ویترین پروفایل</small></div></div>) : <p>از بخش شخصی‌سازی، نشان‌هایی را برای نمایش انتخاب کن.</p>}</div><div className="badge-card"><div className="side-info-title"><Sparkles size={17}/><strong>درخواست‌های دنبال‌کردن</strong></div>{followRequests.length ? followRequests.map((request) => <div className="badge-row" key={request.follower_id}><div><strong>{request.display_name}</strong><small>{request.username ? '@' + request.username : 'کاربر کاوه'}</small><div className="inline-actions"><button className="button button-primary button-small" disabled={requestBusy === request.follower_id} onClick={() => void respondToFollowRequest(request.follower_id, true)}>پذیرفتن</button><button className="button button-quiet button-small" disabled={requestBusy === request.follower_id} onClick={() => void respondToFollowRequest(request.follower_id, false)}>رد کردن</button></div></div></div>) : <p>درخواست تازه‌ای نداری.</p>}</div></aside></div></div>;
}
