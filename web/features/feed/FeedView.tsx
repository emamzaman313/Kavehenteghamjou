'use client';
import { Activity, CircleHelp, Copy, Heart, MessageCircle, Send, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Post, Profile } from '@/lib/types';
import type { Notify } from '@/lib/ui-types';
import { formatDate } from '@/lib/format';
import { Avatar, EmptyState, SectionHeader } from '@/components/ui';

export default function FeedView({ supabase, userId, notify, onGoChats }: { supabase: SupabaseClient; userId: string; notify: Notify; onGoChats: () => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [authors, setAuthors] = useState<Record<string, Profile>>({});
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentRows, setCommentRows] = useState<Record<string, { id: string; body: string; author_id: string; created_at: string }[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('posts').select('*').order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(30);
    if (error) notify(`دریافت فید ناموفق بود: ${error.message}`, 'error');
    const rows = (data ?? []) as Post[]; setPosts(rows);
    const ids = [...new Set(rows.map((p) => p.author_id))];
    if (ids.length) {
      const [{ data: people }, { data: reactions }] = await Promise.all([
        supabase.from('profiles').select('*').in('id', ids),
        supabase.from('post_reactions').select('post_id,user_id').in('post_id', rows.map((p) => p.id)),
      ]);
      const map: Record<string, Profile> = {}; (people ?? []).forEach((p) => { map[p.id] = p as Profile; }); setAuthors(map);
      const myLikes = new Set<string>(); const total: Record<string, number> = {};
      (reactions ?? []).forEach((r) => { total[r.post_id] = (total[r.post_id] ?? 0) + 1; if (r.user_id === userId) myLikes.add(r.post_id); });
      setLiked(myLikes); setCounts(total);
    }
    setLoading(false);
  }, [supabase, userId, notify]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const channel = supabase.channel('public-feed').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => { void load(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, load]);

  const publish = async (event: FormEvent) => {
    event.preventDefault(); if (!body.trim()) return;
    setPublishing(true);
    const { error } = await supabase.from('posts').insert({ author_id: userId, body: body.trim(), visibility: 'public', comments_enabled: true, published_at: new Date().toISOString() });
    setPublishing(false);
    if (error) notify(`انتشار پست انجام نشد: ${error.message}`, 'error');
    else { setBody(''); notify('پست با موفقیت منتشر شد.'); void load(); }
  };

  const toggleLike = async (postId: string) => {
    if (liked.has(postId)) {
      const { error } = await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId);
      if (error) return notify(error.message, 'error');
      setLiked((old) => { const next = new Set(old); next.delete(postId); return next; }); setCounts((old) => ({ ...old, [postId]: Math.max(0, (old[postId] ?? 1) - 1) }));
    } else {
      const { error } = await supabase.from('post_reactions').insert({ post_id: postId, user_id: userId, reaction: '❤️' });
      if (error) return notify(error.message, 'error');
      setLiked((old) => new Set(old).add(postId)); setCounts((old) => ({ ...old, [postId]: (old[postId] ?? 0) + 1 }));
    }
  };

  const loadComments = async (postId: string) => {
    if (commentsFor === postId) { setCommentsFor(null); return; }
    setCommentsFor(postId);
    const { data, error } = await supabase.from('comments').select('id,body,author_id,created_at').eq('post_id', postId).order('created_at', { ascending: true }).limit(30);
    if (error) notify(error.message, 'error'); else setCommentRows((old) => ({ ...old, [postId]: data ?? [] }));
  };
  const addComment = async (postId: string) => {
    if (!commentText.trim()) return;
    const { error } = await supabase.from('comments').insert({ post_id: postId, author_id: userId, body: commentText.trim() });
    if (error) notify(error.message, 'error'); else { setCommentText(''); const { data } = await supabase.from('comments').select('id,body,author_id,created_at').eq('post_id', postId).order('created_at').limit(30); setCommentRows((old) => ({ ...old, [postId]: data ?? [] })); }
  };
  const copyPostLink = async (postId: string) => {
    try {
      if (!navigator.clipboard) throw new Error('مرورگر اجازهٔ کپی در کلیپ‌بورد را نمی‌دهد.');
      await navigator.clipboard.writeText(`${window.location.origin}/?post=${postId}`);
      notify('پیوند پست کپی شد.');
    } catch (error) { notify(error instanceof Error ? error.message : 'کپی پیوند انجام نشد.', 'error'); }
  };

  return <div className="feed-layout"><div className="feed-main">
    <SectionHeader eyebrow="جریان محتوا" title="سلام، خوش اومدی" description="آنچه در جامعهٔ کاوه می‌گذرد، همین‌جاست." action={<button className="button button-quiet" onClick={onGoChats}><MessageCircle size={17}/> گفتگوها</button>}/>
    <form className="composer-card" onSubmit={publish}><div className="composer-top"><Avatar profile={{ display_name: 'شما' }} size="md"/><textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="چه چیزی می‌خواهی با دیگران به اشتراک بگذاری؟" rows={3} maxLength={5000}/></div><div className="composer-bottom"><span><Sparkles size={15}/> انتشار عمومی در فید</span><button className="button button-primary" disabled={publishing || !body.trim()}>{publishing ? 'در حال انتشار…' : 'انتشار پست'}<Send size={16}/></button></div></form>
    <div className="feed-toolbar"><div><strong>تازه‌ترین‌ها</strong><span>محتوای عمومی جامعه</span></div><button className="icon-button" onClick={() => void load()} title="تازه‌سازی"><Activity size={18}/></button></div>
    {loading ? <div className="skeleton-list">{[1,2,3].map((n) => <div className="skeleton-card" key={n}/>)}</div> : posts.length === 0 ? <EmptyState icon={<Sparkles/>} title="هنوز پستی منتشر نشده" description="اولین پست را تو منتشر کن و فید را زنده کن."/> : posts.map((post) => <article className="post-card" key={post.id}><div className="post-author"><Avatar profile={authors[post.author_id]} size="md"/><div><strong>{authors[post.author_id]?.display_name ?? 'کاربر کاوه'}</strong><small>{authors[post.author_id]?.username ? `@${authors[post.author_id].username} · ` : ''}{formatDate(post.published_at ?? post.created_at)}</small></div></div><p className="post-body">{post.body}</p><div className="post-meta"><span><Activity size={14}/> انتشار عمومی</span><span>{counts[post.id] ?? 0} واکنش</span></div><div className="post-actions"><button className={liked.has(post.id) ? 'is-liked' : ''} onClick={() => void toggleLike(post.id)}><Heart size={18} fill={liked.has(post.id) ? 'currentColor' : 'none'}/> پسندیدن</button><button onClick={() => void loadComments(post.id)}><MessageCircle size={18}/> دیدگاه‌ها</button><button onClick={() => void copyPostLink(post.id)}><Copy size={18}/> کپی پیوند</button></div>{commentsFor === post.id && <div className="comments-box">{(commentRows[post.id] ?? []).map((comment) => <div className="comment-row" key={comment.id}><Avatar profile={authors[comment.author_id]} size="sm"/><p>{comment.body}</p></div>)}<div className="comment-compose"><input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="دیدگاهت را بنویس…" onKeyDown={(e) => { if (e.key === 'Enter') void addComment(post.id); }}/><button className="icon-button" onClick={() => void addComment(post.id)} title="ارسال دیدگاه"><Send size={17}/></button></div></div>}</article>)}
  </div><aside className="feed-aside"><div className="welcome-card"><div className="welcome-icon"><Zap size={21}/></div><span className="eyebrow">به کاوه خوش آمدی</span><h3>فضای تو،<br/>قوانین تو.</h3><p>گفتگو کن، محتوای ارزشمند بساز و فایل‌هایت را در فضای خصوصی نگه دار.</p><div className="welcome-stats"><span><strong>۵۰ MB</strong><small>سقف هر فایل</small></span><span><strong>خصوصی</strong><small>فضای ذخیره‌سازی</small></span></div></div><div className="side-info-card"><div className="side-info-title"><ShieldCheck size={17}/><strong>امنیت حساب</strong></div><p>دسترسی به پیام‌ها و فایل‌ها بر اساس نشست و سیاست‌های دیتابیس کنترل می‌شود.</p><span className="status-line"><i/> نشست احرازشده</span></div><div className="side-info-card"><div className="side-info-title"><CircleHelp size={17}/><strong>راهنمای سریع</strong></div><p>برای شروع گفتگو، از بخش اکتشاف یک کاربر را پیدا کن. فایل‌ها از بخش فایل‌های من قابل بارگذاری‌اند.</p></div></aside></div>;
}
