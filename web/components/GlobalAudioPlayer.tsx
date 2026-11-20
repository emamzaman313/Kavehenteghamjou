'use client';

import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

type GlobalAudioRow = { track_id: string | null; enabled: boolean; volume: number; track?: { title: string; artist: string | null; audio_path: string } | null };

export default function GlobalAudioPlayer({ supabase }: { supabase: SupabaseClient }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [setting, setSetting] = useState<GlobalAudioRow | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const gesture = useRef<{ y: number; pointerId: number } | null>(null);
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    gesture.current = { y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const delta = event.clientY - start.y;
    if (delta > 44) setCollapsed(true);
    if (delta < -44) setCollapsed(false);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase.from('global_audio_settings').select('track_id,enabled,volume').eq('id', 1).maybeSingle();
      if (error || !active) return;
      if (!data?.track_id || !data.enabled) { setSetting(data ? { ...data, track: null } : null); setPlaying(false); setNeedsGesture(false); return; }
      const { data: track } = await supabase.from('audio_tracks').select('title,artist,audio_path').eq('id', data.track_id).eq('is_active', true).maybeSingle();
      if (!active) return;
      setSetting({ ...data, track: track ?? null });
    };
    void load();
    const channel = supabase.channel('global-audio-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_audio_settings', filter: 'id=eq.1' }, () => { void load(); })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [supabase]);

  const source = (() => {
    const storedPath = setting?.enabled ? setting.track?.audio_path : null;
    if (!storedPath) return '';
    const separator = storedPath.indexOf('::');
    const bucket = separator > 0 ? storedPath.slice(0, separator) : 'music-library';
    const objectPath = separator > 0 ? storedPath.slice(separator + 2) : storedPath;
    return supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
  })();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!source) { audio.pause(); audio.removeAttribute('src'); audio.load(); setPlaying(false); setNeedsGesture(false); return; }
    audio.volume = Math.min(1, Math.max(0, Number(setting?.volume ?? 0.35)));
    if (audio.src !== source) { audio.src = source; audio.loop = true; audio.load(); }
    void audio.play().then(() => { setPlaying(true); setNeedsGesture(false); }).catch(() => { setPlaying(false); setNeedsGesture(true); });
  }, [source, setting?.volume]);

  if (!source || !setting?.track) return null;
  const start = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try { await audio.play(); setPlaying(true); setNeedsGesture(false); }
    catch { setNeedsGesture(true); }
  };
  return <>
    {collapsed && <button type="button" className="global-audio-reopen" aria-label="نمایش دوبارهٔ پخش‌کنندهٔ موسیقی" onClick={() => setCollapsed(false)} onPointerDown={(event) => { gesture.current = { y: event.clientY, pointerId: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={(event) => { const start = gesture.current; gesture.current = null; if (start && event.clientY - start.y < -35) setCollapsed(false); }}>♫ <span>نمایش موسیقی</span></button>}
    <div className={`global-audio-dock ${collapsed ? 'is-collapsed' : ''}`} role="region" aria-label="موسیقی سراسری" aria-hidden={collapsed}>
      <div className="global-audio-grip" aria-label="برای پنهان‌کردن به پایین بکشید" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { gesture.current = null; }}><i/></div>
    <audio ref={audioRef} preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={(e) => { e.currentTarget.currentTime = 0; void e.currentTarget.play().catch(() => setNeedsGesture(true)); }}/>
    <span className="global-audio-disc">♫</span>
    <span className="global-audio-meta"><strong>{setting.track.title}</strong><small>{setting.track.artist || 'موسیقی سراسری کاوه'}</small></span>
    <button type="button" className="button button-quiet" onClick={() => { const a = audioRef.current; if (!a) return; if (a.paused) void start(); else a.pause(); }}>{playing ? 'توقف' : needsGesture ? 'برای شنیدن لمس کنید' : 'پخش'}</button>
    </div>
  </>;
}
