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
  const [peerReadAtByConversation, setPeerReadAtByConversation] = useState<Record<string, string | null>>({});
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
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [spaceType, setSpaceType] = useState<'group' | 'channel'>('group');
  const [spaceTitle, setSpaceTitle] = useState('');
  const [spaceDescription, setSpaceDescription] = useState('');
  const [spaceApproval, setSpaceApproval] = useState(false);
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [showMemberManager, setShowMemberManager] = useState(false);
  const [spaceMembers, setSpaceMembers] = useState<Profile[]>([]);
  const [joinRequests, setJoinRequests] = useState<{id:string;requester_id:string;requested_at:string;profile?:Profile}[]>([]);
  const [spaceMemberRoles, setSpaceMemberRoles] = useState<Record<string, string>>({});
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<Profile[]>([]);
  const [memberActionBusy, setMemberActionBusy] = useState(false);
  const [myRoleByConversation, setMyRoleByConversation] = useState<Record<string, string>>({});
  const [mutedUntilByConversation, setMutedUntilByConversation] = useState<Record<string, string | null>>({});
  const [muteBusy, setMuteBusy] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('CONNECTING');
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    const { data: memberRows, error } = await supabase.from('conversation_members').select('conversation_id,last_read_at,member_role,muted_until').eq('user_id', userId);
    if (error) { notify(`گرفتن گفتگوها ناموفق بود: ${error.message}`, 'error'); setLoading(false); return; }
    const ids = (memberRows ?? []).map((r) => r.conversation_id);
    setMyRoleByConversation(Object.fromEntries((memberRows ?? []).map((r) => [r.conversation_id, r.member_role])));
    setMutedUntilByConversation(Object.fromEntries((memberRows ?? []).map((r) => [r.conversation_id, r.muted_until])));
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
    const { data: participants } = await supabase.from('conversation_members').select('conversation_id,user_id,last_read_at').in('conversation_id', ids).neq('user_id', userId);
    const otherIds = new Set<string>();
    const peerMap: Record<string, string> = {};
    const peerReadMap: Record<string, string | null> = {};
    (participants ?? []).forEach((participant) => {
      otherIds.add(participant.user_id);
      if (!peerMap[participant.conversation_id]) {
        peerMap[participant.conversation_id] = participant.user_id;
        peerReadMap[participant.conversation_id] = participant.last_read_at;
      }
    });
    setPeerByConversation(peerMap);
    setPeerReadAtByConversation(peerReadMap);
    if (otherIds.size) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', [...otherIds]);
      const map: Record<string, Profile> = {}; (profiles ?? []).forEach((p) => { map[p.id] = p as Profile; }); setMembers(map);
    } else setMembers({});
    setLoading(false);
  }, [supabase, userId, notify]);
  useEffect(() => { void loadConversations(); }, [loadConversations]);

  // Keep the inbox preview and unread counts fresh even when a different
  // conversation receives a message while it is not the active chat.
  useEffect(() => {
    const channel = supabase.channel(`chat-list:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => { void loadConversations(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members' }, () => { void loadConversations(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, userId, loadConversations]);

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
    const newestLoadedMessageAt = rows.at(-1)?.created_at;
    if (newestLoadedMessageAt) {
      const { error: readError } = await supabase.from('conversation_members')
        .update({ last_read_at: newestLoadedMessageAt })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);
      if (readError) notify(`ثبت وضعیت خواندن ناموفق بود: ${readError.message}`, 'error');
      else void loadConversations();
    }
  }, [supabase, userId, notify, loadConversations]);

  useEffect(() => {
    if (!active) { setMessages([]); return; }
    void loadMessages(active);
    const channel = supabase.channel(`chat:${active}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${active}` }, () => { void loadMessages(active); void loadConversations(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${active}` }, () => { void loadConversations(); })
      .subscribe((status) => { setRealtimeStatus(status); if (status === 'SUBSCRIBED') { void loadMessages(active); void loadConversations(); } });
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
      const olderIds = older.map((message) => message.id);
      if (olderIds.length) {
        const { data: links, error: linksError } = await supabase.from('message_attachments')
          .select('message_id,file_asset_id').in('message_id', olderIds);
        if (linksError) notify('بارگذاری پیوست‌های قدیمی ناموفق بود: ' + linksError.message, 'error');
        const fileIds = [...new Set((links ?? []).map((link) => link.file_asset_id))];
        if (fileIds.length) {
          const { data: assets, error: assetsError } = await supabase.from('file_assets').select('*').in('id', fileIds);
          if (assetsError) notify('دریافت اطلاعات فایل‌های قدیمی ناموفق بود: ' + assetsError.message, 'error');
          const assetMap = new Map<string, FileAsset>((assets ?? []).map((asset): [string, FileAsset] => [asset.id, asset as FileAsset]));
          const grouped: Record<string, FileAsset[]> = {};
          (links ?? []).forEach((link) => {
            const asset = assetMap.get(link.file_asset_id);
            if (asset) grouped[link.message_id] = [...(grouped[link.message_id] ?? []), asset];
          });
          setAttachmentsByMessage((current) => ({ ...current, ...grouped }));
        }
      }
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
    const { data: sentMessage, error } = await supabase.from('messages').insert({ conversation_id: active, sender_id: userId, body: text, format: 'plain' }).select('id').single();
    setSending(false);
    if (error) { setDraft(text); notify(`ارسال پیام ناموفق بود: ${error.message}`, 'error'); }
    else { if (sentMessage?.id) void supabase.functions.invoke('notification-dispatch', { body: { message_id: sentMessage.id } }); void loadMessages(active); void loadConversations(); }
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
      void supabase.functions.invoke('notification-dispatch', { body: { message_id: message.id } });
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

  const toggleConversationMute = async () => {
    if (!active || muteBusy) return;
    setMuteBusy(true);
    const currentlyMuted = Boolean(mutedUntilByConversation[active]);
    const nextMutedUntil = currentlyMuted ? null : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('conversation_members').update({ muted_until: nextMutedUntil, notifications_enabled: true }).eq('conversation_id', active).eq('user_id', userId);
    setMuteBusy(false);
    if (error) { notify('تغییر وضعیت اعلان گفتگو ناموفق بود: ' + error.message, 'error'); return; }
    setMutedUntilByConversation((current) => ({ ...current, [active]: nextMutedUntil }));
    notify(nextMutedUntil ? 'اعلان‌های این گفتگو برای ۸ ساعت بی‌صدا شد.' : 'اعلان‌های گفتگو دوباره فعال شد.');
  };
  const loadSpaceMembers = async (conversationId: string) => {
    const { data, error } = await supabase.from('conversation_members').select('user_id,member_role').eq('conversation_id', conversationId);
    if (error) { notify('دریافت اعضای گفتگو ناموفق بود: ' + error.message, 'error'); return; }
    const ids = (data ?? []).map((row) => row.user_id);
    setSpaceMemberRoles(Object.fromEntries((data ?? []).map((row) => [row.user_id, row.member_role])));
    if (!ids.length) { setSpaceMembers([]); return; }
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('*').in('id', ids);
    if (profileError) notify('دریافت پروفایل اعضا ناموفق بود: ' + profileError.message, 'error');
    setSpaceMembers((profiles ?? []) as Profile[]);
  };
  const loadJoinRequests = async (conversationId: string) => {
    const { data, error } = await supabase.from('conversation_join_requests').select('id,requester_id,requested_at').eq('conversation_id', conversationId).eq('status', 'pending').order('requested_at', { ascending: true });
    if (error) { notify('دریافت درخواست‌های عضویت ناموفق بود: ' + error.message, 'error'); return; }
    const ids = (data ?? []).map((row) => row.requester_id);
    const { data: profiles } = ids.length ? await supabase.from('profiles').select('*').in('id', ids) : { data: [] };
    const map = new Map((profiles ?? []).map((profile) => [profile.id, profile as Profile]));
    setJoinRequests((data ?? []).map((row) => ({ ...row, profile: map.get(row.requester_id) })));
  };
  const reviewJoinRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    if (!active || memberActionBusy) return;
    setMemberActionBusy(true);
    const { error } = await supabase.from('conversation_join_requests').update({ status, reviewed_at: new Date().toISOString(), reviewed_by: userId }).eq('id', requestId).eq('status', 'pending');
    setMemberActionBusy(false);
    if (error) { notify('بررسی درخواست عضویت ناموفق بود: ' + error.message, 'error'); return; }
    notify(status === 'approved' ? 'درخواست پذیرفته شد و کاربر عضو شد.' : 'درخواست رد شد.');
    await loadJoinRequests(active);
    await loadSpaceMembers(active);
  };

  const searchMembers = async (value: string) => {
    setMemberSearch(value);
    if (value.trim().length < 2) { setMemberSearchResults([]); return; }
    const safe = value.trim().replace(/[,%()]/g, '');
    const { data, error } = await supabase.from('profiles').select('*').or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`).neq('id', userId).limit(12);
    if (error) notify('جستجوی کاربر ناموفق بود: ' + error.message, 'error'); else setMemberSearchResults((data ?? []) as Profile[]);
  };
  const addSpaceMember = async (profile: Profile) => {
    if (!active) return;
    setMemberActionBusy(true);
    const { error } = await supabase.from('conversation_members').insert({ conversation_id: active, user_id: profile.id, member_role: 'member' });
    setMemberActionBusy(false);
    if (error) { notify(error.code === '23505' ? 'این کاربر از قبل عضو است.' : 'افزودن عضو انجام نشد: ' + error.message, 'error'); return; }
    notify('کاربر به گفتگو اضافه شد.'); setMemberSearch(''); setMemberSearchResults([]);
    await loadSpaceMembers(active); await loadConversations();
  };
  const removeSpaceMember = async (memberId: string) => {
    if (!active || memberActionBusy || memberId === userId) return;
    setMemberActionBusy(true);
    const { error } = await supabase.from('conversation_members').delete()
      .eq('conversation_id', active).eq('user_id', memberId).eq('member_role', 'member');
    setMemberActionBusy(false);
    if (error) { notify('حذف عضو انجام نشد: ' + error.message, 'error'); return; }
    notify('عضو از گروه یا کانال حذف شد.');
    await loadSpaceMembers(active);
    await loadConversations();
  };

  const createSpace = async (event: FormEvent) => {
    event.preventDefault();
    const title = spaceTitle.trim();
    const description = spaceDescription.trim();
    if (title.length < 3 || title.length > 60) { notify('نام گروه یا کانال باید بین ۳ تا ۶۰ نویسه باشد.', 'error'); return; }
    if (description.length > 500) { notify('توضیحات حداکثر ۵۰۰ نویسه است.', 'error'); return; }
    setCreatingSpace(true);
    let conversationId: string | null = null;
    try {
      const { data: conversation, error: conversationError } = await supabase.from('conversations').insert({ kind: spaceType, title, created_by: userId }).select('id').single();
      if (conversationError || !conversation) throw conversationError ?? new Error('ساخت فضای گفتگو ناموفق بود.');
      conversationId = conversation.id;
      const { error: memberError } = await supabase.from('conversation_members').insert({ conversation_id: conversationId, user_id: userId, member_role: 'owner' });
      if (memberError) throw memberError;
      const metadata = spaceType === 'group' ? await supabase.from('group_spaces').insert({ conversation_id: conversationId, owner_id: userId, description, join_approval_required: spaceApproval }) : await supabase.from('channel_spaces').insert({ conversation_id: conversationId, owner_id: userId, description, visibility: 'public' });
      if (metadata.error) throw metadata.error;
      notify(spaceType === 'group' ? 'گروه ساخته شد.' : 'کانال عمومی ساخته شد.');
      setShowCreateSpace(false); setSpaceTitle(''); setSpaceDescription(''); setSpaceApproval(false);
      await loadConversations(); setActive(conversationId);
    } catch (error) {
      if (conversationId) await supabase.from('conversations').delete().eq('id', conversationId).eq('created_by', userId);
      notify('ساخت گروه یا کانال انجام نشد: ' + (error instanceof Error ? error.message : 'خطای نامشخص'), 'error');
    } finally { setCreatingSpace(false); }
  };
  const activeConversation = conversations.find((c) => c.id === active);
  const otherProfile = active ? members[peerByConversation[active] ?? ''] : null;
  return <div className="chat-layout"><section className="chat-list-panel"><div className="chat-list-heading"><div><span className="eyebrow">ارتباطات شما</span><h1>گفتگوها</h1></div><div className="admin-user-actions"><button className="button button-primary button-square" onClick={() => setShowNew((v) => !v)} title="گفتگوی جدید"><Plus size={19}/></button><button className="button button-ghost" onClick={() => { setShowCreateSpace((v) => !v); setShowNew(false); }}>گروه/کانال</button></div></div>
    {showNew && <div className="new-chat-box"><div className="search-input"><Search size={16}/><input value={searchUser} onChange={(e) => void searchPeople(e.target.value)} placeholder="نام یا نام کاربری…" autoFocus/></div>{searchResults.map((p) => <button className="person-result" key={p.id} onClick={() => void startConversation(p.id)}><Avatar profile={p} size="sm"/><span><strong>{p.display_name}</strong><small>@{p.username ?? 'بدون نام کاربری'}</small></span><ArrowLeft size={16}/></button>)}</div>}
    {showCreateSpace && <form className="new-chat-box" onSubmit={createSpace}>
      <strong>ساخت فضای جدید</strong>
      <div className="composer-tools"><button type="button" onClick={() => setSpaceType("group")}>گروه</button><button type="button" onClick={() => setSpaceType("channel")}>کانال عمومی</button></div>
      <input className="auth-input" value={spaceTitle} onChange={(e) => setSpaceTitle(e.target.value)} minLength={3} maxLength={60} required placeholder={spaceType === "group" ? "نام گروه" : "نام کانال"}/>
      <textarea className="auth-input" value={spaceDescription} onChange={(e) => setSpaceDescription(e.target.value)} maxLength={500} rows={3} placeholder="توضیحات (اختیاری)"/>
      {spaceType === "group" && <label className="admin-toggle-row"><input type="checkbox" checked={spaceApproval} onChange={(e) => setSpaceApproval(e.target.checked)}/><span>عضویت با تأیید مدیر گروه</span></label>}
      {spaceType === "channel" && <small className="admin-security-note">کانال عمومی ساخته می‌شود؛ دسترسی نوشتن فعلاً فقط برای اعضای ثبت‌شده است.</small>}
      <div className="admin-user-actions"><button className="button button-primary" disabled={creatingSpace}>{creatingSpace ? "در حال ساخت…" : "ساخت"}</button><button type="button" className="button button-ghost" onClick={() => setShowCreateSpace(false)}>انصراف</button></div>
    </form>}
    <div className="chat-list-scroll">{loading ? <div className="skeleton-list"><div className="skeleton-card"/><div className="skeleton-card"/></div> : conversations.length === 0 ? <EmptyState icon={<MessageCircle/>} title="گفتگویی نداری" description="از دکمهٔ + یک گفتگو با کاربر دیگری شروع کن."/> : conversations.map((c) => {
      const p = members[peerByConversation[c.id] ?? ''];
      const title = c.title || (c.kind === 'direct' ? p?.display_name : c.kind === 'group' ? 'گروه کاوه' : 'کانال کاوه');
      return <button className={`conversation-row ${active === c.id ? 'selected' : ''}`} key={c.id} onClick={() => setActive(c.id)}><Avatar profile={{ display_name: title ?? 'گفتگو', avatar_url: p?.avatar_url }} size="md"/><span className="conversation-copy"><strong>{title ?? 'گفتگو'}</strong><small>{lastMessageByConversation[c.id]?.body || (c.kind === 'direct' ? 'گفتگوی خصوصی' : c.kind === 'group' ? 'گروه' : 'کانال')}</small></span><span className="conversation-time">{unreadByConversation[c.id] > 0 && <b className="unread-count">{unreadByConversation[c.id] > 99 ? '۹۹+' : unreadByConversation[c.id].toLocaleString('fa-IR')}</b>}{c.last_message_at ? new Date(c.last_message_at).toLocaleDateString('fa-IR') : ''}</span></button>;
    })}</div>
  </section>
  <section className="chat-window">{activeConversation ? <><header className="chat-window-header"><Avatar profile={otherProfile ?? { display_name: activeConversation.title ?? 'گفتگو' }} size="md"/><div><strong>{activeConversation.title ?? otherProfile?.display_name ?? 'گفتگوی خصوصی'}</strong><small>{realtimeStatus === 'SUBSCRIBED' ? 'اتصال زنده برقرار است' : realtimeStatus === 'CHANNEL_ERROR' || realtimeStatus === 'TIMED_OUT' ? 'اتصال قطع است؛ تلاش مجدد' : 'در حال اتصال به سرور…'}</small></div><span className={`live-pill ${realtimeStatus === 'SUBSCRIBED' ? '' : 'offline'}`}><i/> {realtimeStatus === 'SUBSCRIBED' ? 'زنده' : 'اتصال'}</span><button className="button button-ghost" disabled={muteBusy} onClick={() => void toggleConversationMute()}>{mutedUntilByConversation[activeConversation.id] ? 'فعال‌کردن اعلان‌ها' : 'بی‌صدا کردن ۸ ساعت'}</button>{activeConversation.kind !== 'direct' && (myRoleByConversation[activeConversation.id] === 'owner' || myRoleByConversation[activeConversation.id] === 'admin') && <button className="button button-ghost" onClick={() => { const next = !showMemberManager; setShowMemberManager(next); if (next) { void loadSpaceMembers(activeConversation.id); void loadJoinRequests(activeConversation.id); } }}>مدیریت اعضا</button>}</header>{showMemberManager && activeConversation.kind !== 'direct' && <div className="new-chat-box"><strong>اعضای گفتگو ({spaceMembers.length})</strong>{joinRequests.length > 0 && <section className="admin-user-list"><strong>درخواست‌های عضویت ({joinRequests.length})</strong>{joinRequests.map((request) => <div className="person-result" key={request.id}><Avatar profile={request.profile} size="sm"/><span><strong>{request.profile?.display_name ?? "کاربر"}</strong><small>درخواست عضویت در گروه</small></span><button type="button" className="button button-primary button-small" disabled={memberActionBusy} onClick={() => void reviewJoinRequest(request.id, "approved")}>پذیرش</button><button type="button" className="button button-ghost button-small" disabled={memberActionBusy} onClick={() => void reviewJoinRequest(request.id, "rejected")}>رد</button></div>)}</section>}<div className="admin-user-list">{spaceMembers.map((profile) => <div className="person-result" key={profile.id}><Avatar profile={profile} size="sm"/><span><strong>{profile.display_name}</strong><small>@{profile.username ?? 'بدون نام کاربری'} · {spaceMemberRoles[profile.id] === 'owner' ? 'سازنده' : spaceMemberRoles[profile.id] === 'admin' ? 'مدیر' : 'عضو'}</small></span>{spaceMemberRoles[profile.id] === 'member' && <button type="button" className="button button-ghost" disabled={memberActionBusy} onClick={() => void removeSpaceMember(profile.id)}>حذف عضو</button>}</div>)}</div><div className="search-input"><Search size={16}/><input value={memberSearch} onChange={(e) => void searchMembers(e.target.value)} placeholder="جستجوی نام یا نام کاربری برای افزودن…"/></div>{memberSearchResults.map((profile) => <button type="button" className="person-result" key={profile.id} disabled={memberActionBusy} onClick={() => void addSpaceMember(profile)}><Avatar profile={profile} size="sm"/><span><strong>{profile.display_name}</strong><small>@{profile.username ?? 'بدون نام کاربری'}</small></span><Plus size={16}/></button>)}<div className="admin-user-actions"><button type="button" className="button button-ghost" onClick={() => setShowMemberManager(false)}>بستن</button></div></div>}<div className="messages-scroll">{hasOlderMessages && <button className="load-older-button" onClick={() => void loadOlderMessages()} disabled={loadingOlder}>{loadingOlder ? 'در حال بارگذاری…' : 'نمایش پیام‌های قدیمی‌تر'}</button>}{messages.length === 0 ? <EmptyState icon={<MessageCircle/>} title="شروع یک گفتگوی تازه" description="اولین پیام را بنویس و گفتگو را آغاز کن."/> : messages.map((m) => <div key={m.id} className={`message-row ${m.sender_id === userId ? 'outgoing' : 'incoming'}`}><div className="message-bubble"><p>{m.body}</p>{(attachmentsByMessage[m.id] ?? []).map((file) => <button key={file.id} className="attachment-chip" onClick={() => void downloadAttachment(file)}><File size={15}/><span>{file.original_name}</span><ArrowDownToLine size={14}/></button>)}<small>{new Date(m.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}{m.sender_id === userId && (activeConversation.kind === 'direct' && Date.parse(peerReadAtByConversation[activeConversation.id] ?? '') >= Date.parse(m.created_at) ? <span className="message-read-status" title="خوانده‌شده" aria-label="خوانده‌شده">✓✓</span> : <Check size={13} aria-label="ارسال‌شده"/>)}</small></div></div>)}<div ref={bottomRef}/></div><form className="message-composer" onSubmit={send}><input ref={attachmentInputRef} type="file" className="visually-hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadAttachment(file); e.target.value = ''; }}/><button type="button" className="icon-button" title="پیوست فایل" onClick={() => attachmentInputRef.current?.click()}><Paperclip size={19}/></button><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="پیامت را بنویس…"/><button className="send-button" disabled={sending || !draft.trim()}><Send size={18}/></button></form></> : <EmptyState icon={<MessageCircle/>} title="یک گفتگو انتخاب کن" description="از فهرست سمت راست وارد گفتگو شو یا یک گفتگوی جدید بساز."/>}</section></div>;
}
