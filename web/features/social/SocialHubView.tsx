'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Film, Music2, Megaphone, Heart, Plus, Upload, RefreshCw, Send } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Notify } from '@/lib/ui-types';
import { SectionHeader, EmptyState } from '@/components/ui';

type Reel = { id: string; author_id: string; caption: string; video_path: string; cover_path: string | null; mime_type: string; published_at: string; allow_comments: boolean; views_count: number };
type Track = { id: string; title: string; artist: string; audio_path: string; duration_seconds: number | null };
type DailyTitle = { id: string; title: string; body: string; category: string; starts_at: string; ends_at: string | null };
type Playlist = { id: string; owner_id: string; title: string; description: string; is_public: boolean };
type PlaylistTrack = { track: Track; position: number };
type ScheduledNotice = { id: string; title: string; body: string; scheduled_at: string; status: string };

export default function SocialHubView({ supabase, userId, isAdmin, notify }: { supabase: SupabaseClient; userId: string; isAdmin: boolean; notify: Notify }) {
  const [tab, setTab] = useState<'reels' | 'music' | 'daily'>('reels');
  const [reels, setReels] = useState<Reel[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [globalTrackId, setGlobalTrackId] = useState('');
  const [globalMusicEnabled, setGlobalMusicEnabled] = useState(false);
  const [titles, setTitles] = useState<DailyTitle[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [reelComments, setReelComments] = useState<Record<string, {id:string;author_id:string;body:string;created_at:string}[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string,string>>({});
  const [reportingReel, setReportingReel] = useState<string | null>(null);
  const [reelReportDetails, setReelReportDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState('');
  const [video, setVideo] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [audioUploadProgress, setAudioUploadProgress] = useState(0);
  const [reelUploadProgress, setReelUploadProgress] = useState(0);
  const [trackTitle, setTrackTitle] = useState('');
  const [trackArtist, setTrackArtist] = useState('');
  const [audio, setAudio] = useState<File | null>(null);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [playlistPublic, setPlaylistPublic] = useState(false);
  const [selectedPlaylistTracks, setSelectedPlaylistTracks] = useState<PlaylistTrack[]>([]);
  const [dailyTitle, setDailyTitle] = useState('');
  const [dailyBody, setDailyBody] = useState('');
  const [dailyCategory, setDailyCategory] = useState('announcement');
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleBody, setScheduleBody] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduled, setScheduled] = useState<ScheduledNotice[]>([]);
  const [dailySaving, setDailySaving] = useState(false);
  const viewedReelsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [r, t, d, p, likes, comments, scheduledRows] = await Promise.all([
      supabase.from('reels').select('id,author_id,caption,video_path,cover_path,mime_type,published_at,allow_comments,views_count').order('published_at', { ascending: false }).limit(40),
      supabase.from('audio_tracks').select('id,title,artist,audio_path,duration_seconds').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('daily_titles').select('id,title,body,category,starts_at,ends_at').eq('is_published', true).lte('starts_at', new Date().toISOString()).or('ends_at.is.null,ends_at.gt.' + new Date().toISOString()).order('starts_at', { ascending: false }).limit(30),
      supabase.from('playlists').select('id,owner_id,title,description,is_public').or(`owner_id.eq.${userId},is_public.eq.true`).order('created_at', { ascending: false }),
      supabase.from('reel_reactions').select('reel_id').eq('user_id', userId),
      supabase.from('reel_comments').select('id,reel_id,author_id,body,created_at').order('created_at', { ascending: true }).limit(120),
      isAdmin ? supabase.from('scheduled_notifications').select('id,title,body,scheduled_at,status').order('scheduled_at', { ascending: true }).limit(30) : Promise.resolve({data:[],error:null}),
    ]);
    if (r.error) notify('دریافت ریلز ناموفق بود: ' + r.error.message, 'error'); else setReels((r.data ?? []) as Reel[]);
    if (t.error) notify('دریافت موسیقی ناموفق بود: ' + t.error.message, 'error'); else setTracks((t.data ?? []) as Track[]);
    if (d.error) notify('دریافت اطلاعیه‌ها ناموفق بود: ' + d.error.message, 'error'); else setTitles((d.data ?? []) as DailyTitle[]);
    if (!p.error) setPlaylists((p.data ?? []) as Playlist[]);
    const { data: globalAudio } = await supabase.from('global_audio_settings').select('track_id,enabled').eq('id', 1).maybeSingle();
    if (globalAudio) { setGlobalTrackId(globalAudio.track_id ?? ''); setGlobalMusicEnabled(Boolean(globalAudio.enabled)); }
    if (!likes.error) setLiked(new Set((likes.data ?? []).map((x) => x.reel_id)));
    if (!comments.error) { const grouped: Record<string, {id:string;author_id:string;body:string;created_at:string}[]> = {}; for (const item of comments.data ?? []) (grouped[item.reel_id] ??= []).push(item); setReelComments(grouped); }
    if (!scheduledRows.error) setScheduled((scheduledRows.data ?? []) as ScheduledNotice[]);
    setLoading(false);
  }, [supabase, userId, isAdmin, notify]);

  useEffect(() => { void load(); }, [load]);

  const uploadWithProgress = (bucket: string, objectPath: string, file: File, onProgress: (percent: number) => void) => new Promise<{ error: Error | null }>((resolve) => {
    void supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token) return resolve({ error: new Error('نشست ورود معتبر نیست؛ دوباره وارد شوید.') });
      const xhr = new XMLHttpRequest();
      const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !supabaseKey) return resolve({ error: new Error('تنظیمات اتصال به فضای ذخیره‌سازی در دسترس نیست.') });
      xhr.open('POST', supabaseUrl + '/storage/v1/object/' + bucket + '/' + encodedPath);
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.setRequestHeader('apikey', supabaseKey);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.min(100, Math.round(event.loaded / event.total * 100))); };
      xhr.onerror = () => resolve({ error: new Error('ارتباط هنگام آپلود قطع شد.') });
      xhr.onabort = () => resolve({ error: new Error('آپلود لغو شد.') });
      xhr.onload = () => resolve({ error: xhr.status >= 200 && xhr.status < 300 ? null : new Error('خطای ذخیره‌سازی سرور (' + xhr.status + '): ' + xhr.responseText.slice(0, 220)) });
      xhr.send(file);
    }).catch(() => resolve({ error: new Error('دریافت نشست ناموفق بود.') }));
  });
  const uploadReel = async (event: FormEvent) => {
    event.preventDefault();
    if (!video || !video.type.startsWith('video/')) return notify('یک فایل ویدیویی معتبر انتخاب کنید.', 'error');
    if (video.size > 50 * 1024 * 1024) return notify('حداکثر حجم ویدئو ۵۰ مگابایت است.', 'error');
    setUploading(true);
    const path = userId + '/reels/' + crypto.randomUUID() + '-' + video.name.replace(/[^\w.\-]/g, '_');
    setReelUploadProgress(0);
    const uploaded = await uploadWithProgress('post-media', path, video, setReelUploadProgress);
    if (uploaded.error) { setUploading(false); return notify('بارگذاری ویدئو ناموفق بود: ' + uploaded.error.message, 'error'); }
    const inserted = await supabase.from('reels').insert({ author_id: userId, caption: caption.trim(), video_path: path, mime_type: video.type, visibility: 'public' });
    setUploading(false);
    if (inserted.error) {
      await supabase.storage.from('post-media').remove([path]);
      return notify('ثبت ریلز ناموفق بود: ' + inserted.error.message, 'error');
    }
    setCaption(''); setVideo(null); notify('ریلز منتشر شد.'); await load();
  };

  const toggleLike = async (reel: Reel) => {
    if (liked.has(reel.id)) {
      const { error } = await supabase.from('reel_reactions').delete().eq('reel_id', reel.id).eq('user_id', userId);
      if (error) return notify(error.message, 'error');
      setLiked((old) => { const next = new Set(old); next.delete(reel.id); return next; });
    } else {
      const { error } = await supabase.from('reel_reactions').insert({ reel_id: reel.id, user_id: userId, reaction: '❤️' });
      if (error) return notify(error.message, 'error');
      setLiked((old) => new Set(old).add(reel.id));
    }
  };

  const refreshPlaylistTracks = async (playlistId: string) => {
    if (!playlistId) { setSelectedPlaylistTracks([]); return; }
    const { data: rows, error } = await supabase.from('playlist_tracks')
      .select('track_id,position')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true });
    if (error) return notify('دریافت آهنگ‌های فهرست ناموفق بود: ' + error.message, 'error');
    const ids = (rows ?? []).map((row) => row.track_id);
    if (!ids.length) { setSelectedPlaylistTracks([]); return; }
    const { data: trackRows, error: trackError } = await supabase.from('audio_tracks')
      .select('id,title,artist,audio_path,duration_seconds')
      .in('id', ids)
      .eq('is_active', true);
    if (trackError) return notify('دریافت فایل‌های صوتی فهرست ناموفق بود: ' + trackError.message, 'error');
    const byId = new Map((trackRows ?? []).map((track) => [track.id, track as Track]));
    setSelectedPlaylistTracks((rows ?? []).flatMap((row) => {
      const track = byId.get(row.track_id);
      return track ? [{ track, position: row.position }] : [];
    }));
  };

  const createPlaylist = async (event: FormEvent) => {
    event.preventDefault();
    if (!playlistTitle.trim()) return;
    const isPublic = isAdmin && playlistPublic;
    const { data, error } = await supabase.from('playlists').insert({
      owner_id: userId,
      title: playlistTitle.trim(),
      is_public: isPublic,
    }).select('id,owner_id,title,description,is_public').single();
    if (error) return notify('ساخت فهرست پخش ناموفق بود: ' + error.message, 'error');
    setPlaylists((old) => [data as Playlist, ...old]);
    setPlaylistTitle('');
    setPlaylistPublic(false);
    setSelectedPlaylist(data.id);
    await refreshPlaylistTracks(data.id);
    notify(isPublic ? 'فهرست پخش عمومی ساخته شد و برای کاربران قابل مشاهده است.' : 'فهرست پخش خصوصی ساخته شد.');
  };

  const addTrackToPlaylist = async () => {
    if (!selectedPlaylist || !selectedTrack) return;
    const target = playlists.find((playlist) => playlist.id === selectedPlaylist);
    if (!target || target.owner_id !== userId) return notify('فقط سازنده فهرست می‌تواند آهنگ به آن اضافه کند.', 'error');
    const nextPosition = selectedPlaylistTracks.reduce((max, item) => Math.max(max, item.position), -1) + 1;
    const { error } = await supabase.from('playlist_tracks').insert({
      playlist_id: selectedPlaylist,
      track_id: selectedTrack,
      position: nextPosition,
    });
    if (error) return notify('افزودن آهنگ ناموفق بود: ' + error.message, 'error');
    await refreshPlaylistTracks(selectedPlaylist);
    notify('آهنگ به فهرست پخش اضافه شد.');
  };

  const removeTrackFromPlaylist = async (trackId: string) => {
    const target = playlists.find((playlist) => playlist.id === selectedPlaylist);
    if (!target || target.owner_id !== userId) return notify('فقط سازنده فهرست می‌تواند آهنگ حذف کند.', 'error');
    const { error } = await supabase.from('playlist_tracks').delete()
      .eq('playlist_id', selectedPlaylist)
      .eq('track_id', trackId);
    if (error) return notify('حذف آهنگ از فهرست ناموفق بود: ' + error.message, 'error');
    await refreshPlaylistTracks(selectedPlaylist);
    notify('آهنگ از فهرست پخش حذف شد.');
  };

  const uploadTrack = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAdmin) return;
    if (!audio) return notify('ابتدا فایل موسیقی را از گوشی یا دستگاه انتخاب کنید.', 'error');
    if (audio.size > 100 * 1024 * 1024) return notify('حداکثر حجم فایل موسیقی ۱۰۰ مگابایت است.', 'error');
    setUploading(true);
    const path = userId + '/audio/' + crypto.randomUUID() + '-' + audio.name.replace(/[^\w.\-]/g, '_');
    setAudioUploadProgress(0);
    const uploaded = await uploadWithProgress('music-library', path, audio, setAudioUploadProgress);
    if (uploaded.error) { setUploading(false); setAudioUploadProgress(0); return notify(uploaded.error.message, 'error'); }
    const inserted = await supabase.from('audio_tracks').insert({ title: trackTitle.trim(), artist: trackArtist.trim(), audio_path: path, created_by: userId }).select('id,title,artist,audio_path,duration_seconds').single();
    setUploading(false); setAudioUploadProgress(0);
    if (inserted.error) { await supabase.storage.from('music-library').remove([path]); return notify(inserted.error.message, 'error'); }
    setTracks((old) => [inserted.data as Track, ...old]); setTrackTitle(''); setTrackArtist(''); setAudio(null); notify('آهنگ به کتابخانه موسیقی اضافه شد.');
  };

  const publishGlobalMusic = async () => {
    if (!isAdmin || !globalTrackId) return notify('ابتدا یک آهنگ انتخاب کنید.', 'error');
    const { error } = await supabase.from('global_audio_settings').update({ track_id: globalTrackId, enabled: true, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) return notify('انتشار موسیقی سراسری ناموفق بود: ' + error.message, 'error');
    setGlobalMusicEnabled(true); notify('موسیقی سراسری برای سایت و برنامه منتشر شد.');
  };
  const disableGlobalMusic = async () => {
    if (!isAdmin) return;
    const { error } = await supabase.from('global_audio_settings').update({ enabled: false, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) return notify('توقف موسیقی سراسری ناموفق بود: ' + error.message, 'error');
    setGlobalMusicEnabled(false); notify('موسیقی سراسری متوقف شد.');
  };

  const publishDailyTitle = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAdmin || !dailyTitle.trim()) return;
    setDailySaving(true);
    const { error } = await supabase.from('daily_titles').insert({ title: dailyTitle.trim(), body: dailyBody.trim(), category: dailyCategory, is_published: true, created_by: userId });
    setDailySaving(false);
    if (error) return notify('انتشار اطلاعیه ناموفق بود: ' + error.message, 'error');
    setDailyTitle(''); setDailyBody(''); notify('اطلاعیه منتشر شد.'); await load();
  };

  const addReelComment = async (reelId: string) => {
    const body = (commentDrafts[reelId] ?? '').trim();
    if (!body) return;
    const { data, error } = await supabase.from('reel_comments').insert({ reel_id: reelId, author_id: userId, body }).select('id,author_id,body,created_at').single();
    if (error) return notify('ارسال دیدگاه ناموفق بود: ' + error.message, 'error');
    setReelComments((old) => ({ ...old, [reelId]: [...(old[reelId] ?? []), data as {id:string;author_id:string;body:string;created_at:string}] }));
    setCommentDrafts((old) => ({ ...old, [reelId]: '' }));
  };
  const submitReelReport = async (reelId: string) => {
    const details = reelReportDetails.trim();
    const { data: existing, error: lookupError } = await supabase.from('reports').select('id').eq('reporter_id', userId).eq('target_type', 'reel').eq('target_id', reelId).in('status', ['open','reviewing']).limit(1).maybeSingle();
    if (lookupError) return notify('بررسی گزارش قبلی ناموفق بود.', 'error');
    if (existing) { setReportingReel(null); return notify('برای این ریلز گزارش باز دارید.', 'error'); }
    const { error } = await supabase.from('reports').insert({ reporter_id: userId, target_type: 'reel', target_id: reelId, reason: 'گزارش ریلز نامناسب', details: details || null, status: 'open' });
    if (error) return notify('ارسال گزارش ریلز ناموفق بود: ' + error.message, 'error');
    setReportingReel(null); setReelReportDetails(''); notify('گزارش ریلز برای بررسی مدیران ارسال شد.');
  };
  const recordReelView = useCallback(async (reelId: string) => {
    const { error } = await supabase.from('reel_views').insert({ reel_id: reelId, viewer_id: userId });
    if (error && !/duplicate|unique/i.test(error.message)) notify('ثبت بازدید انجام نشد.', 'error');
  }, [supabase, userId, notify]);
  // Reels behave like a real vertical short-video feed: only the visible
  // item plays, and each viewer is recorded once per page session.
  useEffect(() => {
    if (tab !== 'reels' || reels.length === 0) return;
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('[data-reel-video]'));
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement;
        const reelId = video.dataset.reelId;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
          void video.play().catch(() => undefined);
          if (reelId && !viewedReelsRef.current.has(reelId)) {
            viewedReelsRef.current.add(reelId);
            void recordReelView(reelId);
          }
        } else {
          video.pause();
        }
      }
    }, { threshold: [0, 0.35, 0.65, 0.9] });
    videos.forEach((video) => observer.observe(video));
    return () => {
      observer.disconnect();
      videos.forEach((video) => video.pause());
    };
  }, [tab, reels, recordReelView]);

  const queueScheduledNotice = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAdmin || !scheduleTitle.trim() || !scheduleBody.trim() || !scheduleAt) return;
    const when = new Date(scheduleAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) return notify('زمان ارسال باید در آینده باشد.', 'error');
    const { data, error } = await supabase.from('scheduled_notifications').insert({
      title: scheduleTitle.trim(), body: scheduleBody.trim(), audience: 'all',
      scheduled_at: when.toISOString(), created_by: userId, status: 'pending',
    }).select('id,title,body,scheduled_at,status').single();
    if (error) return notify('ثبت اعلان زمان‌بندی‌شده ناموفق بود: ' + error.message, 'error');
    setScheduled((old) => [...old, data as ScheduledNotice].sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at)));
    setScheduleTitle(''); setScheduleBody(''); setScheduleAt('');
    notify('اعلان در صف ثبت شد و زمان‌بند دیتابیس آن را پس از موعد به‌صورت خودکار ارسال می‌کند.');
  };
  const cancelScheduledNotice = async (id: string) => {
    const { error } = await supabase.from('scheduled_notifications').update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending');
    if (error) return notify('لغو اعلان ناموفق بود: ' + error.message, 'error');
    setScheduled((old) => old.map((item) => item.id === id ? {...item, status:'cancelled'} : item));
  };
  const publicUrl = (path: string) => supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl;
  const audioPublicUrl = (path: string) => supabase.storage.from('music-library').getPublicUrl(path).data.publicUrl;

  return <div className="page-stack">
    <SectionHeader eyebrow="رسانه و جامعه" title="رسانه، ریلز و موسیقی" description="ویدئوهای کوتاه، کتابخانه موسیقی، فهرست‌های پخش و عنوان‌های روزانه." action={<button className="button button-quiet" onClick={() => void load()}><RefreshCw size={16}/> تازه‌سازی</button>}/>
    <div className="admin-tabs">
      <button className={tab === 'reels' ? 'active' : ''} onClick={() => setTab('reels')}><Film size={16}/> ریلز</button>
      <button className={tab === 'music' ? 'active' : ''} onClick={() => setTab('music')}><Music2 size={16}/> موسیقی</button>
      <button className={tab === 'daily' ? 'active' : ''} onClick={() => setTab('daily')}><Megaphone size={16}/> عنوان روزانه و اطلاعیه‌ها</button>
    </div>
    {loading ? <div className="skeleton-list"><div className="skeleton-card"/><div className="skeleton-card"/></div> : null}
    {tab === 'reels' && <>
      <form className="panel-card page-stack" onSubmit={uploadReel}>
        <strong>انتشار ریلز جدید</strong>
        <textarea className="field-input" rows={2} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="برای ویدئوی خود توضیح بنویس…"/>
        <input type="file" accept="video/*" onChange={(e: ChangeEvent<HTMLInputElement>) => setVideo(e.target.files?.[0] ?? null)}/>
        {uploading && tab === 'reels' && <div className="upload-progress-card upload-progress-reel"><div className="upload-progress-head"><span>آپلود ویدئو</span><strong>{reelUploadProgress}٪</strong></div><div className="upload-progress-track"><i style={{ width: reelUploadProgress + '%' }}/></div></div>}<button className="button button-primary" disabled={uploading || !video}><Upload size={16}/>{uploading ? 'در حال بارگذاری…' : 'انتشار ریلز'}</button>
      </form>
      {reels.length === 0 ? <EmptyState icon={<Film/>} title="هنوز ریلزی منتشر نشده" description="اولین ویدئوی کوتاه را منتشر کن."/> : <div className="reel-feed" style={{ maxHeight: '78vh', overflowY: 'auto', scrollSnapType: 'y mandatory', overscrollBehaviorY: 'contain', display: 'grid', gap: 16 }}>{reels.map((reel) => <article className="person-card reel-card" key={reel.id} style={{ scrollSnapAlign: 'start' }}><video data-reel-video data-reel-id={reel.id} controls autoPlay muted loop playsInline preload="metadata" src={publicUrl(reel.video_path)} className="post-media-video" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', background: '#080808', borderRadius: 12 }}/><p>{reel.caption}</p><small>{reel.views_count ?? 0} بازدید · {(reelComments[reel.id] ?? []).length} دیدگاه</small><div className="post-actions"><button className={liked.has(reel.id) ? 'is-liked' : ''} onClick={() => void toggleLike(reel)}><Heart size={15} fill={liked.has(reel.id) ? 'currentColor' : 'none'}/> {liked.has(reel.id) ? 'پسندیده شد' : 'پسندیدن'}</button><button onClick={() => {setReportingReel(reportingReel === reel.id ? null : reel.id); setReelReportDetails('');}}>گزارش</button></div>{reportingReel === reel.id && <div className="post-report-form"><textarea className="field-input" value={reelReportDetails} onChange={(e) => setReelReportDetails(e.target.value)} maxLength={500} rows={2} placeholder="توضیحات گزارش (اختیاری)"/><div><button className="button button-quiet" onClick={() => setReportingReel(null)}>انصراف</button><button className="button button-primary" onClick={() => void submitReelReport(reel.id)}>ارسال گزارش</button></div></div>}{(reelComments[reel.id] ?? []).map((comment) => <p key={comment.id} className="comment-row">{comment.body}</p>)}{reel.allow_comments && <div className="inline-form"><input className="field-input" value={commentDrafts[reel.id] ?? ''} onChange={(e) => setCommentDrafts((old) => ({...old, [reel.id]: e.target.value}))} placeholder="دیدگاه بنویس…"/><button className="button button-quiet" onClick={() => void addReelComment(reel.id)}><Send size={15}/> ارسال</button></div>}</article>)}</div>}
    </>}
    {tab === 'music' && <>
      {isAdmin && <section className="panel-card page-stack"><strong>موسیقی سراسری کل پلتفرم</strong><p>این آهنگ پس از انتشار، به‌عنوان موسیقی زمینه در وب و نسخه‌های موبایل معرفی می‌شود. شروع پخش در مرورگر ممکن است به لمس دکمه پخش توسط کاربر نیاز داشته باشد.</p><form className="page-stack" onSubmit={uploadTrack}><input className="field-input" value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)} placeholder="نام موسیقی" required/><input className="field-input" value={trackArtist} onChange={(e) => setTrackArtist(e.target.value)} placeholder="نام هنرمند (اختیاری)"/><input type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.wma,.aiff,.mid,.midi,.amr" onChange={(e) => setAudio(e.target.files?.[0] ?? null)}/>{audio && <small>فایل انتخاب‌شده: {audio.name} · {(audio.size / 1048576).toFixed(1)} MB</small>}{uploading && tab === 'music' && <div className="upload-progress-card upload-progress-audio"><div className="upload-progress-head"><span>انتقال موسیقی به سرور</span><strong>{audioUploadProgress}٪</strong></div><div className="upload-progress-orbit"><i style={{ '--progress': audioUploadProgress } as React.CSSProperties}/><b>{audioUploadProgress}٪</b></div><div className="upload-progress-track"><i style={{ width: audioUploadProgress + '%' }}/></div><small>درصد واقعی داده ارسال‌شده به Storage</small></div>}<button className="button button-primary" disabled={uploading || !audio || !trackTitle.trim()}><Upload size={16}/>{uploading ? 'در حال آپلود…' : 'آپلود موسیقی به سرور'}</button></form><div className="page-stack"><label>انتخاب آهنگ سراسری</label><select className="field-input" value={globalTrackId} onChange={(e) => setGlobalTrackId(e.target.value)}><option value="">یک آهنگ را انتخاب کنید</option>{tracks.map((track) => <option key={track.id} value={track.id}>{track.title} — {track.artist || 'بدون نام هنرمند'}</option>)}</select><div className="inline-form"><button className="button button-primary" onClick={() => void publishGlobalMusic()} disabled={!globalTrackId}>انتشار برای همه</button><button className="button button-quiet" onClick={() => void disableGlobalMusic()} disabled={!globalMusicEnabled}>توقف موسیقی سراسری</button></div><small>وضعیت فعلی: {globalMusicEnabled ? 'فعال' : 'غیرفعال'}</small></div></section>}
      <section className="panel-card page-stack">
        <strong>فهرست‌های پخش</strong>
        <form onSubmit={createPlaylist} className="page-stack">
          <input className="field-input" value={playlistTitle} onChange={(e) => setPlaylistTitle(e.target.value)} placeholder="نام فهرست پخش" required/>
          {isAdmin && <label className="setting-choice" style={{ justifyContent: 'flex-start', gap: 10 }}>
            <input type="checkbox" checked={playlistPublic} onChange={(e) => setPlaylistPublic(e.target.checked)}/>
            <span>انتشار به‌عنوان فهرست موسیقی عمومی برای همه کاربران</span>
          </label>}
          <button className="button button-primary"><Plus size={16}/> ساخت فهرست</button>
        </form>
        {playlists.length > 0 && <>
          <select className="field-input" value={selectedPlaylist} onChange={(e) => { setSelectedPlaylist(e.target.value); void refreshPlaylistTracks(e.target.value); }}>
            <option value="">فهرست پخش را انتخاب کن</option>
            {playlists.map((p) => <option key={p.id} value={p.id}>{p.title}{p.is_public ? ' · عمومی' : ' · خصوصی'}</option>)}
          </select>
          {selectedPlaylist && playlists.find((p) => p.id === selectedPlaylist)?.owner_id === userId && <div className="inline-form">
            <select className="field-input" value={selectedTrack} onChange={(e) => setSelectedTrack(e.target.value)}>
              <option value="">آهنگ را انتخاب کن</option>
              {tracks.map((t) => <option key={t.id} value={t.id}>{t.title} — {t.artist}</option>)}
            </select>
            <button type="button" className="button button-quiet" onClick={() => void addTrackToPlaylist()} disabled={!selectedPlaylist || !selectedTrack}>افزودن به فهرست</button>
          </div>}
          {selectedPlaylist && playlists.find((p) => p.id === selectedPlaylist)?.owner_id !== userId && <p className="admin-user-policy-note">این فهرست عمومی متعلق به مدیر یا کاربر دیگری است؛ می‌توانی آهنگ‌های منتشرشده‌اش را پخش کنی، اما ویرایش آن فقط برای سازنده مجاز است.</p>}
          {selectedPlaylist && <div className="page-stack">
            <strong>آهنگ‌های این فهرست ({selectedPlaylistTracks.length})</strong>
            {selectedPlaylistTracks.length === 0 ? <p>هنوز آهنگی به این فهرست اضافه نشده است.</p> : selectedPlaylistTracks.map((item) => <div className="file-row" key={item.track.id}>
              <div><strong>{item.track.title}</strong><small>{item.track.artist || 'هنرمند نامشخص'}</small></div>
              <audio controls preload="none" src={audioPublicUrl(item.track.audio_path)}/>
              {playlists.find((p) => p.id === selectedPlaylist)?.owner_id === userId && <button type="button" className="button button-quiet" onClick={() => void removeTrackFromPlaylist(item.track.id)}>حذف از فهرست</button>}
            </div>)}
          </div>}
        </>}
      </section>
      {tracks.length === 0 ? <EmptyState icon={<Music2/>} title="کتابخانه موسیقی خالی است" description="مدیر سایت می‌تواند آهنگ‌های مجاز را اضافه کند."/> : <div className="panel-card page-stack"><strong>کتابخانه موسیقی</strong>{tracks.map((track) => <div className="file-row" key={track.id}><div><strong>{track.title}</strong><small>{track.artist || 'هنرمند نامشخص'}</small></div><audio controls preload="none" src={audioPublicUrl(track.audio_path)}/></div>)}</div>}
    </>}
    {tab === 'daily' && <>
      {isAdmin && <form className="panel-card page-stack" onSubmit={publishDailyTitle}><strong>انتشار عنوان یا اطلاعیه جدید</strong><input className="field-input" value={dailyTitle} onChange={(e) => setDailyTitle(e.target.value)} maxLength={180} placeholder="عنوان" required/><textarea className="field-input" rows={3} value={dailyBody} onChange={(e) => setDailyBody(e.target.value)} maxLength={5000} placeholder="متن اطلاعیه"/><select className="field-input" value={dailyCategory} onChange={(e) => setDailyCategory(e.target.value)}><option value="announcement">اطلاعیه</option><option value="daily_title">عنوان روزانه</option><option value="maintenance">تعمیر و نگهداری</option><option value="event">رویداد</option></select><button className="button button-primary" disabled={dailySaving}><Megaphone size={16}/>{dailySaving ? 'در حال انتشار…' : 'انتشار'}</button></form>}
      {isAdmin && <section className="panel-card page-stack"><strong>اعلان زمان‌بندی‌شده</strong><form className="page-stack" onSubmit={queueScheduledNotice}><input className="field-input" value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} placeholder="عنوان اعلان" maxLength={180} required/><textarea className="field-input" rows={2} value={scheduleBody} onChange={(e) => setScheduleBody(e.target.value)} placeholder="متن اعلان" maxLength={5000} required/><label>زمان ارسال <input className="field-input" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} required/></label><button className="button button-primary"><Megaphone size={16}/> ثبت در صف</button></form><small>صف هر دقیقه توسط زمان‌بند دیتابیس پردازش می‌شود و اعلان درون‌برنامه‌ای خودکار است؛ Push و ایمیل به سرویس و کلیدهای جداگانه نیاز دارند.</small>{scheduled.map((item) => <div className="file-row" key={item.id}><div><strong>{item.title}</strong><small>{new Date(item.scheduled_at).toLocaleString('fa-IR')} · {item.status}</small></div>{item.status === 'pending' && <button className="button button-quiet button-small" onClick={() => void cancelScheduledNotice(item.id)}>لغو</button>}</div>)}</section>}
      {titles.length === 0 ? <EmptyState icon={<Megaphone/>} title="اطلاعیه‌ای منتشر نشده" description="عنوان‌های روزانه و خبرهای مهم اینجا نمایش داده می‌شوند."/> : titles.map((item) => <article className="panel-card page-stack" key={item.id}><small>{item.category === 'daily_title' ? 'عنوان روزانه' : item.category === 'maintenance' ? 'تعمیر و نگهداری' : item.category === 'event' ? 'رویداد' : 'اطلاعیه'}</small><h3>{item.title}</h3>{item.body && <p>{item.body}</p>}<small>{new Date(item.starts_at).toLocaleString('fa-IR')}</small></article>)}
    </>}
  </div>;
}
