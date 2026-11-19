'use client';

import { LifeBuoy, MessageCircle, Plus, Send, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Notify } from '@/lib/ui-types';

type Ticket = {
  id: string; conversation_id: string; requester_id: string; assigned_to: string | null;
  subject: string; category: string; status: string; priority: string; created_at: string; updated_at: string; last_message_at: string;
  requester?: { display_name: string; username: string | null } | null;
};
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };\ntype ReadCursor = { conversation_id: string; last_read_at: string | null };

const statusLabels: Record<string,string> = { open:'جدید', in_progress:'در حال بررسی', waiting_user:'منتظر پاسخ شما', resolved:'حل‌شده', closed:'بسته‌شده' };
const categoryLabels: Record<string,string> = { general:'عمومی', account:'حساب کاربری', technical:'مشکل فنی', report:'گزارش تخلف', billing:'مالی', other:'سایر' };

export default function SupportCenter({ supabase, userId, notify, staff = false }: {
  supabase: SupabaseClient; userId: string; notify: Notify; staff?: boolean;
}) {
  const [tickets,setTickets] = useState<Ticket[]>([]);\n  const [unreadTickets,setUnreadTickets] = useState<Record<string,boolean>>({});
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
    const {data,error} = await supabase.rpc('create_support_ticket',{p_subject:subject.trim(),p_category:category,p_body:body.trim()});
    setCreating(false);
    if (error || !data) { notify('ثبت درخواست ناموفق بود: '+(error?.message ?? 'خطای نامشخص'),'error'); return; }
    setSubject(''); setBody(''); setCategory('general'); setShowNew(false);
    await refresh();
    setActive(data as string);
    notify('درخواست پشتیبانی ثبت شد.');
  };

  const sendReply = async (event:FormEvent) => {
    event.preventDefault();
    const ticket = tickets.find(x=>x.id===active);
    const text = reply.trim();
    if (!ticket || !text || sending) return;
    setSending(true);
    const {error} = await supabase.from('messages').insert({conversation_id:ticket.conversation_id,sender_id:userId,body:text,format:'plain'});
    setSending(false);
    if (error) { notify('ارسال پاسخ ناموفق بود: '+error.message,'error'); return; }
    setReply('');
    await loadMessages(ticket.id);
    await refresh();
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
    <div className="panel-card" style={{padding:18}}>
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
      <div className="panel-card" style={{padding:12,minWidth:0}}>
        <strong style={{display:'block',padding:8,marginBottom:6}}>درخواست‌ها ({tickets.length})</strong>
        {loading ? <p>در حال دریافت…</p> : tickets.length===0 ? <p style={{padding:10,color:'var(--muted)',fontSize:11}}>هنوز درخواستی ثبت نشده است.</p> : tickets.map(ticket=><button key={ticket.id} type="button" onClick={()=>setActive(ticket.id)} style={{display:'grid',width:'100%',textAlign:'right',gap:6,padding:12,marginBottom:7,borderRadius:12,border:active===ticket.id?'1px solid var(--accent)':'1px solid var(--line)',background:active===ticket.id?'rgba(22,139,255,.09)':'transparent',color:'var(--text)',cursor:'pointer'}}>
          <span style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><strong style={{fontSize:12}}>{ticket.subject}</strong>{unreadTickets[ticket.id] && <span aria-label="پیام خوانده‌نشده" style={{fontSize:9,background:'var(--accent)',color:'#fff',borderRadius:999,padding:'3px 7px',whiteSpace:'nowrap'}}>جدید</span>}</span>
          {staff && <small style={{color:'var(--muted)'}}>{ticket.requester?.display_name ?? ticket.requester_id.slice(0,8)}{ticket.requester?.username?' · @'+ticket.requester.username:''}</small>}
          <span style={{fontSize:10,color:'var(--muted)'}}>{categoryLabels[ticket.category]??ticket.category} · {statusLabels[ticket.status]??ticket.status} · اولویت {ticket.priority==='urgent'?'فوری':ticket.priority==='high'?'بالا':ticket.priority==='low'?'پایین':'عادی'}</span>
          <small style={{color:'var(--muted)'}}>{new Date(ticket.last_message_at).toLocaleString('fa-IR')}</small>
        </button>)}
      </div>
      <div className="panel-card" style={{padding:16,minWidth:0}}>
        {!selected ? <div style={{minHeight:220,display:'grid',placeItems:'center',color:'var(--muted)',textAlign:'center'}}><div><MessageCircle size={30}/><p>برای مشاهده گفتگو، یک درخواست را انتخاب کنید.</p></div></div> : <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap',borderBottom:'1px solid var(--line)',paddingBottom:12}}>
            <div><strong>{selected.subject}</strong><p style={{fontSize:10,color:'var(--muted)',margin:'5px 0 0'}}>وضعیت: {statusLabels[selected.status]??selected.status} · {categoryLabels[selected.category]??selected.category}</p></div>
            {staff && <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
              <select aria-label="وضعیت درخواست" value={selected.status} onChange={e=>void updateTicketField('status',e.target.value)} style={{maxWidth:155}}><option value="open">جدید</option><option value="in_progress">در حال بررسی</option><option value="waiting_user">منتظر پاسخ کاربر</option><option value="resolved">حل‌شده</option><option value="closed">بسته‌شده</option></select>
              <select aria-label="اولویت درخواست" value={selected.priority} onChange={e=>void updateTicketField('priority',e.target.value)} style={{maxWidth:125}}><option value="low">اولویت پایین</option><option value="normal">اولویت عادی</option><option value="high">اولویت بالا</option><option value="urgent">فوری</option></select>
            </div>}
          </div>
          <div style={{display:'grid',gap:9,padding:'14px 0',maxHeight:430,overflowY:'auto'}}>
            {messages.map(message=><div key={message.id} style={{justifySelf:message.sender_id===userId?'end':'start',maxWidth:'88%',padding:'10px 12px',borderRadius:13,background:message.sender_id===userId?'rgba(22,139,255,.14)':'var(--surface-2,rgba(127,127,127,.12))',border:'1px solid var(--line)'}}>
              <p style={{margin:0,fontSize:12,lineHeight:1.9,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{message.body}</p>
              <small style={{display:'block',marginTop:5,color:'var(--muted)',fontSize:9}}>{message.sender_id===userId?'شما':staff?'کاربر':'پشتیبانی'} · {new Date(message.created_at).toLocaleString('fa-IR')}</small>
            </div>)}
          </div>
          {selected.status!=='closed' && <form onSubmit={sendReply} style={{display:'flex',gap:8,borderTop:'1px solid var(--line)',paddingTop:12}}>
            <input value={reply} onChange={e=>setReply(e.target.value)} maxLength={10000} placeholder="پیام خود را بنویسید…" aria-label="پیام پاسخ" />
            <button className="button button-primary" type="submit" disabled={sending||!reply.trim()}><Send size={15}/>{sending?'ارسال…':'ارسال'}</button>
          </form>}
          {selected.status==='resolved' && !staff && <p style={{fontSize:10,color:'var(--muted)'}}>این درخواست حل‌شده علامت‌گذاری شده است؛ برای ادامه گفتگو می‌توانید پاسخ ارسال کنید.</p>}
        </>}
      </div>
    </div>
  </section>;
}
