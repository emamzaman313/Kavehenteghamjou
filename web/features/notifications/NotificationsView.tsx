'use client';
import { Bell, CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Notify } from '@/lib/ui-types';
import { formatDate } from '@/lib/format';
import { EmptyState, SectionHeader } from '@/components/ui';

export default function NotificationsView({ supabase, userId, notify, onUnreadChange }: { supabase: SupabaseClient; userId: string; notify: Notify; onUnreadChange: (n: number) => void }) {
  const [rows, setRows] = useState<{ id: string; kind: string; payload: Record<string, unknown>; read_at: string | null; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { const { data, error } = await supabase.from('notifications').select('*').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(50); if (error) notify(error.message, 'error'); else { setRows(data ?? []); onUnreadChange((data ?? []).filter((r) => !r.read_at).length); } setLoading(false); }, [supabase, userId, notify, onUnreadChange]);
  useEffect(() => { void load(); }, [load]);
  const markRead = async (id: string) => { const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id); if (error) notify(error.message, 'error'); else void load(); };
  const markAll = async () => { const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', userId).is('read_at', null); if (error) notify(error.message, 'error'); else { notify('اعلان‌ها خوانده‌شده علامت خوردند.'); void load(); } };
  return <div className="page-stack"><SectionHeader eyebrow="به‌روزرسانی‌ها" title="اعلان‌ها" description="رویدادهای مرتبط با حساب و ارتباطاتت." action={<button className="button button-quiet" onClick={() => void markAll()}><CheckCheck size={16}/> خواندن همه</button>}/>{loading ? <div className="skeleton-card"/> : rows.length === 0 ? <EmptyState icon={<Bell/>} title="اعلان تازه‌ای نداری" description="وقتی رویدادی برای حسابت اتفاق بیفتد، اینجا می‌بینی."/> : <div className="notification-list">{rows.map((r) => <article key={r.id} className={`notification-row ${r.read_at ? '' : 'unread'}`}><div className="notification-icon"><Bell size={18}/></div><div><strong>{r.kind === 'admin_warning' ? 'اخطار مدیریتی' : r.kind === 'admin_ban' ? 'محدودیت حساب' : r.kind === 'admin_unban' ? 'رفع محدودیت' : r.kind === 'admin_role_changed' ? 'تغییر نقش مدیریتی' : r.kind === 'admin_role_removed' ? 'لغو دسترسی مدیریتی' : r.kind}</strong><p>{String(r.payload?.message ?? r.payload?.body ?? 'یک رویداد جدید برای حساب شما ثبت شده است.')}</p><small>{formatDate(r.created_at)}</small></div>{!r.read_at && <button className="button button-quiet button-small" onClick={() => void markRead(r.id)}>خوانده شد</button>}</article>)}</div>}</div>;
}
