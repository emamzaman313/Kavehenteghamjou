'use client';
import { Compass, MessageCircle, Search, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types';
import type { Notify } from '@/lib/ui-types';
import { Avatar, EmptyState, SectionHeader } from '@/components/ui';

type Community = { conversation_id: string; title: string; description: string; kind: string; username: string | null; owner_id: string; join_approval_required: boolean; member_count: number; membership: string };

export default function DiscoverView({ supabase, userId, initialSearch, notify, onOpenChat }: { supabase: SupabaseClient; userId: string; initialSearch: string; notify: Notify; onOpenChat: () => void }) {
  const [query, setQuery] = useState(initialSearch);
  const [people, setPeople] = useState<Profile[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [recommendations, setRecommendations] = useState<{ profile: Profile; score: number; rank: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [followStatusByUser, setFollowStatusByUser] = useState<Record<string, string>>({});
  const [followBusy, setFollowBusy] = useState<string | null>(null);

  const loadCommunities = async () => {
    const { data, error } = await supabase.rpc('discover_communities');
    if (error) { notify('دریافت گروه‌ها و کانال‌ها ناموفق بود: ' + error.message, 'error'); return; }
    const [{ data: mine }, { data: requests }] = await Promise.all([
      supabase.from('conversation_members').select('conversation_id').eq('user_id', userId),
      supabase.from('conversation_join_requests').select('conversation_id').eq('requester_id', userId).eq('status', 'pending'),
    ]);
    const memberIds = new Set((mine ?? []).map((row) => row.conversation_id));
    const pendingIds = new Set((requests ?? []).map((row) => row.conversation_id));
    setCommunities((data ?? []).map((item: Omit<Community, 'membership'>) => ({ ...item, membership: memberIds.has(item.conversation_id) ? 'member' : pendingIds.has(item.conversation_id) ? 'pending' : 'none' })));
  };

  useEffect(() => { void loadCommunities(); }, [supabase, userId]);

  useEffect(() => {
    let alive = true;
    const loadActiveMembers = async () => {
      const [{ data: scores, error: scoreError }, { data: rankLevels, error: rankError }] = await Promise.all([
        supabase.from('user_rank_state').select('user_id,score,rank_code').neq('user_id', userId).order('score', { ascending: false }).limit(8),
        supabase.from('rank_levels').select('code,title,min_score').order('min_score', { ascending: true }),
      ]);
      if (!alive) return;
      if (scoreError || rankError) { notify('دریافت پیشنهاد اعضای فعال ناموفق بود.', 'error'); return; }
      const ids = (scores ?? []).map((row) => row.user_id);
      if (!ids.length) { setRecommendations([]); return; }
      const [{ data: profiles, error: profileError }, { data: follows, error: followsError }] = await Promise.all([
        supabase.from('profiles').select('*').in('id', ids),
        supabase.from('follows').select('following_id,status').eq('follower_id', userId).in('following_id', ids),
      ]);
      if (!alive) return;
      if (profileError || followsError) { notify('دریافت اطلاعات اعضای فعال ناموفق بود.', 'error'); return; }
      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile as Profile]));
      const levelMap = new Map((rankLevels ?? []).map((level) => [level.code, level.title]));
      setRecommendations((scores ?? []).flatMap((row) => {
        const profile = profileMap.get(row.user_id);
        return profile ? [{ profile, score: Number(row.score ?? 0), rank: levelMap.get(row.rank_code) ?? 'تازه‌وارد' }] : [];
      }));
      setFollowStatusByUser((current) => ({ ...current, ...Object.fromEntries((follows ?? []).map((row) => [row.following_id, row.status])) }));
    };
    void loadActiveMembers();
    return () => { alive = false; };
  }, [supabase, userId, notify]);

  const joinCommunity = async (id: string) => {
    setJoining(id);
    const { data, error } = await supabase.rpc('join_community', { p_conversation_id: id });
    setJoining(null);
    if (error) return notify('عضویت ناموفق بود: ' + error.message, 'error');
    setCommunities((old) => old.map((item) => item.conversation_id === id ? { ...item, membership: data === 'pending' ? 'pending' : 'member' } : item));
    notify(data === 'pending' ? 'درخواست عضویت برای مدیر گروه ارسال شد.' : data === 'member' ? 'از قبل عضو این فضا هستید.' : 'به کانال یا گروه پیوستید.');
  };

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    const safe = query.trim().replace(/[,%()]/g, '');
    const { data, error } = await supabase.from('profiles').select('*').or('username.ilike.%' + safe + '%,display_name.ilike.%' + safe + '%').neq('id', userId).limit(24);
    if (error) notify(error.message, 'error'); else {
      const results = (data ?? []) as Profile[];
      setPeople(results);
      const ids = results.map((person) => person.id);
      if (ids.length) {
        const { data: follows, error: followError } = await supabase.from('follows')
          .select('following_id,status').eq('follower_id', userId).in('following_id', ids);
        if (followError) notify('دریافت وضعیت دنبال‌کردن ناموفق بود: ' + followError.message, 'error');
        else setFollowStatusByUser(Object.fromEntries((follows ?? []).map((row) => [row.following_id, row.status])));
      } else setFollowStatusByUser({});
    }
    setLoading(false);
  };

  useEffect(() => {
    if (initialSearch.trim().length < 2) return;
    setQuery(initialSearch);
    const safe = initialSearch.trim().replace(/[,%()]/g, '');
    let alive = true;
    void supabase.from('profiles').select('*').or('username.ilike.%' + safe + '%,display_name.ilike.%' + safe + '%').neq('id', userId).limit(24).then(async ({ data, error }) => {
      if (!alive) return;
      if (error) notify(error.message, 'error'); else {
        const results = (data ?? []) as Profile[];
        setPeople(results);
        const ids = results.map((person) => person.id);
        if (ids.length) {
          const { data: follows, error: followError } = await supabase.from('follows')
            .select('following_id,status').eq('follower_id', userId).in('following_id', ids);
          if (!alive) return;
          if (followError) notify('دریافت وضعیت دنبال‌کردن ناموفق بود: ' + followError.message, 'error');
          else setFollowStatusByUser(Object.fromEntries((follows ?? []).map((row) => [row.following_id, row.status])));
        } else setFollowStatusByUser({});
      }
    });
    return () => { alive = false; };
  }, [initialSearch, supabase, userId, notify]);

  const follow = async (id: string) => {
    setFollowBusy(id);
    const current = followStatusByUser[id];
    const result = current
      ? await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', id)
      : await supabase.from('follows').insert({ follower_id: userId, following_id: id, status: 'pending' });
    setFollowBusy(null);
    if (result.error) notify(result.error.message, 'error');
    else {
      setFollowStatusByUser((old) => {
        const next = { ...old };
        if (current) delete next[id]; else next[id] = 'pending';
        return next;
      });
      notify(current ? 'درخواست یا دنبال‌کردن لغو شد.' : 'درخواست دنبال‌کردن ارسال شد.');
    }
  };
  const startChat = async (id: string) => {
    const { error } = await supabase.rpc('create_direct_conversation', { p_other_user_id: id });
    if (error) notify(error.message, 'error'); else { notify('گفتگو آماده است.'); onOpenChat(); }
  };

  return <div className="page-stack">
    <SectionHeader eyebrow="جامعهٔ کاوه" title="اکتشاف" description="کاربران، گروه‌ها و کانال‌های عمومی را پیدا کن."/>
    <form className="discover-search" onSubmit={search}>
      <Search size={20}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="نام نمایشی یا نام کاربری را جست‌وجو کن…"/>
      <button className="button button-primary" disabled={loading || query.trim().length < 2}>{loading ? 'جست‌وجو…' : 'جست‌وجو'}</button>
    </form>
    {people.length ? <div className="people-grid">{people.map((p) => <article className="person-card" key={p.id}>
      <Avatar profile={p} size="lg"/><strong>{p.display_name}</strong><span>@{p.username ?? 'بدون نام کاربری'}</span>
      <p>{p.bio || 'هنوز توضیحی برای این پروفایل ثبت نشده است.'}</p>
      <div><button className="button button-primary button-small" onClick={() => void startChat(p.id)}><MessageCircle size={15}/> گفتگو</button><button className="button button-quiet button-small" disabled={followBusy === p.id} onClick={() => void follow(p.id)}>{followBusy === p.id ? 'در حال ثبت…' : followStatusByUser[p.id] === 'accepted' ? 'لغو دنبال‌کردن' : followStatusByUser[p.id] === 'pending' ? 'لغو درخواست' : 'درخواست دنبال‌کردن'}</button></div>
    </article>)}</div> : <EmptyState icon={<Compass/>} title="کسی پیدا نشد" description="برای شروع، نام یا نام کاربری را جست‌وجو کن."/>}
    {recommendations.length > 0 && <section className="page-stack">
      <h3><Users size={18}/> اعضای فعال جامعه</h3>
      <div className="people-grid">{recommendations.map((item) => <article className="person-card recommended-person" key={item.profile.id}>
        <Avatar profile={item.profile} size="lg"/><strong>{item.profile.display_name}</strong><span>@{item.profile.username ?? 'بدون نام کاربری'}</span>
        <p>{item.rank} · {item.score.toLocaleString('fa-IR')} امتیاز</p>
        <div><button className="button button-primary button-small" onClick={() => void startChat(item.profile.id)}><MessageCircle size={15}/> گفتگو</button><button className="button button-quiet button-small" disabled={followBusy === item.profile.id} onClick={() => void follow(item.profile.id)}>{followBusy === item.profile.id ? 'در حال ثبت…' : followStatusByUser[item.profile.id] === 'accepted' ? 'دنبال می‌کنی' : followStatusByUser[item.profile.id] === 'pending' ? 'در انتظار' : 'دنبال‌کردن'}</button></div>
      </article>)}</div>
    </section>}
    <section className="page-stack">
      <h3><Users size={18}/> گروه‌ها و کانال‌های قابل پیوستن</h3>
      {communities.length === 0 ? <EmptyState icon={<Compass/>} title="فضای عمومی‌ای پیدا نشد" description="گروه‌ها و کانال‌های عمومی اینجا نمایش داده می‌شوند."/> : <div className="people-grid">{communities.map((item) => <article className="person-card" key={item.conversation_id}>
        <strong>{item.title}</strong><span>{item.kind === 'channel' ? 'کانال' : 'گروه'}{item.username ? ' · @' + item.username : ''}</span>
        <p>{item.description || 'بدون توضیحات'}</p><small>{item.member_count} عضو</small>
        {item.membership === 'member' ? <span className="status-line">عضو هستید</span> : item.membership === 'pending' ? <span className="status-line">درخواست ارسال شده</span> : <button className="button button-primary button-small" disabled={joining === item.conversation_id} onClick={() => void joinCommunity(item.conversation_id)}>{joining === item.conversation_id ? 'در حال ارسال…' : item.join_approval_required ? 'درخواست عضویت' : 'پیوستن'}</button>}
      </article>)}</div>}
    </section>
  </div>;
}
