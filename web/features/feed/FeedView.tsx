'use client';
import { Activity, CircleHelp, Copy, Flag, Heart, MessageCircle, Send, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Post, Profile } from '@/lib/types';
import type { Notify } from '@/lib/ui-types';
import { formatDate } from '@/lib/format';
import { Avatar, EmptyState, SectionHeader } from '@/components/ui';
import PostComposer from '@/features/feed/PostComposer';

type PostAttachment = { id: string; post_id: string; bucket_id: string; object_path: string; original_name: string; mime_type: string | null; byte_size: number };

export default function FeedView({ supabase, userId, notify, onGoChats }: { supabase: SupabaseClient; userId: string; notify: Notify; onGoChats: () => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [authors, setAuthors] = useState<Record<string, Profile>>({});
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [attachments, setAttachments] = useState<Record<string, PostAttachment[]>>({});
  const [loading, setLoading] = useState(true);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentRows, setCommentRows] = useState<Record<string, { id: string; body: string; author_id: string; created_at: string }[]>>({});
  const [reportingPost, setReportingPost] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('محتوای نامناسب');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportingComment, setReportingComment] = useState<string | null>(null);
  const [commentReportDetails, setCommentReportDetails] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [selectedProfileBadges, setSelectedProfileBadges] = useState<{badge_code:string;title:string}[]>([]);

  const openAuthorProfile = async (authorId: string) => {
    const author = authors[authorId];
    if (!author) { notify('این پروفایل خصوصی است یا در دسترس شما نیست.', 'info'); return; }
    setSelectedProfile(author);
    setSelectedProfileBadges([]);
    const codes = author.featured_badges ?? [];
    if (codes.length) {
      const { data } = await supabase.from('badges').select('badge_code,title').in('badge_code', codes);
      setSelectedProfileBadges((data ?? []) as {badge_code:string;title:string}[]);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('posts').select('*').order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(30);
    if (error) notify(`دریافت فید ناموفق بود: ${error.message}`, 'error');
    const rows = (data ?? []) as Post[]; setPosts(rows);
    const ids = [...new Set(rows.map((p) => p.author_id))];
    if (ids.length) {
      const [{ data: people }, { data: reactions }, { data: media }] = await Promise.all([
        supabase.from('profiles').select('*').in('id', ids),
        supabase.from('post_reactions').select('post_id,user_id').in('post_id', rows.map((p) => p.id)),
        supabase.from('post_attachments').select('*').in('post_id', rows.map((p) => p.id)).order('created_at'),
      ]);
      const map: Record<string, Profile> = {}; (people ?? []).forEach((p) => { map[p.id] = p as Profile; }); setAuthors(map);
      const mediaMap: Record<string, PostAttachment[]> = {};
      (media ?? []).forEach((item) => { const row = item as PostAttachment; (mediaMap[row.post_id] ??= []).push(row); });
      setAttachments(mediaMap);
      const myLikes = new Set<string>(); const total: Record<string, number> = {};
      (reactions ?? []).forEach((r) => { total[r.post_id] = (total[r.post_id] ?? 0) + 1; if (r.user_id === userId) myLikes.add(r.post_id); });
      setLiked(myLikes); setCounts(total);
    } else { setAuthors({}); setAttachments({}); setLiked(new Set()); setCounts({}); }
    setLoading(false);
  }, [supabase, userId, notify]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const channel = supabase.channel('public-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_attachments' }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, load]);



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
  const submitPostReport = async (postId: string) => {
    if (reportSubmitting) return;
    const details = reportDetails.trim();
    if (details.length > 500) return notify('توضیحات گزارش نباید بیشتر از ۵۰۰ حرف باشد.', 'error');
    setReportSubmitting(true);
    const { data: existing, error: lookupError } = await supabase.from('reports')
      .select('id').eq('reporter_id', userId).eq('target_type', 'post').eq('target_id', postId)
      .in('status', ['open', 'reviewing']).limit(1).maybeSingle();
    if (lookupError) {
      setReportSubmitting(false);
      return notify('بررسی گزارش‌های قبلی ناموفق بود.', 'error');
    }
    if (existing) {
      setReportSubmitting(false);
      setReportingPost(null);
      return notify('برای این پست یک گزارش باز از طرف شما وجود دارد.', 'error');
    }
    const { error } = await supabase.from('reports').insert({
      reporter_id: userId,
      target_type: 'post',
      target_id: postId,
      reason: reportReason,
      details: details || null,
      status: 'open',
    });
    setReportSubmitting(false);
    if (error) return notify('ارسال گزارش ناموفق بود. دوباره تلاش کنید.', 'error');
    setReportingPost(null);
    setReportDetails('');
    notify('گزارش شما برای بررسی مدیران ارسال شد.');
  };

  const submitCommentReport = async (commentId: string) => {
    if (reportSubmitting) return;
    const details = commentReportDetails.trim();
    if (details.length > 500) return notify('توضیحات گزارش نباید بیشتر از ۵۰۰ حرف باشد.', 'error');
    setReportSubmitting(true);
    const { data: existing, error: lookupError } = await supabase.from('reports')
      .select('id').eq('reporter_id', userId).eq('target_type', 'comment').eq('target_id', commentId)
      .in('status', ['open', 'reviewing']).limit(1).maybeSingle();
    if (lookupError) { setReportSubmitting(false); return notify('بررسی گزارش‌های قبلی ناموفق بود.', 'error'); }
    if (existing) { setReportSubmitting(false); setReportingComment(null); return notify('برای این دیدگاه یک گزارش باز از طرف شما وجود دارد.', 'error'); }
    const { error } = await supabase.from('reports').insert({
      reporter_id: userId, target_type: 'comment', target_id: commentId,
      reason: 'گزارش دیدگاه نامناسب', details: details || null, status: 'open',
    });
    setReportSubmitting(false);
    if (error) return notify('ارسال گزارش دیدگاه ناموفق بود.', 'error');
    setReportingComment(null); setCommentReportDetails('');
    notify('گزارش دیدگاه برای بررسی مدیران ارسال شد.');
  };

  const copyPostLink = async (postId: string) => {
    try {
      if (!navigator.clipboard) throw new Error('مرورگر اجازهٔ کپی در کلیپ‌بورد را نمی‌دهد.');
      await navigator.clipboard.writeText(`${window.location.origin}/?post=${postId}`);
      notify('پیوند پست کپی شد.');
    } catch (error) { notify(error instanceof Error ? error.message : 'کپی پیوند انجام نشد.', 'error'); }
  };

  return <div className="feed-layout"><div className="feed-main">
    <section className="home-hero" aria-label="خوش‌آمدگویی به کاوه انتقامجو">
      <div className="home-hero-copy">
        <div className="home-hero-kicker"><i/> KAVEH AVENGER <span>فضای اختصاصی تو</span></div>
        <h1>اینجا، صدای تو<br/><em>شروع یک اتفاق تازه است.</em></h1>
        <p>گفتگوهای واقعی، ایده‌های تازه و لحظه‌هایی که ارزش به‌اشتراک‌گذاشتن دارند؛ همه در یک فضای مستقل.</p>
        <div className="home-hero-actions">
          <button className="hero-primary-action" onClick={onGoChats}><MessageCircle size={17}/> شروع یک گفتگو <span>←</span></button>
          <div className="hero-live-state"><i/> فضای تو آماده است</div>
        </div>
        <div className="home-hero-pill-row"><span>ارتباط</span><b>·</b><span>جامعه</span><b>·</b><span>رسانه</span></div>
      </div>
      <div className="home-hero-art" aria-hidden="true">
        <div className="hero-art-grid"/>
        <div className="hero-art-orbit orbit-one"/>
        <div className="hero-art-orbit orbit-two"/>
        <div className="hero-art-core">
          <svg viewBox="0 0 360 360" role="presentation">
            <defs>
              <linearGradient id="hero-blade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f5d9a8"/><stop offset=".48" stopColor="#8bd4ff"/><stop offset="1" stopColor="#2873d4"/></linearGradient>
              <filter id="hero-glow"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <circle cx="180" cy="180" r="126" fill="none" stroke="rgba(180,218,255,.24)" strokeWidth="1"/>
            <circle cx="180" cy="180" r="103" fill="none" stroke="rgba(222,185,128,.34)" strokeWidth="1" strokeDasharray="3 11"/>
            <path d="M180 49 211 147 309 180 211 213 180 311 149 213 51 180 149 147Z" fill="url(#hero-blade)" opacity=".92" filter="url(#hero-glow)"/>
            <path d="M180 91 202 158 269 180 202 202 180 269 158 202 91 180 158 158Z" fill="#0b1c32" stroke="rgba(255,255,255,.6)" strokeWidth="1.5"/>
            <circle cx="180" cy="180" r="19" fill="#f4d7a2"/>
            <path d="M180 143V217M143 180H217" stroke="#fff5df" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="hero-art-caption"><span>01 / 03</span><b>YOUR SPACE. YOUR VOICE.</b></div>
      </div>
      <div className="home-hero-bottomline"><span>یک جهان برای ارتباط</span><span>طراحی‌شده برای تو <b>✳</b></span></div>
    </section>
    <SectionHeader eyebrow="THE COMMUNITY FEED" title="جریان جامعه" description="تازه‌ترین نوشته‌ها و اتفاقات فضای کاوه." action={<button className="button button-quiet" onClick={onGoChats}><MessageCircle size={17}/> گفتگوها</button>}/>
    <PostComposer supabase={supabase} userId={userId} notify={notify} onPublished={() => void load()}/>\n    
    <div className="feed-toolbar"><div><strong>تازه‌ترین‌ها</strong><span>محتوای عمومی جامعه</span></div><button className="icon-button" onClick={() => void load()} title="تازه‌سازی"><Activity size={18}/></button></div>
    {loading ? <div className="skeleton-list">{[1,2,3].map((n) => <div className="skeleton-card" key={n}/>)}</div> : posts.length === 0 ? <EmptyState icon={<Sparkles/>} title="هنوز پستی منتشر نشده" description="اولین پست را تو منتشر کن و فید را زنده کن."/> : posts.map((post) => <article className="post-card" key={post.id}><button type="button" className="post-author post-author-button" onClick={() => void openAuthorProfile(post.author_id)} aria-label="نمایش پروفایل نویسنده"><Avatar profile={authors[post.author_id]} size="md"/><span><strong>{authors[post.author_id]?.display_name ?? 'کاربر کاوه'}</strong><small>{authors[post.author_id]?.username ? `@${authors[post.author_id].username} · ` : ''}{formatDate(post.published_at ?? post.created_at)}</small></span></button>{post.body && <p className="post-body">{post.body}</p>}{attachments[post.id]?.length ? <div className="post-media-grid">{attachments[post.id].map((item) => { const { data } = supabase.storage.from(item.bucket_id).getPublicUrl(item.object_path); const url = data.publicUrl; return item.mime_type?.startsWith('image/') ? <a className="post-media-link" href={url} target="_blank" rel="noreferrer" key={item.id}><img className="post-media-image" src={url} alt={item.original_name} loading="lazy"/></a> : item.mime_type?.startsWith('video/') ? <video className="post-media-video" key={item.id} controls playsInline preload="metadata" src={url}/> : item.mime_type?.startsWith('audio/') ? <audio className="post-media-audio" key={item.id} controls preload="metadata" src={url}/> : <a className="post-file-attachment" href={url} download={item.original_name} target="_blank" rel="noreferrer" key={item.id}><span>{item.original_name}</span></a>; })}</div> : null}<div className="post-meta"><span><Activity size={14}/> انتشار عمومی</span><span>{counts[post.id] ?? 0} واکنش</span></div><div className="post-actions"><button className={liked.has(post.id) ? 'is-liked' : ''} onClick={() => void toggleLike(post.id)}><Heart size={18} fill={liked.has(post.id) ? 'currentColor' : 'none'}/> پسندیدن</button><button onClick={() => void loadComments(post.id)}><MessageCircle size={18}/> دیدگاه‌ها</button><button onClick={() => void copyPostLink(post.id)}><Copy size={18}/> کپی پیوند</button><button onClick={() => { setReportingPost(reportingPost === post.id ? null : post.id); setReportDetails(''); }}><Flag size={18}/> گزارش</button></div>{reportingPost === post.id && <div className="post-report-form">
  <strong>گزارش این پست</strong>
  <label>دلیل گزارش<select value={reportReason} onChange={(event) => setReportReason(event.target.value)} disabled={reportSubmitting}><option>محتوای نامناسب</option><option>هرزنامه یا تبلیغات مزاحم</option><option>آزار و اذیت یا تهدید</option><option>اطلاعات گمراه‌کننده</option><option>نقض حقوق دیگران</option><option>سایر موارد</option></select></label>
  <label>توضیحات تکمیلی (اختیاری)<textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={500} rows={3} placeholder="اگر لازم است جزئیات بیشتری بنویسید…" disabled={reportSubmitting}/></label>
  <div><button className="button button-quiet" type="button" onClick={() => setReportingPost(null)} disabled={reportSubmitting}>انصراف</button><button className="button button-primary" type="button" onClick={() => void submitPostReport(post.id)} disabled={reportSubmitting}><Flag size={15}/>{reportSubmitting ? 'در حال ارسال…' : 'ارسال گزارش'}</button></div>
</div>}
{commentsFor === post.id && <div className="comments-box">{(commentRows[post.id] ?? []).map((comment) => <div className="comment-row" key={comment.id}><Avatar profile={authors[comment.author_id]} size="sm"/><p>{comment.body}</p><button type="button" className="button button-quiet" onClick={() => { setReportingComment(reportingComment === comment.id ? null : comment.id); setCommentReportDetails(''); }}>گزارش</button>{reportingComment === comment.id && <div className="post-report-form"><label>توضیحات گزارش (اختیاری)<textarea value={commentReportDetails} onChange={(event) => setCommentReportDetails(event.target.value)} maxLength={500} rows={2} placeholder="دلیل گزارش این دیدگاه…" disabled={reportSubmitting}/></label><div><button className="button button-quiet" type="button" onClick={() => setReportingComment(null)} disabled={reportSubmitting}>انصراف</button><button className="button button-primary" type="button" onClick={() => void submitCommentReport(comment.id)} disabled={reportSubmitting}>{reportSubmitting ? 'در حال ارسال…' : 'ارسال گزارش'}</button></div></div>}</div>)}<div className="comment-compose"><input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="دیدگاهت را بنویس…" onKeyDown={(e) => { if (e.key === 'Enter') void addComment(post.id); }}/><button className="icon-button" onClick={() => void addComment(post.id)} title="ارسال دیدگاه"><Send size={17}/></button></div></div>}</article>)}
  </div><aside className="feed-aside"><div className="welcome-card"><div className="welcome-icon"><Zap size={21}/></div><span className="eyebrow">به کاوه خوش آمدی</span><h3>فضای تو،<br/>قوانین تو.</h3><p>گفتگو کن، محتوای ارزشمند بساز و فایل‌هایت را در فضای خصوصی نگه دار.</p><div className="welcome-stats"><span><strong>۵۰ MB</strong><small>سقف هر فایل</small></span><span><strong>خصوصی</strong><small>فضای ذخیره‌سازی</small></span></div></div><div className="side-info-card"><div className="side-info-title"><ShieldCheck size={17}/><strong>امنیت حساب</strong></div><p>دسترسی به پیام‌ها و فایل‌ها بر اساس نشست و سیاست‌های دیتابیس کنترل می‌شود.</p><span className="status-line"><i/> نشست احرازشده</span></div><div className="side-info-card"><div className="side-info-title"><CircleHelp size={17}/><strong>راهنمای سریع</strong></div><p>برای شروع گفتگو، از بخش اکتشاف یک کاربر را پیدا کن. فایل‌ها از بخش فایل‌های من قابل بارگذاری‌اند.</p></div></aside></div>{selectedProfile && <div className="profile-viewer-backdrop" role="presentation" onClick={() => setSelectedProfile(null)}><section className="profile-viewer" role="dialog" aria-modal="true" aria-label="پروفایل کاربر" onClick={event => event.stopPropagation()}><button type="button" className="profile-viewer-close" onClick={() => setSelectedProfile(null)} aria-label="بستن">×</button><div className="profile-viewer-cover" style={selectedProfile.cover_path ? {backgroundImage:`linear-gradient(110deg,rgba(7,17,31,.2),rgba(7,17,31,.55)),url("${supabase.storage.from('profile-media').getPublicUrl(selectedProfile.cover_path).data.publicUrl}")`} : undefined}/><div className="profile-viewer-content" style={{background:selectedProfile.profile_theme?.surface ?? '#101b2c',color:selectedProfile.profile_theme?.text ?? '#f4f1eb',borderColor:selectedProfile.profile_theme?.accent ?? '#168bff'}}><Avatar profile={selectedProfile} size="lg"/><h2>{selectedProfile.display_name || 'کاربر کاوه'}</h2><p>{selectedProfile.username ? '@'+selectedProfile.username : 'کاربر کاوه'}</p><p>{selectedProfile.bio || 'این کاربر هنوز توضیحی برای پروفایل خود ثبت نکرده است.'}</p>{selectedProfile.profile_music_path && <div className="profile-viewer-music"><strong>{selectedProfile.profile_music_title || 'موسیقی پروفایل'}</strong><audio controls preload="none" src={supabase.storage.from('post-media').getPublicUrl(selectedProfile.profile_music_path).data.publicUrl}/></div>}{selectedProfileBadges.length>0 && <div className="profile-viewer-badges"><strong>ویترین دستاوردها</strong><div>{selectedProfileBadges.map(b=><span key={b.badge_code}>✦ {b.title}</span>)}</div></div>}<small>عضویت از {formatDate(selectedProfile.created_at)}</small></div></section></div></> ;
}
