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
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

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
    if (error) notify(error.message, 'error'); else setPeople((data ?? []) as Profile[]);
    setLoading(false);
  };

  useEffect(() => {
    if (initialSearch.trim().length < 2) return;
    setQuery(initialSearch);
    const safe = initialSearch.trim().replace(/[,%()]/g, '');
    let alive = true;
    void supabase.from('profiles').select('*').or('username.ilike.%' + safe + '%,display_name.ilike.%' + safe + '%').neq('id', userId).limit(24).then(({ data, error }) => {
      if (!alive) return;
      if (error) notify(error.message, 'error'); else setPeople((data ?? []) as Profile[]);
    });
    return () => { alive = false; };
  }, [initialSearch, supabase, userId, notify]);

  const follow = async (id: string) => {
    const { error } = await supabase.from('follows').insert({ follower_id: userId, following_id: id, status: 'accepted' });
    if (error) notify(error.message, 'error'); else notify('دنبال‌کردن انجام شد.');
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
      <div><button className="button button-primary button-small" onClick={() => void startChat(p.id)}><MessageCircle size={15}/> گفتگو</button><button className="button button-quiet button-small" onClick={() => void follow(p.id)}>دنبال‌کردن</button></div>
    </article>)}</div> : <EmptyState icon={<Compass/>} title="کسی پیدا نشد" description="برای شروع، نام یا نام کاربری را جست‌وجو کن."/>}
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
