'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Award, CalendarDays, Check, Crown, Flame, Flag, Medal, Plus, RefreshCw, Sparkles, Trophy } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Notify } from '@/lib/ui-types';
import { SectionHeader } from '@/components/ui';

type Mission = { id: string; code: string; title: string; description: string; action_key: string; target_count: number; reward_points: number; active: boolean; starts_at: string; ends_at: string | null };
type Progress = { mission_id: string; progress_count: number; completed_at: string | null; reward_claimed_at: string | null };
type EventRow = { id: string; title: string; summary: string; body: string; category: string; banner_path: string | null; status: string; starts_at: string; ends_at: string | null; points_reward: number; participant_count: number };
type RankRow = { user_id: string; score: number; rank_code: string };
type RankLevel = { code: string; title: string; min_score: number; sort_order: number; accent_token: string };
type BadgeRow = { code: string; title: string; description: string; icon_key: string; accent_token: string };

const actionLabels: Record<string, string> = { publish_post: 'انتشار پست', react_post: 'واکنش به پست‌ها', comment_post: 'ثبت دیدگاه', publish_reel: 'انتشار ریلز' };
const categoryLabels: Record<string, string> = { community: 'جامعه', competition: 'رقابت', announcement: 'اطلاعیه', challenge: 'چالش', live: 'رویداد زنده' };

export default function KavehWorldView({ supabase, userId, isAdmin, notify }: { supabase: SupabaseClient; userId: string; isAdmin: boolean; notify: Notify }) {
  const [tab, setTab] = useState<'missions' | 'events' | 'leaderboard' | 'honors'>('missions');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [ranking, setRanking] = useState<{ row: RankRow; name: string; username: string | null; rank: RankLevel | null }[]>([]);
  const [myRank, setMyRank] = useState<{ score: number; rank: RankLevel | null } | null>(null);
  const [levels, setLevels] = useState<RankLevel[]>([]);
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [myBadges, setMyBadges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [missionTitle, setMissionTitle] = useState('');
  const [missionDescription, setMissionDescription] = useState('');
  const [missionAction, setMissionAction] = useState('publish_post');
  const [missionTarget, setMissionTarget] = useState('1');
  const [missionReward, setMissionReward] = useState('25');
  const [eventTitle, setEventTitle] = useState('');
  const [eventSummary, setEventSummary] = useState('');
  const [eventBody, setEventBody] = useState('');
  const [eventCategory, setEventCategory] = useState('community');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventReward, setEventReward] = useState('0');
  const [eventBanner, setEventBanner] = useState<File | null>(null);
  const [badgeCode, setBadgeCode] = useState('');
  const [badgeTitle, setBadgeTitle] = useState('');
  const [badgeDescription, setBadgeDescription] = useState('');
  const [awardUser, setAwardUser] = useState('');
  const [selectedBadgeCode, setSelectedBadgeCode] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    const now = new Date().toISOString();
    const [missionResult, progressResult, eventResult, joinedResult, levelResult, rankResult, badgeResult, myBadgeResult] = await Promise.all([
      isAdmin ? supabase.from('daily_missions').select('id,code,title,description,action_key,target_count,reward_points,active,starts_at,ends_at').order('created_at', { ascending: false }) : supabase.from('daily_missions').select('id,code,title,description,action_key,target_count,reward_points,active,starts_at,ends_at').eq('active', true).lte('starts_at', now).or('ends_at.is.null,ends_at.gt.' + now).order('created_at', { ascending: false }),
      supabase.from('mission_progress').select('mission_id,progress_count,completed_at,reward_claimed_at').eq('user_id', userId),
      isAdmin ? supabase.from('platform_events').select('id,title,summary,body,category,banner_path,status,starts_at,ends_at,points_reward,participant_count').order('starts_at', { ascending: false }).limit(50) : supabase.from('platform_events').select('id,title,summary,body,category,banner_path,status,starts_at,ends_at,points_reward,participant_count').eq('status', 'published').or('ends_at.is.null,ends_at.gt.' + now).order('starts_at', { ascending: false }).limit(30),
      supabase.from('platform_event_participants').select('event_id').eq('user_id', userId),
      supabase.from('rank_levels').select('code,title,min_score,sort_order,accent_token').order('sort_order'),
      supabase.from('user_rank_state').select('user_id,score,rank_code').order('score', { ascending: false }).limit(12),
      supabase.from('badges').select('code,title,description,icon_key,accent_token'),
      supabase.from('user_badges').select('badge_code').eq('user_id', userId),
    ]);
    if (missionResult.error) notify('بارگذاری مأموریت‌ها ناموفق بود: ' + missionResult.error.message, 'error');
    else setMissions((missionResult.data ?? []) as Mission[]);
    if (!progressResult.error) setProgress((progressResult.data ?? []) as Progress[]);
    if (eventResult.error) notify('بارگذاری رویدادها ناموفق بود: ' + eventResult.error.message, 'error');
    else setEvents((eventResult.data ?? []) as EventRow[]);
    if (!joinedResult.error) setJoined(new Set((joinedResult.data ?? []).map((row) => row.event_id)));
    const rankLevels = (levelResult.data ?? []) as RankLevel[];
    setLevels(rankLevels);
    const rankRows = (rankResult.data ?? []) as RankRow[];
    const ids = rankRows.map((row) => row.user_id);
    const { data: profiles } = ids.length ? await supabase.from('profiles').select('id,display_name,username').in('id', ids) : { data: [] };
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    setRanking(rankRows.map((row) => {
      const profile = profileMap.get(row.user_id);
      return { row, name: profile?.display_name || profile?.username || 'کاربر کاوه', username: profile?.username ?? null, rank: rankLevels.find((level) => level.code === row.rank_code) ?? null };
    }));
    const mine = rankRows.find((row) => row.user_id === userId);
    if (mine) setMyRank({ score: mine.score, rank: rankLevels.find((level) => level.code === mine.rank_code) ?? null });
    else {
      const { data: own } = await supabase.from('user_rank_state').select('score,rank_code').eq('user_id', userId).maybeSingle();
      setMyRank(own ? { score: own.score, rank: rankLevels.find((level) => level.code === own.rank_code) ?? null } : { score: 0, rank: rankLevels[0] ?? null });
    }
    if (!badgeResult.error) setBadges((badgeResult.data ?? []) as BadgeRow[]);
    if (!myBadgeResult.error) setMyBadges((myBadgeResult.data ?? []).map((row) => row.badge_code));
    setLoading(false);
  }, [supabase, userId, isAdmin, notify]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const channel = supabase.channel('kaveh-world:' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_missions' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_events' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_event_participants', filter: 'user_id=eq.' + userId }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mission_progress', filter: 'user_id=eq.' + userId }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_rank_state', filter: 'user_id=eq.' + userId }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_badges', filter: 'user_id=eq.' + userId }, () => { void refresh(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, userId, refresh]);

  const progressMap = useMemo(() => new Map(progress.map((item) => [item.mission_id, item])), [progress]);
  const nextRank = useMemo(() => levels.find((level) => level.min_score > (myRank?.score ?? 0)) ?? null, [levels, myRank]);
  const currentRankMin = myRank?.rank?.min_score ?? 0;
  const rankPercent = nextRank ? Math.max(0, Math.min(100, (((myRank?.score ?? 0) - currentRankMin) / Math.max(1, nextRank.min_score - currentRankMin)) * 100)) : 100;

  const joinEvent = async (event: EventRow) => {
    setBusy(event.id);
    const isJoined = joined.has(event.id);
    const result = isJoined
      ? await supabase.from('platform_event_participants').delete().eq('event_id', event.id).eq('user_id', userId)
      : await supabase.from('platform_event_participants').insert({ event_id: event.id, user_id: userId });
    setBusy(null);
    if (result.error) { notify('تغییر عضویت رویداد انجام نشد: ' + result.error.message, 'error'); return; }
    setJoined((current) => { const next = new Set(current); if (isJoined) next.delete(event.id); else next.add(event.id); return next; });
    notify(isJoined ? 'از رویداد خارج شدی.' : 'با موفقیت به رویداد پیوستی.');
  };

  const createMission = async (event: FormEvent) => {
    event.preventDefault();
    if (!missionTitle.trim()) return;
    setBusy('mission-create');
    const { error } = await supabase.from('daily_missions').insert({
      code: 'mission-' + Date.now(), title: missionTitle.trim(), description: missionDescription.trim(),
      action_key: missionAction, target_count: Number(missionTarget), reward_points: Number(missionReward),
      active: true, starts_at: new Date().toISOString(), created_by: userId,
    });
    setBusy(null);
    if (error) { notify('ساخت مأموریت ناموفق بود: ' + error.message, 'error'); return; }
    setMissionTitle(''); setMissionDescription(''); setMissionTarget('1'); setMissionReward('25');
    notify('مأموریت جدید منتشر شد.'); await refresh();
  };

  const createEvent = async (event: FormEvent) => {
    event.preventDefault();
    if (!eventTitle.trim() || !eventStart) return;
    const startsAt = new Date(eventStart).toISOString();
    const endsAt = eventEnd ? new Date(eventEnd).toISOString() : null;
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) { notify('زمان پایان باید بعد از زمان شروع باشد.', 'error'); return; }
    if (eventBanner && (!eventBanner.type.startsWith('image/') || eventBanner.size > 5 * 1024 * 1024)) { notify('بنر رویداد باید تصویر معتبر و حداکثر ۵ مگابایت باشد.', 'error'); return; }
    setBusy('event-create');
    let bannerPath: string | null = null;
    if (eventBanner) {
      const safeName = eventBanner.name.replace(/[^A-Za-z0-9_.-]/g, '_').slice(-80) || 'event-cover';
      bannerPath = userId + '/events/' + crypto.randomUUID() + '-' + safeName;
      const upload = await supabase.storage.from('post-media').upload(bannerPath, eventBanner, { contentType: eventBanner.type, cacheControl: '3600', upsert: false });
      if (upload.error) { setBusy(null); notify('بارگذاری بنر رویداد ناموفق بود: ' + upload.error.message, 'error'); return; }
    }
    const { error } = await supabase.from('platform_events').insert({
      title: eventTitle.trim(), summary: eventSummary.trim(), body: eventBody.trim(),
      category: eventCategory, status: 'published', starts_at: startsAt, ends_at: endsAt,
      points_reward: Number(eventReward), banner_path: bannerPath, created_by: userId,
    });
    setBusy(null);
    if (error) { if (bannerPath) await supabase.storage.from('post-media').remove([bannerPath]); notify('ساخت رویداد ناموفق بود: ' + error.message, 'error'); return; }
    setEventTitle(''); setEventSummary(''); setEventBody(''); setEventStart(''); setEventEnd(''); setEventReward('0'); setEventBanner(null);
    notify('رویداد در جهان کاوه منتشر شد.'); await refresh();
  };

  const toggleMission = async (mission: Mission) => {
    setBusy(mission.id);
    const { error } = await supabase.from('daily_missions').update({ active: !mission.active }).eq('id', mission.id);
    setBusy(null);
    if (error) { notify('تغییر وضعیت مأموریت ناموفق بود: ' + error.message, 'error'); return; }
    notify(mission.active ? 'مأموریت متوقف شد.' : 'مأموریت دوباره فعال شد.'); await refresh();
  };

  const updateEventStatus = async (event: EventRow, status: string) => {
    if (status === 'archived' && !window.confirm('با پایان دادن به رویداد، امتیاز جایزه به تمام شرکت‌کنندگان ثبت‌شده اعطا می‌شود. ادامه می‌دهی؟')) return;
    setBusy(event.id);
    const { error } = await supabase.from('platform_events').update({ status }).eq('id', event.id);
    setBusy(null);
    if (error) { notify('تغییر وضعیت رویداد ناموفق بود.', 'error'); return; }
    notify('وضعیت رویداد به‌روزرسانی شد.'); await refresh();
  };

  const createBadge = async (event: FormEvent) => {
    event.preventDefault();
    const code = badgeCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!code || !badgeTitle.trim()) return;
    setBusy('badge-create');
    const { error } = await supabase.from('badges').insert({ code, title: badgeTitle.trim(), description: badgeDescription.trim(), icon_key: 'award', accent_token: 'gold' });
    setBusy(null);
    if (error) { notify('ساخت نشان ناموفق بود: ' + error.message, 'error'); return; }
    setBadgeCode(''); setBadgeTitle(''); setBadgeDescription(''); notify('نشان جدید ساخته شد.'); await refresh();
  };

  const handleAwardBadge = async (event: FormEvent) => {
    event.preventDefault();
    if (!awardUser || !selectedBadgeCode) return;
    setBusy('badge-award');
    const { error } = await supabase.from('user_badges').insert({ user_id: awardUser.trim(), badge_code: selectedBadgeCode, awarded_by: userId });
    setBusy(null);
    if (error) { notify('اعطای نشان ناموفق بود: ' + error.message, 'error'); return; }
    setAwardUser(''); setSelectedBadgeCode(''); notify('نشان با موفقیت اعطا شد.'); await refresh();
  };

  return (
    <div className="kaveh-world page-stack">
      <SectionHeader eyebrow="KAVEH UNIVERSE" title="جهان کاوه" description="یک فضای زنده برای رشد، رقابت سالم، افتخار و رویدادهای مشترک جامعه کاوه."/>
      <section className="world-hero">
        <div className="world-hero-orbit"><span/><i/><b>KV</b></div>
        <div className="world-hero-copy"><span className="world-kicker"><Sparkles size={14}/> فصل تازه کاوه</span><h2>هر مشارکت، یک قدم رو به جلو</h2><p>فعالیت‌های واقعی تو به پیشرفت حساب، نشان‌های افتخار و جایگاهت در جامعه کمک می‌کند.</p></div>
        <div className="world-hero-stats"><div><strong>{myRank?.score ?? 0}</strong><span>امتیاز تو</span></div><div><strong>{myRank?.rank?.title ?? 'تازه‌وارد'}</strong><span>رتبه فعلی</span></div></div>
      </section>
      <section className="world-rank-card">
        <div className="world-rank-heading"><div className="world-rank-icon"><Crown size={22}/></div><div><strong>مسیر پیشرفت</strong><small>{nextRank ? `تا رتبه ${nextRank.title}` : 'به بالاترین رتبه رسیده‌ای'}</small></div><b>{Math.round(rankPercent)}٪</b></div>
        <div className="world-progress-track"><i style={{ width: rankPercent + '%' }}/></div>
        <div className="world-rank-foot"><span>{myRank?.rank?.title ?? 'شروع مسیر'}</span><span>{nextRank ? `${nextRank.min_score - (myRank?.score ?? 0)} امتیاز تا رتبه بعدی` : 'قله را فتح کردی'}</span></div>
      </section>
      <div className="world-tabs" role="tablist" aria-label="بخش‌های جهان کاوه">
        {([{id:'missions',label:'مأموریت‌ها',icon:Flag},{id:'events',label:'رویدادها',icon:CalendarDays},{id:'leaderboard',label:'جدول برترین‌ها',icon:Trophy},{id:'honors',label:'تالار افتخار',icon:Medal}] as const).map((item) => <button type="button" key={item.id} className={tab===item.id?'active':''} onClick={()=>setTab(item.id)}><item.icon size={17}/>{item.label}</button>)}
      </div>
      {isAdmin && <div className="world-admin-note"><ShieldIcon/> کنترل مدیریتی فعال است؛ مأموریت، رویداد و نشان‌ها از همین بخش مدیریت می‌شوند.</div>}
      {loading ? <div className="world-loading"><span className="spinner"/> در حال همگام‌سازی جهان کاوه…</div> : <>
        {tab === 'missions' && <div className="world-section-grid">
          <div className="world-list">{missions.length ? missions.map((mission) => {
            const state = progressMap.get(mission.id);
            const count = Math.min(state?.progress_count ?? 0, mission.target_count);
            const percent = Math.round(count / mission.target_count * 100);
            return <article className={state?.completed_at ? 'world-mission completed' : 'world-mission'} key={mission.id}>
              <div className="world-card-icon"><Flame size={19}/></div><div className="world-card-content"><div className="world-card-top"><strong>{mission.title}</strong>{state?.completed_at ? <span className="world-complete"><Check size={13}/> تکمیل شد</span> : <span className="world-reward">+{mission.reward_points} XP</span>}{isAdmin && <button type="button" className="world-mission-toggle" onClick={()=>void toggleMission(mission)} disabled={busy===mission.id}>{mission.active?'توقف':'فعال‌سازی'}</button>}</div><p>{mission.description}</p><div className="world-progress-track"><i style={{width:percent+'%'}}/></div><small>{actionLabels[mission.action_key] ?? mission.action_key} · {count} از {mission.target_count}</small></div>
            </article>;
          }) : <div className="world-empty"><Flag size={24}/><strong>فعلاً مأموریت فعالی وجود ندارد</strong><span>به‌زودی چالش‌های تازه اضافه می‌شوند.</span></div>}</div>
          {isAdmin && <form className="world-admin-card" onSubmit={createMission}><div className="world-admin-title"><Plus size={18}/><strong>ساخت مأموریت</strong></div><input className="field-input" value={missionTitle} onChange={(e)=>setMissionTitle(e.target.value)} placeholder="عنوان مأموریت" maxLength={120} required/><textarea className="field-input" value={missionDescription} onChange={(e)=>setMissionDescription(e.target.value)} placeholder="توضیح کوتاه" rows={3}/><label>نوع فعالیت<select className="field-input" value={missionAction} onChange={(e)=>setMissionAction(e.target.value)}>{Object.entries(actionLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><div className="world-form-row"><label>تعداد هدف<input className="field-input" type="number" min="1" max="100" value={missionTarget} onChange={(e)=>setMissionTarget(e.target.value)} required/></label><label>جایزه XP<input className="field-input" type="number" min="0" max="10000" value={missionReward} onChange={(e)=>setMissionReward(e.target.value)} required/></label></div><button className="button button-primary" disabled={busy==='mission-create'}>{busy==='mission-create'?'در حال ساخت…':'انتشار مأموریت'}</button></form>}
        </div>}
        {tab === 'events' && <div className="world-section-grid"><div className="world-event-list">{events.length ? events.map((event) => <article className="world-event-card" key={event.id}><div className="world-event-banner" style={event.banner_path ? { backgroundImage: 'linear-gradient(120deg,rgba(6,15,26,.55),rgba(6,15,26,.45)),url("' + supabase.storage.from('post-media').getPublicUrl(event.banner_path).data.publicUrl + '")', backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}><span>{categoryLabels[event.category] ?? 'رویداد کاوه'}</span><CalendarDays size={24}/></div><div className="world-event-body"><div className="world-card-top"><strong>{event.title}</strong>{event.status!=='published'&&<span className="world-draft">{event.status==='draft'?'پیش‌نویس':'پایان‌یافته'}</span>}</div><p>{event.summary || event.body}</p><small>شروع: {new Date(event.starts_at).toLocaleString('fa-IR')} {event.ends_at ? ' · پایان: '+new Date(event.ends_at).toLocaleString('fa-IR') : ''} · {event.participant_count.toLocaleString('fa-IR')} شرکت‌کننده</small>{event.points_reward>0&&<span className="world-reward">جایزه رویداد: {event.points_reward} XP</span>}<div className="world-event-actions">{event.status==='published'&&<button className={joined.has(event.id)?'button button-quiet':'button button-primary'} onClick={()=>void joinEvent(event)} disabled={busy===event.id}>{joined.has(event.id)?'خروج از رویداد':'شرکت در رویداد'}</button>}{isAdmin&&<select className="field-input world-status-select" value={event.status} onChange={(e)=>void updateEventStatus(event,e.target.value)} disabled={busy===event.id}><option value="draft">پیش‌نویس</option><option value="published">منتشرشده</option><option value="archived">پایان رویداد و توزیع جایزه</option></select>}</div></div></article>) : <div className="world-empty"><CalendarDays size={24}/><strong>رویدادی در جریان نیست</strong><span>منتظر اتفاق بعدی باش.</span></div>}</div>{isAdmin&&<form className="world-admin-card" onSubmit={createEvent}><div className="world-admin-title"><Plus size={18}/><strong>ایجاد رویداد سراسری</strong></div><input className="field-input" value={eventTitle} onChange={(e)=>setEventTitle(e.target.value)} placeholder="عنوان رویداد" maxLength={160} required/><input className="field-input" value={eventSummary} onChange={(e)=>setEventSummary(e.target.value)} placeholder="خلاصه کوتاه"/><textarea className="field-input" value={eventBody} onChange={(e)=>setEventBody(e.target.value)} placeholder="جزئیات و قوانین رویداد" rows={4}/><label>دسته‌بندی<select className="field-input" value={eventCategory} onChange={(e)=>setEventCategory(e.target.value)}>{Object.entries(categoryLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>زمان شروع<input className="field-input" type="datetime-local" value={eventStart} onChange={(e)=>setEventStart(e.target.value)} required/></label><label>زمان پایان (اختیاری)<input className="field-input" type="datetime-local" value={eventEnd} onChange={(e)=>setEventEnd(e.target.value)}/></label><label>جایزه امتیازی<input className="field-input" type="number" min="0" max="100000" value={eventReward} onChange={(e)=>setEventReward(e.target.value)}/></label><label>بنر رویداد (اختیاری، حداکثر ۵ مگابایت)<input className="field-input" type="file" accept="image/*" onChange={(e)=>setEventBanner(e.target.files?.[0]??null)}/></label>{eventBanner&&<small>بنر انتخاب‌شده: {eventBanner.name}</small>}<button className="button button-primary" disabled={busy==='event-create'}>{busy==='event-create'?'در حال انتشار…':'انتشار رویداد'}</button></form>}</div>}
        {tab === 'leaderboard' && <section className="world-leaderboard">{ranking.length?ranking.map((item,index)=><article className="world-leader-row" key={item.row.user_id}><span className={'world-place place-'+(index+1)}>{index+1}</span><div className="world-avatar">{(item.name.trim()[0]??'ک')}</div><div className="world-leader-name"><strong>{item.name}</strong><small>{item.username?'@'+item.username:(item.rank?.title??'عضو کاوه')}</small></div><span className="world-rank-pill">{item.rank?.title??'تازه‌وارد'}</span><b>{item.row.score.toLocaleString('fa-IR')} XP</b></article>) : <div className="world-empty"><Trophy size={24}/><strong>جدول رتبه‌بندی هنوز شکل نگرفته</strong><span>با تکمیل مأموریت‌ها اولین نفرات مشخص می‌شوند.</span></div>}</section>}
        {tab === 'honors' && <div className="world-section-grid"><div className="world-badge-grid">{badges.length?badges.map((badge)=><article className={'world-badge-card '+(myBadges.includes(badge.code)?'earned':'locked')} key={badge.code}><div><Award size={24}/></div><strong>{badge.title}</strong><p>{badge.description}</p><small>{myBadges.includes(badge.code)?'نشان دریافت شده':'هنوز دریافت نشده'}</small></article>):<div className="world-empty"><Medal size={24}/><strong>تالار افتخار در حال شکل‌گیری است</strong><span>نشان‌های ویژه به‌زودی اضافه می‌شوند.</span></div>}</div>{isAdmin&&<div className="world-admin-card"><form className="page-stack" onSubmit={createBadge}><div className="world-admin-title"><Plus size={18}/><strong>ساخت نشان جدید</strong></div><input className="field-input" value={badgeCode} onChange={(e)=>setBadgeCode(e.target.value)} placeholder="کد لاتین نشان" required/><input className="field-input" value={badgeTitle} onChange={(e)=>setBadgeTitle(e.target.value)} placeholder="عنوان نشان" required/><textarea className="field-input" value={badgeDescription} onChange={(e)=>setBadgeDescription(e.target.value)} placeholder="توضیح نشان" rows={2}/><button className="button button-primary" disabled={busy==='badge-create'}>ساخت نشان</button></form><form className="page-stack" onSubmit={handleAwardBadge}><div className="world-admin-title"><Award size={18}/><strong>اعطای نشان به کاربر</strong></div><input className="field-input" value={awardUser} onChange={(e)=>setAwardUser(e.target.value)} placeholder="شناسه UUID کاربر" required/><select className="field-input" value={selectedBadgeCode} onChange={(e)=>setSelectedBadgeCode(e.target.value)} required><option value="">انتخاب نشان</option>{badges.map((badge)=><option key={badge.code} value={badge.code}>{badge.title}</option>)}</select><button className="button button-primary" disabled={busy==='badge-award'}>اعطای نشان</button></form></div>}</div>}
      </>}
      <div className="world-refresh"><button className="button button-quiet" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={15}/> همگام‌سازی اطلاعات</button><span>امتیازها فقط با فعالیت واقعی ثبت‌شده در سرور افزایش می‌یابند.</span></div>
    </div>
  );
}

function ShieldIcon() { return <span aria-hidden="true">🛡️</span>; }
