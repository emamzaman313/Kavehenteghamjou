'use client';
import { Compass, MessageCircle, Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types';
import type { Notify } from '@/lib/ui-types';
import { Avatar, EmptyState, SectionHeader } from '@/components/ui';

export default function DiscoverView({ supabase, userId, initialSearch, notify, onOpenChat }: { supabase: SupabaseClient; userId: string; initialSearch: string; notify: Notify; onOpenChat: () => void }) {
  const [query, setQuery] = useState(initialSearch);
  const [people, setPeople] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const search = async (event?: FormEvent) => {
    event?.preventDefault(); if (query.trim().length < 2) return;
    setLoading(true); const safe = query.trim().replace(/[,%()]/g, '');
    const { data, error } = await supabase.from('profiles').select('*').or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`).neq('id', userId).limit(24);
    if (error) notify(error.message, 'error'); else setPeople((data ?? []) as Profile[]); setLoading(false);
  };
  useEffect(() => {
    if (initialSearch.trim().length < 2) return;
    setQuery(initialSearch);
    const safe = initialSearch.trim().replace(/[,%()]/g, '');
    let alive = true;
    void supabase.from('profiles').select('*').or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`).neq('id', userId).limit(24).then(({ data, error }) => {
      if (!alive) return;
      if (error) notify(error.message, 'error'); else setPeople((data ?? []) as Profile[]);
    });
    return () => { alive = false; };
  }, [initialSearch, supabase, userId, notify]);
  const follow = async (id: string) => { const { error } = await supabase.from('follows').insert({ follower_id: userId, following_id: id, status: 'accepted' }); if (error) notify(error.message, 'error'); else notify('دنبال‌کردن انجام شد.'); };
  const startChat = async (id: string) => { const { error } = await supabase.rpc('create_direct_conversation', { p_other_user_id: id }); if (error) notify(error.message, 'error'); else { notify('گفتگو آماده است.'); onOpenChat(); } };
  return <div className="page-stack"><SectionHeader eyebrow="جامعهٔ کاوه" title="اکتشاف" description="کاربران و سازندگان محتوا را پیدا کن."/><form className="discover-search" onSubmit={search}><Search size={20}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="نام نمایشی یا نام کاربری را جست‌وجو کن…"/><button className="button button-primary" disabled={loading || query.trim().length < 2}>{loading ? 'جست‌وجو…' : 'جست‌وجو'}</button></form>{people.length ? <div className="people-grid">{people.map((p) => <article className="person-card" key={p.id}><Avatar profile={p} size="lg"/><strong>{p.display_name}</strong><span>@{p.username ?? 'بدون نام کاربری'}</span><p>{p.bio || 'هنوز توضیحی برای این پروفایل ثبت نشده است.'}</p><div><button className="button button-primary button-small" onClick={() => void startChat(p.id)}><MessageCircle size={15}/> گفتگو</button><button className="button button-quiet button-small" onClick={() => void follow(p.id)}>دنبال‌کردن</button></div></article>)}</div> : <EmptyState icon={<Compass/>} title="کسی پیدا نشد" description="برای شروع، نام یا نام کاربری را جست‌وجو کن."/>}</div>;
}
