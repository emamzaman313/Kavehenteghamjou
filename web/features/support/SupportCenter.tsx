'use client';

import { LifeBuoy, MessageCircle, Plus, Send, RefreshCw, Paperclip, Download } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Notify } from '@/lib/ui-types';
import { filterSupportTickets } from '@/lib/support-ticket-filters';
import { useOperationProgress } from '@/components/OperationProgress';

type Ticket = {
  id: string; conversation_id: string; requester_id: string; assigned_to: string | null;
  subject: string; category: string; status: string; priority: string; created_at: string; updated_at: string; last_message_at: string;
  requester?: { display_name: string; username: string | null } | null;
};
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
type ReadCursor = { conversation_id: string; last_read_at: string | null };
type SupportAttachment = { id:string; original_name:string; bucket_id:string; object_path:string; mime_type:string|null; byte_size:number };

const statusLabels: Record<string,string> = { open:'جدید', in_progress:'در حال بررسی', waiting_user:'منتظر پاسخ شما', resolved:'حل‌شده', closed:'بسته‌شده' };
const categoryLabels: Record<string,string> = { general:'عمومی', account:'حساب کاربری', technical:'مشکل فنی', report:'گزارش تخلف', billing:'مالی', other:'سایر' };

export default function SupportCenter({ supabase, userId, notify, staff = false }: {
  supabase: SupabaseClient; userId: string; notify: Notify; staff?: boolean;
}) {
  const [tickets,setTickets] = useState<Ticket[]>([]);
  const [ticketSearch,setTicketSearch] = useState('');
  const [statusFilter,setStatusFilter] = useState('all');
  const [priorityFilter,setPriorityFilter] = useState('all');
  const [unreadTickets,setUnreadTickets] = useState<Record<string,boolean>>({});
  const [attachments,setAttachments] = useState<Record<string,{file:SupportAttachment;url:string}[]>>({});
  const [uploading,setUploading] = useState(false);
  const [active,setActive] = useState<string|null>(null);
  const [messages,setMessages] = useState<Message[]>([]);
  const [loading,setLoading] = useState(true);
  const [sending,setSending] = useState(false);
  const [subject,setSubject] = useState('');
  const [category,setCategory] = useState('general');
  const [body,setBody] = useState('');
  const [reply,setReply] = useState('');
  const [creating,setCreating] = useState(false);
  const [showNew,setShowNew] = useState(false);

  const { runOperation } = useOperationProgress();

  const filteredTickets = filterSupportTickets(tickets, {
    search: ticketSearch,
    status: statusFilter,
    priority: priorityFilter,
    staff,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('support_tickets').select('*').order('last_message_at',{ascending:false});
    if (!staff) query = query.eq('requester_id',userId);
    const {data,error} = await query.limit(100);
    if (error) notify('دریافت درخواست‌های پشتیبانی ناموفق بود: '+error.message,'error');
    else {
      const rows = (data ?? []) as Ticket[];
      if (staff && rows.length) {
        const ids = [...new Set(rows.map(x=>x.requester_id))];
        const {data:profiles} = await supabase.from('profiles').select('id,display_name,username').in('id',ids);
        const map: Record<string,{display_name:string;username:string|null}> = {};
        (profiles ?? []).forEach(p=>{ map[p.id] = p; });
        rows.forEach(row=>{ row.requester = map[row.requester_id] ?? null; });
      }
      setTickets(rows);
      if (rows.length) {
        const conversationIds = rows.map(row=>row.conversation_id);
        const [{data:cursors}, {data:recentMessages}] = await Promise.all([
          supabase.from('conversation_members').select('conversation_id,last_read_at')
            .eq('user_id',userId).in('conversation_id',conversationIds),
          supabase.from('messages').select('conversation_id,sender_id,created_at')
            .in('conversation_id',conversationIds).is('deleted_at',null)
            .order('created_at',{ascending:false}).limit(Math.min(500,rows.length*5)),
        ]);
        const cursorByConversation = new Map(((cursors ?? []) as ReadCursor[]).map(cursor=>[cursor.conversation_id,cursor.last_read_at]));
        const latestByConversation = new Map<string,{sender_id:string;created_at:string}>();
        (recentMessages ?? []).forEach(message=>{
          if (!latestByConversation.has(message.conversation_id)) latestByConversation.set(message.conversation_id,message);
        });
        const unread: Record<string,boolean> = {};
        rows.forEach(row=>{
          const latest = latestByConversation.get(row.conversation_id);
          const lastReadAt = cursorByConversation.get(row.conversation_id);
          unread[row.id] = !!latest && latest.sender_id !== userId &&
            (!lastReadAt || new Date(latest.created_at).getTime() > new Date(lastReadAt).getTime());
        });
        setUnreadTickets(unread);
      } else setUnreadTickets({});
      if (active && !rows.some(x=>x.id===active)) setActive(null);
    }
    setLoading(false);
  },[supabase,userId,staff,notify,active]);

  const loadMessages = useCallback(async (ticketId:string) => {
    const ticket = tickets.find(x=>x.id===ticketId);
    if (!ticket) return;
    const {data,error} = await supabase.from('messages').select('id,conversation_id,sender_id,body,created_at')
      .eq('conversation_id',ticket.conversation_id).is('deleted_at',null).order('created_at',{ascending:true}).limit(300);
    if (error) notify('دریافت پیام‌های پشتیبانی ناموفق بود: '+error.message,'error');
    else {
      const loaded = (data ?? []) as Message[];
      setMessages(loaded);
      const messageIds = loaded.map(message=>message.id);
      if (messageIds.length) {
        const {data:links,error:linksError} = await supabase.from('message_attachments')
          .select('message_id,file_asset_id').in('message_id',messageIds);
        if (linksError) notify('دریافت پیوست‌های گفتگو ناموفق بود: '+linksError.message,'error');
        const fileIds = [...new Set((links ?? []).map(link=>link.file_asset_id))];
        if (fileIds.length) {
          const {data:assets,error:assetsError} = await supabase.from('file_assets')
            .select('id,original_name,bucket_id,object_path,mime_type,byte_size').in('id',fileIds);
          if (assetsError) notify('دریافت اطلاعات فایل‌ها ناموفق بود: '+assetsError.message,'error');
          const assetMap = new Map((assets ?? []).map(file=>[file.id,file as SupportAttachment]));
          const grouped: Record<string,{file:SupportAttachment;url:string}[]> = {};
          for (const link of links ?? []) {
            const file = assetMap.get(link.file_asset_id);
            if (!file) continue;
            const {data:signed,error:signedError} = await supabase.storage.from(file.bucket_id)
              .createSignedUrl(file.object_path,300,{download:file.original_name});
            if (signedError || !signed?.signedUrl) continue;
            grouped[link.message_id] = [...(grouped[link.message_id] ?? []),{file,url:signed.signedUrl}];
          }
          setAttachments(current=>({...current,...grouped}));
        }
      }
      const latestFetchedAt = loaded[loaded.length - 1]?.created_at;
      if (latestFetchedAt) {
        const {error:readError} = await supabase.from('conversation_members')
          .update({last_read_at:latestFetchedAt})
          .eq('conversation_id',ticket.conversation_id).eq('user_id',userId);
        if (readError) console.warn('Could not advance support read cursor:',readError.message);
      }
    }
  },[supabase,tickets,notify,userId]);

  useEffect(()=>{ void refresh(); },[refresh]);
  useEffect(()=>{
    const channel = supabase.channel('support-inbox:'+userId)
      .on('postgres_changes',{event:'*',schema:'public',table:'support_tickets'},()=>{ void refresh(); })
      .subscribe();
    return ()=>{ void supabase.removeChannel(channel); };
  },[supabase,userId,refresh]);
  useEffect(()=>{
    if (!active) { setMessages([]); return; }
    void loadMessages(active);
    const ticket = tickets.find(x=>x.id===active);
    if (!ticket) return;
    const channel = supabase.channel('support-thread:'+ticket.conversation_id)
      .on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:'conversation_id=eq.'+ticket.conversation_id},()=>{ void loadMessages(active); void refresh(); })
      .subscribe();
    return ()=>{ void supabase.removeChannel(channel); };
  },[active,tickets,supabase,loadMessages,refresh]);

  const createTicket = async (event:FormEvent) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const ticketId = await runOperation('ثبت درخواست پشتیبانی', async advance => {
        advance(18, 'اعتبارسنجی عنوان و شرح درخواست');
        const {data,error} = await supabase.rpc('create_support_ticket',{p_subject:subject.trim(),p_category:category,p_body:body.trim()});
        if (error || !data) throw error ?? new Error('کد پیگیری درخواست دریافت نشد.');
        advance(78, 'درخواست در سرور ثبت شد؛ دریافت اطلاعات تازه');
        return data as string;
      });
      setSubject(''); setBody(''); setCategory('general'); setShowNew(false);
      await refresh();
      setActive(ticketId);
      notify('درخواست پشتیبانی ثبت شد.');
    } catch (cause) {
      notify('ثبت درخواست ناموفق بود: '+(cause instanceof Error?cause.message:'خطای نامشخص'),'error');
    } finally { setCreating(false); }
  };

  const sendReply = async (event:FormEvent) => {
    event.preventDefault();
    const ticket = tickets.find(x=>x.id===active);
    const text = reply.trim();
    if (!ticket || !text || sending) return;
    setSending(true);
    try {
      const messageId = await runOperation('ارسال پاسخ پشتیبانی', async advance => {
        advance(20, 'آماده‌سازی پاسخ');
        const {data:sentMessage,error} = await supabase.from('messages')
          .insert({conversation_id:ticket.conversation_id,sender_id:userId,body:text,format:'plain'})
          .select('id').single();
        if (error || !sentMessage?.id) throw error ?? new Error('شناسه پیام دریافت نشد.');
        advance(78, 'پاسخ در گفتگو ثبت شد');
        return sentMessage.id;
      });
      void supabase.functions.invoke('notification-dispatch',{body:{message_id:messageId}});
      setReply('');
      await loadMessages(ticket.id);
      await refresh();
    } catch (cause) {
      notify('ارسال پاسخ ناموفق بود: '+(cause instanceof Error?cause.message:'خطای نامشخص'),'error');
    } finally { setSending(false); }
  };

  const sendAttachment = async (file:File) => {
    const ticket = tickets.find(x=>x.id===active);
    if (!ticket || uploading) return;
    if (file.size===0 || file.size>50*1024*1024) {
      notify('اندازه فایل باید بیشتر از صفر و حداکثر ۵۰ مگابایت باشد.','error');
      return;
    }
    setUploading(true);
    let path:string|null=null;
    let assetId:string|null=null;
    let messageId:string|null=null;
    let attachmentCommitted=false;
    let rollbackSafe=true;
    try {
      await runOperation('ارسال پیوست پشتیبانی', async advance => {
        const safeName = file.name.split('/').join('_').split(String.fromCharCode(92)).join('_').replace(/[\u0000-\u001f]/g,'_').slice(0,180) || 'attachment';
        advance(12, 'محاسبه صحت فایل و آماده‌سازی اطلاعات');
        const bytes = await file.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256',bytes);
        const hash = Array.from(new Uint8Array(digest)).map(value=>value.toString(16).padStart(2,'0')).join('');
        path = userId+'/'+crypto.randomUUID();
        advance(28, 'بارگذاری فایل در فضای خصوصی');
        const {error:uploadError} = await supabase.storage.from('user-files').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
        if (uploadError) throw uploadError;
        advance(58, 'ثبت مشخصات و اثرانگشت فایل');
        const {data:asset,error:assetError} = await supabase.from('file_assets').insert({
          owner_id:userId,bucket_id:'user-files',object_path:path,original_name:safeName,
          mime_type:file.type||null,byte_size:file.size,sha256_hex:hash,status:'ready'
        }).select('id').single();
        if (assetError || !asset) throw assetError ?? new Error('ثبت مشخصات فایل ناموفق بود.');
        assetId = asset.id;
        const {data:message,error:messageError} = await supabase.from('messages').insert({
          conversation_id:ticket.conversation_id,sender_id:userId,body:'📎 '+safeName,format:'plain'
        }).select('id').single();
        if (messageError || !message) throw messageError ?? new Error('ثبت پیام پیوست ناموفق بود.');
        messageId = message.id;
        advance(78, 'پیام ایجاد شد؛ اتصال امن فایل به گفتگو');
        const {error:linkError} = await supabase.from('message_attachments').insert({message_id:message.id,file_asset_id:asset.id,display_order:0});
        if (linkError) {
          const {data:existingLink,error:verifyError} = await supabase.from('message_attachments')
            .select('message_id').eq('message_id',message.id).eq('file_asset_id',asset.id).maybeSingle();
          if (verifyError) {
            rollbackSafe = false;
            throw new Error('نتیجه اتصال فایل نامشخص است؛ برای جلوگیری از حذف فایل احتمالا ارسال‌شده، پاک‌سازی خودکار انجام نشد.');
          }
          if (!existingLink) throw linkError;
        }
        attachmentCommitted = true;
        advance(90, 'پیوست در گفتگو ثبت شد؛ همگام‌سازی نمایش');
        void supabase.functions.invoke('notification-dispatch',{body:{message_id:message.id}});
        await loadMessages(ticket.id);
        await refresh();
      });
      notify('فایل به گفتگوی پشتیبانی پیوست شد.');
    } catch (error) {
      if (!attachmentCommitted && rollbackSafe) {
        if (messageId) await supabase.from('messages').delete().eq('id',messageId);
        if (assetId) await supabase.from('file_assets').delete().eq('id',assetId);
        if (path) await supabase.storage.from('user-files').remove([path]);
      }
      notify('ارسال فایل ناموفق بود: '+(error instanceof Error?error.message:'خطای نامشخص'),'error');
    } finally { setUploading(false); }
  };

  const updateTicketField = async (field:'status'|'priority', value:string) => {
    if (!active || !staff) return;
    const patch = field==='status'
      ? {status:value,updated_at:new Date().toISOString(),resolved_at:value==='resolved'?new Date().toISOString():null}
      : {priority:value,updated_at:new Date().toISOString()};
    const {error} = await supabase.from('support_tickets').update(patch).eq('id',active);
    if (error) notify('به‌روزرسانی درخواست ناموفق بود: '+error.message,'error');
    else { notify('درخواست به‌روزرسانی شد.'); await refresh(); }
  };

  const selected = tickets.find(x=>x.id===active);
  return <section className="support-center" style={{display:'grid',gap:16,minWidth:0}}>
    <div className="panel-card support-header" style={{padding:18}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}><LifeBuoy size={24}/><div><strong>{staff?'صندوق پشتیبانی کاربران':'پشتیبانی و ارتباط با مدیریت'}</strong><p style={{margin:'5px 0 0',color:'var(--muted)',fontSize:11}}>{staff?'درخواست‌های کاربران را مشاهده و پاسخ دهید.':'درخواست خود را ثبت کنید و پاسخ مدیریت را همین‌جا دریافت کنید.'}</p></div></div>
        <div style={{display:'flex',gap:8}}><button className="button button-quiet" type="button" onClick={()=>void refresh()}><RefreshCw size={15}/> تازه‌سازی</button>{!staff && <button className="button button-primary" type="button" onClick={()=>setShowNew(x=>!x)}><Plus size={15}/> درخواست جدید</button>}</div>
      </div>
    </div>
    {showNew && !staff && <form className="panel-card" style={{padding:18,display:'grid',gap:12}} onSubmit={createTicket}>
      <strong>ثبت درخواست جدید</strong>
      <input required minLength={3} maxLength={180} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="موضوع درخواست"/>
      <select value={category} onChange={e=>setCategory(e.target.value)}><option value="general">عمومی</option><option value="account">حساب کاربری</option><option value="technical">مشکل فنی</option><option value="report">گزارش تخلف</option><option value="billing">مالی</option><option value="other">سایر</option></select>
      <textarea required maxLength={10000} rows={4} value={body} onChange={e=>setBody(e.target.value)} placeholder="مشکل یا درخواست خود را با جزئیات بنویسید…"/>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><button className="button button-quiet" type="button" onClick={()=>setShowNew(false)}>انصراف</button><button className="button button-primary" disabled={creating} type="submit">{creating?'در حال ثبت…':'ثبت درخواست'}</button></div>
    </form>}
    <div className="support-center-layout">
      <div className="panel-card support-ticket-list" style={{padding:12,minWidth:0}}>
        <strong style={{display:'block',padding:8,marginBottom:6}}>درخواست‌ها ({filteredTickets.length} از {tickets.length})</strong>
        <input
          className="field-input"
          value={ticketSearch}
          onChange={event=>setTicketSearch(event.target.value)}
          placeholder={staff?'جست‌وجو بر اساس موضوع، کاربر یا شناسه…':'جست‌وجو در درخواست‌ها…'}
          aria-label="جست‌وجو در درخواست‌های پشتیبانی"
          style={{width:'100%',marginBottom:9}}
        />
        <div style={{display:'flex',gap:6,overflowX:'auto',padding:'2px 2px 9px',marginBottom:4}}>
          {([{value:'all',label:'همه'},{value:'open',label:'جدید'},{value:'in_progress',label:'در حال بررسی'},{value:'waiting_user',label:'منتظر پاسخ'},{value:'resolved',label:'حل‌شده'},{value:'closed',label:'بسته'}] as const).map(item=>{
            const count = item.value==='all' ? tickets.length : tickets.filter(ticket=>ticket.status===item.value).length;
            return <button key={item.value} type="button" className={statusFilter===item.value?'button button-primary':'button button-quiet'} onClick={()=>setStatusFilter(item.value)} style={{whiteSpace:'nowrap',fontSize:10,padding:'6px 9px',minHeight:32}}>{item.label} {count}</button>;
          })}
        </div>
        {staff && <div style={{display:'flex',gap:6,overflowX:'auto',padding:'2px 2px 9px',marginBottom:4}}>
          {([{value:'all',label:'همه اولویت‌ها'},{value:'urgent',label:'فوری'},{value:'high',label:'بالا'},{value:'normal',label:'عادی'},{value:'low',label:'پایین'}] as const).map(item=>{
            const count = item.value==='all' ? tickets.length : tickets.filter(ticket=>ticket.priority===item.value).length;
            return <button key={item.value} type="button" className={priorityFilter===item.value?'button button-primary':'button button-quiet'} onClick={()=>setPriorityFilter(item.value)} style={{whiteSpace:'nowrap',fontSize:10,padding:'6px 9px',minHeight:32}}>{item.label} {count}</button>;
          })}
        </div>}
        {loading ? <p>در حال دریافت…</p> : filteredTickets.length===0 ? <p style={{padding:10,color:'var(--muted)',fontSize:11}}>{tickets.length===0?'هنوز درخواستی ثبت نشده است.':'درخواستی با این فیلتر یا عبارت جست‌وجو پیدا نشد.'}</p> : filteredTickets.map(ticket=><button className="support-ticket-item" key={ticket.id} type="button" onClick={()=>setActive(ticket.id)} style={{display:'grid',width:'100%',textAlign:'right',gap:6,padding:12,marginBottom:7,borderRadius:12,border:active===ticket.id?'1px solid var(--accent)':'1px solid var(--line)',background:active===ticket.id?'rgba(22,139,255,.09)':'transparent',color:'var(--text)',cursor:'pointer'}}>
          <span style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><strong style={{fontSize:12}}>{ticket.subject}</strong>{unreadTickets[ticket.id] && <span aria-label="پیام خوانده‌نشده" style={{fontSize:9,background:'var(--accent)',color:'#fff',borderRadius:999,padding:'3px 7px',whiteSpace:'nowrap'}}>جدید</span>}</span>
          {staff && <small style={{color:'var(--muted)'}}>{ticket.requester?.display_name ?? ticket.requester_id.slice(0,8)}{ticket.requester?.username?' · @'+ticket.requester.username:''}</small>}
          <span style={{fontSize:10,color:'var(--muted)'}}>{categoryLabels[ticket.category]??ticket.category} · {statusLabels[ticket.status]??ticket.status} · اولویت {ticket.priority==='urgent'?'فوری':ticket.priority==='high'?'بالا':ticket.priority==='low'?'پایین':'عادی'}</span>
          <small style={{color:'var(--muted)'}}>{new Date(ticket.last_message_at).toLocaleString('fa-IR')}</small>
        </button>)}
      </div>
      <div className="panel-card support-thread" style={{padding:16,minWidth:0}}>
        {!selected ? <div className="support-empty" style={{minHeight:220,display:'grid',placeItems:'center',color:'var(--muted)',textAlign:'center'}}><div><MessageCircle size={30}/><p>برای مشاهده گفتگو، یک درخواست را انتخاب کنید.</p></div></div> : <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap',borderBottom:'1px solid var(--line)',paddingBottom:12}}>
            <div><strong>{selected.subject}</strong><p style={{fontSize:10,color:'var(--muted)',margin:'5px 0 0'}}>وضعیت: {statusLabels[selected.status]??selected.status} · {categoryLabels[selected.category]??selected.category}</p></div>
            {staff && <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
              <select aria-label="وضعیت درخواست" value={selected.status} onChange={e=>void updateTicketField('status',e.target.value)} style={{maxWidth:155}}><option value="open">جدید</option><option value="in_progress">در حال بررسی</option><option value="waiting_user">منتظر پاسخ کاربر</option><option value="resolved">حل‌شده</option><option value="closed">بسته‌شده</option></select>
              <select aria-label="اولویت درخواست" value={selected.priority} onChange={e=>void updateTicketField('priority',e.target.value)} style={{maxWidth:125}}><option value="low">اولویت پایین</option><option value="normal">اولویت عادی</option><option value="high">اولویت بالا</option><option value="urgent">فوری</option></select>
            </div>}
          </div>
          <div style={{display:'grid',gap:9,padding:'14px 0',maxHeight:430,overflowY:'auto'}}>
            {messages.map(message=><div className="support-message" key={message.id} style={{justifySelf:message.sender_id===userId?'end':'start',maxWidth:'88%',padding:'10px 12px',borderRadius:13,background:message.sender_id===userId?'rgba(22,139,255,.14)':'var(--surface-2,rgba(127,127,127,.12))',border:'1px solid var(--line)'}}>
              <p style={{margin:0,fontSize:12,lineHeight:1.9,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{message.body}</p>
              {(attachments[message.id]??[]).map(({file,url})=><a key={file.id} href={url} target="_blank" rel="noopener noreferrer" download={file.original_name} style={{display:'flex',alignItems:'center',gap:7,marginTop:8,padding:8,borderRadius:9,background:'var(--surface-2,rgba(127,127,127,.12))',color:'var(--accent)',fontSize:11,textDecoration:'none',overflowWrap:'anywhere'}}><Download size={14}/><span>{file.original_name} · {(file.byte_size/1024/1024).toFixed(2)} MB</span></a>)}
              <small style={{display:'block',marginTop:5,color:'var(--muted)',fontSize:9}}>{message.sender_id===userId?'شما':staff?'کاربر':'پشتیبانی'} · {new Date(message.created_at).toLocaleString('fa-IR')}</small>
            </div>)}
          </div>
          {selected.status!=='closed' && <div style={{display:'grid',gap:8,borderTop:'1px solid var(--line)',paddingTop:12}}>
            <form className="support-composer" onSubmit={sendReply} style={{display:'flex',gap:8}}>
              <input value={reply} onChange={e=>setReply(e.target.value)} maxLength={10000} placeholder="پیام خود را بنویسید…" aria-label="پیام پاسخ" />
              <button className="button button-primary" type="submit" disabled={sending||!reply.trim()}><Send size={15}/>{sending?'ارسال…':'ارسال'}</button>
            </form>
            <label style={{display:'inline-flex',alignItems:'center',gap:8,fontSize:11,color:'var(--muted)',cursor:uploading?'wait':'pointer',width:'fit-content'}}>
              <Paperclip size={15}/>{uploading?'در حال بارگذاری فایل…':'افزودن فایل (حداکثر ۵۰ مگابایت)'}
              <input type="file" disabled={uploading} onChange={event=>{const file=event.target.files?.[0];if(file)void sendAttachment(file);event.currentTarget.value='';}} style={{position:'absolute',width:1,height:1,opacity:0,pointerEvents:'none'}}/>
            </label>
          </div>}
          {selected.status==='resolved' && !staff && <p style={{fontSize:10,color:'var(--muted)'}}>این درخواست حل‌شده علامت‌گذاری شده است؛ برای ادامه گفتگو می‌توانید پاسخ ارسال کنید.</p>}
        </>}
      </div>
    </div>
  </section>;
}
