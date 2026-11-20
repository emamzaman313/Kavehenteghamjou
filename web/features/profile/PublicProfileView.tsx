'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, MessageCircle, Music2, Share2, UserPlus, UserCheck, Users } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Notify } from '@/lib/ui-types';
import { Avatar, SectionHeader } from '@/components/ui';
import RpgIcon from '@/components/RpgIcon';

type PublicProfile = {
  id: string; display_name: string | null; username: string | null; bio: string | null;
  avatar_url: string | null; avatar_path: string | null; cover_path: string | null;
  profile_visibility: 'public' | 'followers' | 'private' | null;
  profile_theme: { accent?: string; surface?: string; text?: string } | null;
  featured_badges: string[] | null; profile_music_path?: string | null; profile_music_title?: string | null;
};

export default function PublicProfileView({ supabase, viewerId, username, notify, onBack, onOpenChat, onlineUserIds = [] }: {
  supabase: SupabaseClient; viewerId: string; username: string; notify: Notify; onBack: () => void; onOpenChat: () => void; onlineUserIds?: string[];
}) {
  const [person, setPerson] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [pending, setPending] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [isFollower, setIsFollower] = useState(false);
  const [badgeIcons, setBadgeIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('profiles').select('id,display_name,username,bio,avatar_url,avatar_path,cover_path,profile_visibility,profile_theme,featured_badges,profile_music_path,profile_music_title').eq('username', username).maybeSingle();
      if (!alive) return;
      if (error || !data) { setPerson(null); setLoading(false); return; }
      const target = data as PublicProfile;
      setPerson(target);
      if (target.featured_badges?.length) {
        const { data: definitions } = await supabase.from('badges').select('code,icon_key').in('code', target.featured_badges.slice(0, 6));
        if (alive) setBadgeIcons(Object.fromEntries((definitions ?? []).map((badge) => [badge.code, badge.icon_key])));
      }
      const [{ count: followerCount }, { count: followingTotal }, { data: relation }] = await Promise.all([
        supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', target.id).eq('status', 'accepted'),
        supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', target.id).eq('status', 'accepted'),
        supabase.from('follows').select('status').eq('follower_id', viewerId).eq('following_id', target.id).maybeSingle(),
      ]);
      if (!alive) return;
      setFollowers(followerCount ?? 0); setFollowingCount(followingTotal ?? 0);
      setFollowing(relation?.status === 'accepted'); setPending(relation?.status === 'pending');
      if (viewerId !== target.id && target.profile_visibility === 'followers' && relation?.status === 'accepted') setIsFollower(true);
      setLoading(false);
    };
    void load();
    return () => { alive = false; };
  }, [supabase, username, viewerId]);

  const follow = async () => {
    if (!person || busy || person.id === viewerId) return;
    setBusy(true);
    const wasFollowing = following;
    const wasPending = pending;
    const nextStatus = person.profile_visibility === 'followers' ? 'pending' : 'accepted';
    const result = wasFollowing || wasPending
      ? await supabase.from('follows').delete().eq('follower_id', viewerId).eq('following_id', person.id)
      : await supabase.from('follows').upsert({ follower_id: viewerId, following_id: person.id, status: nextStatus }, { onConflict: 'follower_id,following_id' });
    setBusy(false);
    if (result.error) { notify('تغییر وضعیت دنبال‌کردن انجام نشد: ' + result.error.message, 'error'); return; }
    setFollowing(!wasFollowing && !wasPending && nextStatus === 'accepted');
    setPending(!wasFollowing && !wasPending && nextStatus === 'pending');
    if (wasFollowing) setFollowers(value => Math.max(0, value - 1));
    if (!wasFollowing && !wasPending && nextStatus === 'accepted') setFollowers(value => value + 1);
    notify(wasFollowing || wasPending ? 'دنبال‌کردن یا درخواست آن لغو شد.' : nextStatus === 'pending' ? 'درخواست دنبال‌کردن ارسال شد.' : 'اکنون این عضو را دنبال می‌کنی.');
  };

  const share = async () => {
    const url = window.location.origin + '/?profile=' + encodeURIComponent(username);
    try {
      if (navigator.share) await navigator.share({ title: 'پروفایل ' + (person?.display_name ?? username), url });
      else { await navigator.clipboard.writeText(url); notify('پیوند پروفایل کپی شد.'); }
    } catch { /* Sharing may be dismissed by the user. */ }
  };

  if (loading) return <section className="panel-card"><span className="spinner"/> در حال بارگذاری پروفایل…</section>;
  if (!person) return <section className="panel-card"><button className="button button-quiet" onClick={onBack}><ArrowRight size={16}/> بازگشت</button><h2>این پروفایل پیدا نشد</h2><p>نام کاربری ممکن است تغییر کرده باشد یا پروفایل در دسترس نباشد.</p></section>;
  const isOwner = person.id === viewerId;
  const privateLocked = !isOwner && person.profile_visibility === 'private';
  const followerLocked = !isOwner && person.profile_visibility === 'followers' && !isFollower;
  const canSeeDetails = !privateLocked && !followerLocked;
  const cover = person.cover_path ? supabase.storage.from('profile-media').getPublicUrl(person.cover_path).data.publicUrl : undefined;
  const avatar = person.avatar_url ?? (person.avatar_path ? supabase.storage.from('profile-media').getPublicUrl(person.avatar_path).data.publicUrl : null);
  const theme = person.profile_theme ?? {};
  const accent = theme.accent ?? '#168bff';
  return <div className="page-stack public-profile-page">
    <SectionHeader eyebrow="هویت عمومی" title="پروفایل عضو کاوه" description="صفحهٔ عمومی و ارتباط با اعضای جهان کاوه."/>
    <button className="button button-quiet public-profile-back" onClick={onBack}><ArrowRight size={16}/> بازگشت به فضای من</button>
    <section className="public-profile-card" style={{ '--public-accent': accent, '--public-surface': theme.surface ?? '#101b2c', '--public-text': theme.text ?? '#f4f1eb' } as React.CSSProperties}>
      <div className="public-profile-cover" style={cover ? { backgroundImage: 'linear-gradient(110deg,rgba(4,10,20,.18),rgba(4,10,20,.72)),url("' + cover + '")' } : undefined}><span> KAVEH MEMBER IDENTITY </span></div>
      <div className="public-profile-heading">
        <Avatar profile={{ display_name: person.display_name ?? 'کاربر کاوه', avatar_url: avatar }} size="lg"/>
        <div className="public-profile-name"><h2>{person.display_name || 'کاربر کاوه'} <BadgeCheck size={17}/></h2><span dir="ltr">@{person.username}</span><small style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:6,color:onlineUserIds.includes(person.id)?'#22c55e':'#94a3b8'}}><i style={{width:7,height:7,borderRadius:'50%',background:onlineUserIds.includes(person.id)?'#22c55e':'#94a3b8'}}/>{onlineUserIds.includes(person.id)?'آنلاین':'آفلاین'}</small></div>
        <div className="public-profile-actions">
          {!isOwner && <button className="button button-primary" disabled={busy} onClick={() => void follow()}>{following ? <><UserCheck size={16}/> لغو دنبال‌کردن</> : pending ? 'لغو درخواست' : <><UserPlus size={16}/> درخواست دنبال‌کردن</>}</button>}
          {!isOwner && <button className="button button-quiet" onClick={onOpenChat}><MessageCircle size={16}/> پیام</button>}
          <button className="button button-quiet" onClick={() => void share()}><Share2 size={16}/> اشتراک</button>
        </div>
      </div>
      <div className="public-profile-stats"><div><strong>{followers.toLocaleString('fa-IR')}</strong><span>دنبال‌کننده</span></div><div><strong>{followingCount.toLocaleString('fa-IR')}</strong><span>دنبال‌شونده</span></div><div><strong>{person.featured_badges?.length ?? 0}</strong><span>نشان منتخب</span></div></div>
      {!canSeeDetails ? <div className="public-profile-locked"><Users size={28}/><h3>{privateLocked ? 'این پروفایل خصوصی است' : 'این پروفایل مخصوص دنبال‌کنندگان تأییدشده است'}</h3><p>{privateLocked ? 'صاحب حساب نمایش اطلاعات عمومی را محدود کرده است.' : 'برای دیدن معرفی، نشان‌ها و موسیقی پروفایل باید درخواست دنبال‌کردن پذیرفته شود.'}</p></div> : <div className="public-profile-details">
        <p>{person.bio || 'این عضو هنوز معرفی کوتاهی ثبت نکرده است.'}</p>
        {person.featured_badges?.length ? <div className="public-profile-badges">{person.featured_badges.slice(0,6).map(code=><span key={code}><RpgIcon name={badgeIcons[code]} size={20}/> {code}</span>)}</div> : null}
        {person.profile_music_path ? <div className="public-profile-music"><Music2 size={17}/><div><strong>{person.profile_music_title || 'موسیقی پروفایل'}</strong><small>موسیقی منتخب این عضو</small></div><audio controls preload="none" src={supabase.storage.from('post-media').getPublicUrl(person.profile_music_path).data.publicUrl}/></div> : null}
      </div>}
    </section>
  </div>;
}
