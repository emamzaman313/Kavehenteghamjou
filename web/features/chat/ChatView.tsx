'use client';
import { ArrowDownToLine, ArrowLeft, Check, File, MessageCircle, Paperclip, Plus, Search, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Conversation, FileAsset, Message, Profile } from '@/lib/types';
import type { Notify } from '@/lib/ui-types';
import { safeDisplayName, validateUpload } from '@/lib/format';
import { hashFile } from '@/lib/files';
import { Avatar, EmptyState } from '@/components/ui';

export default function ChatView({ supabase, userId, notify }: { supabase: SupabaseClient; userId: string; notify: Notify }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<Record<string, Profile>>({});
  const [peerByConversation, setPeerByConversation] = useState<Record<string, string>>({});
  const [lastMessageByConversation, setLastMessageByConversation] = useState<Record<string, Message>>({});
  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachmentsByMessage, setAttachmentsByMessage] = useState<Record<string, FileAsset[]>>({});
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('CONNECTING');
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    const { data: memberRows, error } = await supabase.from('conversation_members').select('conversation_id,last_read_at').eq('user_id', userId);
    if (error) { notify(`گرفتن گفتگوها ناموفق بود: ${error.message}`, 'error'); setLoading(false); return; }
    const ids = (memberRows ?? []).map((r) => r.conversation_id);
    if (!ids.length) { setConversations([]); setMembers({}); setPeerByConversation({}); setLastMessageByConversation({}); setUnreadByConversation({}); setLoading(false); return; }
    const { data } = await supabase.from('conversations').select('*').in('id', ids).order('last_message_at', { ascending: false, nullsFirst: false });
    const rows = (data ?? []) as Conversation[]; setConversations(rows);
    const ownReadAt = new Map<string, string | null>((memberRows ?? []).map((row) => [row.conversation_id, row.last_read_at]));
    const { data: recentRows, error: recentError } = await supabase.from('messages')
      .select('id,conversation_id,sender_id,body,format,reply_to,edited_at,deleted_at,created_at')
      .in('conversation_id', ids).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(1000);
    if (recentError) notify('بارگذاری پیش‌نمایش گفتگوها ناموفق بود: ' + recentError.message, 'error');
    const latest: Record<string, Message> = {};
    (recentRows ?? []).forEach((item) => {
      const message = item as Message;
      if (!latest[message.conversation_id]) latest[message.conversation_id] = message;
    });
    setLastMessageByConversation(latest);
    const unreadPairs = await Promise.all(ids.map(async (conversationId) => {
      const cursor = ownReadAt.get(conversationId);
      let query = supabase.from('messages').select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId).neq('sender_id', userId).is('deleted_at', null);
      if (cursor) query = query.gt('created_at', cursor);
      const { count, error: unreadError } = await query;
      if (unreadError) {
        notify(`محاسبه پیام‌های خوانده‌نشده ناموفق بود: ${unreadError.message}`, 'error');
        return [conversationId, 0] as const;
      }
      return [conversationId, count ?? 0] as const;
    }));
    setUnreadByConversation(Object.fromEntries(unreadPairs));
    const { data: participants } = await supabase.from('conversation_members').select('conversation_id,user_id').in('conversation_id', ids).neq('user_id', userId);
    const otherIds = new Set<string>();
    const peerMap: Record<string, string> = {};
    (participants ?? []).forEach((participant) => {
      otherIds.add(participant.user_id);
      if (!peerMap[participant.conversation_id]) peerMap[participant.conversation_id] = participant.user_id;
    });
    setPeerByConversation(peerMap);
    if (otherIds.size) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', [...otherIds]);
      const map: Record<string, Profile> = {}; (profiles ?? []).forEach((p) => { map[p.id] = p as Profile; }); setMembers(map);
    } else setMembers({});
    setLoading(false);
  }, [supabase, userId, notify]);
  useEffect(() => { void loadConversations(); }, [loadConversations]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).is('deleted_at', null).order('created_at', { ascending: false }).limit(100);
    if (error) notify(`دریافت پیام‌ها ناموفق بود: ${error.message}`, 'error');
    const rows = ((data ?? []) as Message[]).reverse();
    setHasOlderMessages(rows.length === 100);
    setMessages(rows);
    if (rows.length) {
      const { data: links } = await supabase.from('message_attachments').select('message_id,file_asset_id').in('message_id', rows.map((m) => m.id));
      const fileIds = [...new Set((links ?? []).map((link) => link.file_asset_id))];
      if (fileIds.length) {
        const { data: assets } = await supabase.from('file_assets').select('*').in('id', fileIds);
        const assetMap = new Map<string, FileAsset>((assets ?? []).map((asset): [string, FileAsset] => [asset.id, asset as FileAsset]));
        const grouped: Record<string, FileAsset[]> = {};
        (links ?? []).forEach((link) => { const asset = assetMap.get(link.file_asset_id); if (asset) grouped[link.message_id] = [...(grouped[link.message_id] ?? []), asset]; });
        setAttachmentsByMessage(grouped);
      } else setAttachmentsByMessage({});
    } else { setAttachmentsByMessage({}); }
    const { error: readError } = await supabase.from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('user_id', userId);
    if (readError) notify(`ثبت وضعیت خواندن ناموفق بود: ${readError.message}`, 'error');
    else void loadConversations();
  }, [supabase, userId, notify, loadConversations]);

  useEffect(() => {
    if (!active) { setMessages([]); return; }
    void loadMessages(active);
    const channel = supabase.channel(`chat:${active}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${active}` }, () => { void loadMessages(active); void loadConversations(); }).subscribe((status) => { setRealtimeStatus(status); if (status === 'SUBSCRIBED') { void loadMessages(active); void loadConversations(); } });
    return () => { void supabase.removeChannel(channel); };
  }, [active, supabase, loadMessages, loadConversations]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadOlderMessages = async () => {
    if (!active || loadingOlder || !hasOlderMessages || messages.length === 0) return;
    setLoadingOlder(true);
    const oldest = messages[0];
    const { data, error } = await supabase.from('messages').select('*')
      .eq('conversation_id', active).is('deleted_at', null)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false }).limit(100);
    if (error) notify('بارگذاری پیام‌های قدیمی ناموفق بود: ' + error.message, 'error');
    else {
      const older = ((data ?? []) as Message[]).reverse();
      setMessages((current) => {
        const existingIds = new Set(current.map((message) => message.id));
        return [...older.filter((message) => !existingIds.has(message.id)), ...current];
      });
      setHasOlderMessages((data ?? []).length === 100);
    }
    setLoadingOlder(false);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault(); if (!active || !draft.trim()) return;
    const text = draft.trim(); setDraft(''); setSending(true);
    const { error } = await supabase.from('messages').insert({ conversation_id: active, sender_id: userId, body: text, format: 'plain' });
    setSending(false);
    if (error) { setDraft(text); notify(`ارسال پیام ناموفق بود: ${error.message}`, 'error'); }
    else { void loadMessages(active); void loadConversations(); }
  };

  const downloadAttachment = async (file: FileAsset) => {
    const { data, error } = await supabase.storage.from(file.bucket_id).createSignedUrl(file.object_path, 90, { download: safeDisplayName(file.original_name) });
    if (error || !data?.signedUrl) notify(error?.message ?? 'لینک دانلود در دسترس نیست.', 'error');
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const uploadAttachment = async (file: File) => {
    const invalid = validateUpload(file);
    if (invalid) { notify(invalid, 'error'); return; }
    if (!active) return;
    let createdPath: string | null = null;
    let createdAssetId: string | null = null;
    let createdMessageId: string | null = null;
    try {
      const path = `${userId}/${crypto.randomUUID()}`;
      const sha256Hex = await hashFile(file);
      createdPath = path;
      const { error: storageError } = await supabase.storage.from('user-files').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
      if (storageError) throw storageError;
      const { data: asset, error: assetError } = await supabase.from('file_assets').insert({
        owner_id: userId, bucket_id: 'user-files', object_path: path, original_name: safeDisplayName(file.name),
        mime_type: file.type || null, byte_size: file.size, sha256_hex: sha256Hex, status: 'ready',
      }).select('id').single();
      if (assetError || !asset) throw assetError ?? new Error('ثبت اطلاعات فایل انجام نشد.');
      createdAssetId = asset.id;
      const { data: message, error: messageError } = await supabase.from('messages').insert({ conversation_id: active, sender_id: userId, body: `📎 ${safeDisplayName(file.name)}`, format: 'plain' }).select('id').single();
      if (messageError || !message) throw messageError ?? new Error('ثبت پیام پیوست انجام نشد.');
      createdMessageId = message.id;
      const { error: attachmentError } = await supabase.from('message_attachments').insert({ message_id: message.id, file_asset_id: asset.id, display_order: 0 });
      if (attachmentError) throw attachmentError;
      notify('فایل به گفتگو پیوست شد.');
      void loadMessages(active);
    } catch (error) {
      if (createdMessageId) await supabase.from('messages').delete().eq('id', createdMessageId);
      if (createdAssetId) await supabase.from('file_assets').delete().eq('id', createdAssetId);
      if (createdPath) await supabase.storage.from('user-files').remove([createdPath]);
      notify(`ارسال فایل ناموفق بود: ${error instanceof Error ? error.message : 'خطای نامشخص'}`, 'error');
    }
  };

  const searchPeople = async (value: string) => {
    setSearchUser(value);
    if (value.trim().length < 2) { setSearchResults([]); return; }
    const safe = value.trim().replace(/[,%()]/g, '');
    const { data, error } = await supabase.from('profiles').select('*').or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`).neq('id', userId).limit(12);
    if (error) notify(error.message, 'error'); else setSearchResults((data ?? []) as Profile[]);
  };
  const startConversation = async (otherId: string) => {
    const { data, error } = await supabase.rpc('create_direct_conversation', { p_other_user_id: otherId });
    if (error) { notify(`ساخت گفتگو انجام نشد: ${error.message}`, 'error'); return; }
    setShowNew(false); setSearchUser(''); setSearchResults([]); await loadConversations(); setActive(data as string);
  };

  const activeConversation = conversations.find((c) => c.id === active);
  const otherProfile = active ? members[peerByConversation[active] ?? ''] : null;
  return <div className="chat-layout"><section className="chat-list-panel"><div className="chat-list-heading"><div><span className="eyebrow">ارتباطات شما</span><h1>گفتگوها</h1></div><button className="button button-primary button-square" onClick={() => setShowNew((v) => !v)} title="گفتگوی جدید"><Plus size={19}/></button></div>
    {showNew && <div className="new-chat-box"><div className="search-input"><Search size={16}/><input value={searchUser} onChange={(e) => void searchPeople(e.target.value)} placeholder="نام یا نام کاربری…" autoFocus/></div>{searchResults.map((p) => <button className="person-result" key={p.id} onClick={() => void startConversation(p.id)}><Avatar profile={p} size="sm"/><span><strong>{p.display_name}</strong><small>@{p.username ?? 'بدون نام کاربری'}</small></span><ArrowLeft size={16}/></button>)}</div>}
    <div className="chat-list-scroll">{loading ? <div className="skeleton-list"><div className="skeleton-card"/><div className="skeleton-card"/></div> : conversations.length === 0 ? <EmptyState icon={<MessageCircle/>} title="گفتگویی نداری" description="از دکمهٔ + یک گفتگو با کاربر دیگری شروع کن."/> : conversations.map((c) => {
      const p = members[peerByConversation[c.id] ?? ''];
      const title = c.title || (c.kind === 'direct' ? p?.display_name : c.kind === 'group' ? 'گروه کاوه' : 'کانال کاوه');
      return <button className={`conversation-row ${active === c.id ? 'selected' : ''}`} key={c.id} onClick={() => setActive(c.id)}><Avatar profile={{ display_name: title ?? 'گفتگو', avatar_url: p?.avatar_url }} size="md"/><span className="conversation-copy"><strong>{title ?? 'گفتگو'}</strong><small>{lastMessageByConversation[c.id]?.body || (c.kind === 'direct' ? 'گفتگوی خصوصی' : c.kind === 'group' ? 'گروه' : 'کانال')}</small></span><span className="conversation-time">{unreadByConversation[c.id] > 0 && <b className="unread-count">{unreadByConversation[c.id] > 99 ? '۹۹+' : unreadByConversation[c.id].toLocaleString('fa-IR')}</b>}{c.last_message_at ? new Date(c.last_message_at).toLocaleDateString('fa-IR') : ''}</span></button>;
    })}</div>
  </section>
  <section className="chat-window">{activeConversation ? <><header className="chat-window-header"><Avatar profile={otherProfile ?? { display_name: activeConversation.title ?? 'گفتگو' }} size="md"/><div><strong>{activeConversation.title ?? otherProfile?.display_name ?? 'گفتگوی خصوصی'}</strong><small>{realtimeStatus === 'SUBSCRIBED' ? 'اتصال زنده برقرار است' : realtimeStatus === 'CHANNEL_ERROR' || realtimeStatus === 'TIMED_OUT' ? 'اتصال قطع است؛ تلاش مجدد' : 'در حال اتصال به سرور…'}</small></div><span className={`live-pill ${realtimeStatus === 'SUBSCRIBED' ? '' : 'offline'}`}><i/> {realtimeStatus === 'SUBSCRIBED' ? 'زنده' : 'اتصال'}</span></header><div className="messages-scroll">{hasOlderMessages && <button className="load-older-button" onClick={() => void loadOlderMessages()} disabled={loadingOlder}>{loadingOlder ? 'در حال بارگذاری…' : 'نمایش پیام‌های قدیمی‌تر'}</button>}{messages.length === 0 ? <EmptyState icon={<MessageCircle/>} title="شروع یک گفتگوی تازه" description="اولین پیام را بنویس و گفتگو را آغاز کن."/> : messages.map((m) => <div key={m.id} className={`message-row ${m.sender_id === userId ? 'outgoing' : 'incoming'}`}><div className="message-bubble"><p>{m.body}</p>{(attachmentsByMessage[m.id] ?? []).map((file) => <button key={file.id} className="attachment-chip" onClick={() => void downloadAttachment(file)}><File size={15}/><span>{file.original_name}</span><ArrowDownToLine size={14}/></button>)}<small>{new Date(m.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}{m.sender_id === userId && <Check size={13} aria-label="ارسال‌شده"/>}</small></div></div>)}<div ref={bottomRef}/></div><form className="message-composer" onSubmit={send}><input ref={attachmentInputRef} type="file" className="visually-hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadAttachment(file); e.target.value = ''; }}/><button type="button" className="icon-button" title="پیوست فایل" onClick={() => attachmentInputRef.current?.click()}><Paperclip size={19}/></button><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="پیامت را بنویس…"/><button className="send-button" disabled={sending || !draft.trim()}><Send size={18}/></button></form></> : <EmptyState icon={<MessageCircle/>} title="یک گفتگو انتخاب کن" description="از فهرست سمت راست وارد گفتگو شو یا یک گفتگوی جدید بساز."/>}</section></div>;
}
