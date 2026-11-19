'use client';
import {useCallback,useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Notify} from '@/lib/ui-types';
type Rank={id:string;name_fa:string;name_en:string;tier:number;description:string;category:string;badge_color:string;badge_icon:string;is_assignable:boolean};
type User={id:string;display_name:string;username:string|null;email:string|null};
export default function RankManagementPanel({supabase,notify}:{supabase:SupabaseClient;notify:Notify}){
 const [ranks,setRanks]=useState<Rank[]>([]),[users,setUsers]=useState<User[]>([]),[selected,setSelected]=useState(''),[rankId,setRankId]=useState('member'),[scope,setScope]=useState('global'),[scopeId,setScopeId]=useState(''),[expires,setExpires]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[audit,setAudit]=useState<{id:string;action:string;rank_id:string|null;target_user_id:string|null;created_at:string}[]>([]);
 const call=useCallback(async(action:string,extra:Record<string,unknown>={})=>{const {data,error}=await supabase.functions.invoke('rank-management',{body:{action,...extra}});if(error||data?.ok!==true)throw new Error(data?.reason??'request_failed');return data},[supabase]);
 const refresh=useCallback(async()=>{try{const [catalog,userList,logs]=await Promise.all([call('catalog'),supabase.functions.invoke('admin-console',{body:{action:'users_list'}}),call('audit')]);setRanks(catalog.ranks??[]);if(userList.data?.ok)setUsers(userList.data.users??[]);setAudit(logs.events??[])}catch{notify('دریافت اطلاعات رتبه‌ها ناموفق بود.','error')}},[call,supabase,notify]);
 useEffect(()=>{void refresh()},[refresh]);
 const assign=async()=>{if(!selected||busy)return;setBusy(true);try{await call('assign',{userId:selected,rankId,scopeType:scope,scopeId:scope==='global'?null:scopeId,expiresAt:expires?new Date(expires).toISOString():null,note});notify('رتبه با موفقیت به کاربر اعطا شد.');setNote('');await refresh()}catch(e){notify(e instanceof Error?e.message:'اعطای رتبه ناموفق بود.','error')}finally{setBusy(false)}};
 return <section className="settings-card"><h3>سامانه ۲۵ رتبه و مجوزها</h3><p>رتبه‌ها در دیتابیس ثبت می‌شوند. رتبه مالک کل قابل اعطا نیست و اعطای رتبه فقط برای مالک اصلی مجاز است.</p>
 <div className="admin-stat-grid">{ranks.map(r=><div className="admin-stat" key={r.id}><span style={{color:r.badge_color}}>◆ رتبه {r.tier}</span><strong>{r.name_fa}</strong><small>{r.description}</small></div>)}</div>
 <h3>اعطای رتبه</h3><label className="auth-label">کاربر</label><select className="auth-input" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">انتخاب کاربر</option>{users.map(u=><option key={u.id} value={u.id}>{u.display_name+(u.username?' (@'+u.username+')':'')+(u.email?' · '+u.email:'')}</option>)}</select>
 <label className="auth-label">رتبه</label><select className="auth-input" value={rankId} onChange={e=>setRankId(e.target.value)}>{ranks.filter(r=>r.is_assignable).map(r=><option key={r.id} value={r.id}>{r.tier+'. '+r.name_fa}</option>)}</select>
 <label className="auth-label">محدوده</label><select className="auth-input" value={scope} onChange={e=>setScope(e.target.value)}><option value="global">سراسری</option><option value="group">گروه مشخص</option><option value="channel">کانال مشخص</option></select>
 {scope!=='global'&&<input className="auth-input" value={scopeId} onChange={e=>setScopeId(e.target.value)} placeholder="شناسه UUID گروه یا کانال"/>}
 <label className="auth-label">انقضا (اختیاری)</label><input className="auth-input" type="datetime-local" value={expires} onChange={e=>setExpires(e.target.value)}/>
 <label className="auth-label">یادداشت</label><input className="auth-input" value={note} onChange={e=>setNote(e.target.value)} maxLength={500} placeholder="دلیل اعطای رتبه"/>
 <button className="button button-primary" disabled={busy||!selected||(scope!=='global'&&!scopeId)} onClick={()=>void assign()}>{busy?'در حال ثبت…':'اعطای رتبه'}</button>
 <h3>سوابق رتبه‌ها</h3>{audit.slice(0,30).map(a=><div className="admin-activity-row" key={a.id}><span className="admin-activity-dot"/><div><b>{a.action+' · '+(ranks.find(r=>r.id===a.rank_id)?.name_fa??a.rank_id??'—')}</b><small>{(a.target_user_id??'—')+' · '+new Date(a.created_at).toLocaleString('fa-IR')}</small></div></div>)}</section>
}