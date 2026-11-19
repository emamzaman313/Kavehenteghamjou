'use client';

import { Activity, Ban, CheckCircle2, Eye, EyeOff, Film, Flag, KeyRound, LayoutDashboard, MessageCircle, Save, ShieldCheck, Trash2, Users, Palette, RotateCcw, Music2, ListMusic, Megaphone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Notify } from '@/lib/ui-types';
import { SectionHeader } from '@/components/ui';
import { isValidAccessCode, normalizeAccessCode } from '@/lib/access-code';
import RankManagementPanel from '@/features/admin/RankManagementPanel';

export default function AdminAccessCodePanel({ supabase, notify, role }: { supabase: SupabaseClient; notify: Notify; role: 'owner' | 'admin' | 'moderator' }) {
  const [enabled, setEnabled] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [adminTab, setAdminTab] = useState<'overview' | 'users' | 'posts' | 'reports' | 'audit' | 'media' | 'notifications' | 'access' | 'appearance' | 'ranks' | 'features'>('overview');
  const [featureFlags, setFeatureFlags] = useState<{key:string;title:string;description:string;enabled:boolean;updated_at:string}[]>([]);
  const [featureFlagsLoading, setFeatureFlagsLoading] = useState(false);
  const [featureBusy, setFeatureBusy] = useState<string|null>(null);
  const [liveStatsConnected, setLiveStatsConnected] = useState(false);
  const [auditRows, setAuditRows] = useState<{ id: string; actor_id: string | null; action: string; target_type: string; target_id: string; status: string; details: Record<string, unknown>; created_at: string; completed_at: string | null }[]>([]);
  const [audioTracks, setAudioTracks] = useState<{ id: string; title: string; artist: string; audio_path: string; cover_path: string | null; duration_seconds: number | null; is_active: boolean; created_at: string }[]>([]);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackArtist, setNewTrackArtist] = useState('');
  const [newTrackAudio, setNewTrackAudio] = useState<File | null>(null);
  const [newTrackCover, setNewTrackCover] = useState<File | null>(null);
  const [trackSaving, setTrackSaving] = useState(false);
  const [musicRightsConfirmed, setMusicRightsConfirmed] = useState(false);
  const [managedReels, setManagedReels] = useState<{ id: string; author_id: string; caption: string; visibility: string; views_count: number; published_at: string; created_at: string }[]>([]);

  const [mediaLoading, setMediaLoading] = useState(false);
  const [scheduledRows, setScheduledRows] = useState<{ id: string; title: string; body: string; audience: 'all' | 'admins' | 'specific'; recipient_ids: string[]; scheduled_at: string; status: string; sent_at: string | null; error_message: string | null; created_at: string; category?: string; image_path?: string | null; priority?: string; channels?: { in_app?: boolean; push?: boolean; email?: boolean }; platform_target?: string; push_sent?: number; in_app_sent?: number }[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [scheduledSaving, setScheduledSaving] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementAudience, setAnnouncementAudience] = useState<'all' | 'admins' | 'specific'>('all');
  const [announcementRecipients, setAnnouncementRecipients] = useState('');
  const [announcementAt, setAnnouncementAt] = useState('');
  const [announcementCategory, setAnnouncementCategory] = useState('general');
  const [announcementPriority, setAnnouncementPriority] = useState<'normal' | 'high'>('normal');
  const [announcementPlatform, setAnnouncementPlatform] = useState<'all' | 'android'>('all');
  const [announcementImage, setAnnouncementImage] = useState<File | null>(null);
  const [announcementInApp, setAnnouncementInApp] = useState(true);
  const [announcementPush, setAnnouncementPush] = useState(true);
  const [announcementEmail, setAnnouncementEmail] = useState(false);


  const [managedUsers, setManagedUsers] = useState<{
    id: string; email: string | null; is_anonymous: boolean; display_name: string;
    username: string | null; created_at: string; last_sign_in_at: string | null;
    banned_until: string | null; is_banned: boolean; admin_role: string | null;
    warning_count?: number;
    active_mutes?: { id: string; restriction: string; reason: string; created_at: string; expires_at: string | null }[];
  }[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [canManageAdmins, setCanManageAdmins] = useState(false);
  const [adminRoleDrafts, setAdminRoleDrafts] = useState<Record<string, string>>({});
  const [userReasons, setUserReasons] = useState<Record<string, string>>({});
  const [userDurations, setUserDurations] = useState<Record<string, string>>({});
  const [userMuteRestrictions, setUserMuteRestrictions] = useState<Record<string, string>>({});
  const [userMuteDurations, setUserMuteDurations] = useState<Record<string, string>>({});
  const [userBusy, setUserBusy] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [reportRows, setReportRows] = useState<{ id: string; reporter_id: string; target_type: string; target_id: string; reason: string; details: string | null; status: string; created_at: string; target_summary: string | null; target_author_id: string | null }[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [overview, setOverview] = useState<{ stats: { users: number; posts: number; comments: number; media: number; reels?: number; audio_tracks?: number; playlists?: number; daily_titles?: number; reel_views?: number; new_users_7d?: number; pending_reports?: number; notifications_7d?: number }; daily_activity?: { date: string; posts: number; comments: number; reels: number }[]; users: { id: string; display_name: string; username: string | null; created_at: string }[]; posts: { id: string; author_id: string; body: string; visibility: string; created_at: string }[] } | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [appearanceRows, setAppearanceRows] = useState<{ id: string; version: number; config: { appearance?: { accent?: string; background?: string; surface?: string; radius?: number } }; is_published: boolean; created_at: string }[]>([]);
  const [appearanceDraft, setAppearanceDraft] = useState({ accent: '#168bff', background: '#07111f', surface: '#101b2c', radius: 16 });
  const [appearanceLoading, setAppearanceLoading] = useState(false);
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [canRollbackAppearance, setCanRollbackAppearance] = useState(false);


  const refreshOverview = useCallback(async () => {
    setOverviewLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'overview' } });
    setOverviewLoading(false);
    if (error || data?.ok !== true) {
      notify('دریافت آمار مدیریت ناموفق بود.', 'error');
      return;
    }
    setOverview(data);
  }, [supabase, notify]);

  const refreshFeatureFlags = useCallback(async () => {
    setFeatureFlagsLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'feature_flags_list' } });
    setFeatureFlagsLoading(false);
    if (error || data?.ok !== true) { notify('دریافت کنترل امکانات ناموفق بود.','error'); return; }
    setFeatureFlags(data.flags ?? []);
  },[supabase,notify]);

  const setFeatureFlag = async (key:string, enabled:boolean) => {
    if (featureBusy) return;
    setFeatureBusy(key);
    const {data,error}=await supabase.functions.invoke('admin-console',{body:{action:'feature_flag_set',key,enabled}});
    setFeatureBusy(null);
    if(error||data?.ok!==true){notify('تغییر وضعیت امکان ذخیره نشد.','error');return;}
    setFeatureFlags(rows=>rows.map(row=>row.key===key?{...row,...data.flag}:row));
    notify(enabled?'امکان موردنظر فعال شد.':'امکان موردنظر غیرفعال شد.');
  };

  useEffect(() => { if(adminTab==='features') void refreshFeatureFlags(); },[adminTab,refreshFeatureFlags]);

  const refreshAudit = useCallback(async () => {
    setAuditLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'audit_logs' } });
    setAuditLoading(false);
    if (error || data?.ok !== true) {
      notify('دریافت گزارش عملیات مدیریتی ناموفق بود.', 'error');
      return;
    }
    setAuditRows(data.events ?? []);
  }, [supabase, notify]);

  useEffect(() => {
    if(adminTab!=='overview') return;
    const channel=supabase.channel('admin-live-overview')
      .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},()=>{void refreshOverview();})
      .on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>{void refreshOverview();})
      .on('postgres_changes',{event:'*',schema:'public',table:'comments'},()=>{void refreshOverview();})
      .on('postgres_changes',{event:'*',schema:'public',table:'reports'},()=>{void refreshOverview();})
      .on('postgres_changes',{event:'*',schema:'public',table:'admin_audit_logs'},()=>{void refreshAudit();})
      .subscribe(status=>setLiveStatsConnected(status==='SUBSCRIBED'));
    const fallback=window.setInterval(()=>{void refreshOverview();},30000);
    return ()=>{window.clearInterval(fallback);setLiveStatsConnected(false);void supabase.removeChannel(channel);};
  },[adminTab,supabase,refreshOverview,refreshAudit]);

  const refreshReports = useCallback(async () => {
    setReportsLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'reports_list' } });
    setReportsLoading(false);
    if (error || data?.ok !== true) {
      notify('دریافت گزارش‌های کاربران ناموفق بود.', 'error');
      return;
    }
    setReportRows(data.reports ?? []);
  }, [supabase, notify]);

  const refreshAudioTracks = useCallback(async () => {
    setMediaLoading(true);
    const [tracksResult, reelsResult] = await Promise.all([
      supabase.functions.invoke('admin-console', { body: { action: 'audio_tracks_list' } }),
      supabase.functions.invoke('admin-console', { body: { action: 'reels_list' } }),
    ]);
    setMediaLoading(false);
    if (tracksResult.error || tracksResult.data?.ok !== true || reelsResult.error || reelsResult.data?.ok !== true) {
      notify('دریافت کتابخانه رسانه ناموفق بود.', 'error');
      return;
    }
    setAudioTracks(tracksResult.data.tracks ?? []);
    setManagedReels(reelsResult.data.reels ?? []);
  }, [supabase, notify]);

  const uploadCentralTrack = async () => {
    if (trackSaving) return;
    const title = newTrackTitle.trim();
    const artist = newTrackArtist.trim();
    if (title.length < 1 || title.length > 120 || artist.length > 120) {
      notify('نام آهنگ باید ۱ تا ۱۲۰ نویسه و نام هنرمند حداکثر ۱۲۰ نویسه باشد.', 'error');
      return;
    }
    if (!newTrackAudio || !newTrackAudio.type.startsWith('audio/')) {
      notify('یک فایل صوتی معتبر انتخاب کنید.', 'error');
      return;
    }
    if (newTrackAudio.size < 1 || newTrackAudio.size > 50 * 1024 * 1024) {
      notify('حجم فایل صوتی باید بیشتر از صفر و حداکثر ۵۰ مگابایت باشد.', 'error');
      return;
    }
    if (newTrackCover && (!newTrackCover.type.startsWith('image/') || newTrackCover.size > 5 * 1024 * 1024)) {
      notify('کاور باید تصویر معتبر و حداکثر ۵ مگابایت باشد.', 'error');
      return;
    }
    if (!musicRightsConfirmed) {
      notify('برای انتشار آهنگ باید تأیید کنید که مجوز استفاده از آن را دارید.', 'error');
      return;
    }

    setTrackSaving(true);
    const { data: authResult, error: authError } = await supabase.auth.getUser();
    if (authError || !authResult.user) {
      setTrackSaving(false);
      notify('نشست مدیر معتبر نیست؛ دوباره وارد شوید.', 'error');
      return;
    }

    const trackId = crypto.randomUUID();
    const ownerPath = authResult.user.id + '/audio/';
    const safeFileName = (name: string) => name.replace(/[^A-Za-z0-9_.-]/g, '_').slice(-90) || 'media';
    const audioPath = ownerPath + trackId + '-' + safeFileName(newTrackAudio.name);
    const uploadedPaths: string[] = [];
    let coverPath: string | null = null;

    try {
      const audioUpload = await supabase.storage.from('post-media').upload(audioPath, newTrackAudio, {
        contentType: newTrackAudio.type,
        cacheControl: '3600',
        upsert: false,
      });
      if (audioUpload.error) throw new Error('بارگذاری آهنگ ناموفق بود: ' + audioUpload.error.message);
      uploadedPaths.push(audioPath);

      if (newTrackCover) {
        coverPath = ownerPath + 'covers/' + trackId + '-' + safeFileName(newTrackCover.name);
        const coverUpload = await supabase.storage.from('post-media').upload(coverPath, newTrackCover, {
          contentType: newTrackCover.type,
          cacheControl: '3600',
          upsert: false,
        });
        if (coverUpload.error) throw new Error('بارگذاری کاور ناموفق بود: ' + coverUpload.error.message);
        uploadedPaths.push(coverPath);
      }

      const { data, error } = await supabase.functions.invoke('admin-console', {
        body: {
          action: 'register_audio_track',
          trackId,
          title,
          artist,
          audioPath,
          coverPath,
        },
      });
      if (error || data?.ok !== true) {
        const reason = data?.reason === 'invalid_media_path' ? 'مسیر فایل رسانه معتبر نیست.' :
          data?.reason === 'insufficient_role' ? 'نقش شما اجازه افزودن آهنگ را ندارد.' :
          'ثبت آهنگ در کتابخانه مرکزی ناموفق بود.';
        throw new Error(reason);
      }
      // The Edge Function has linked both objects to a database row; do not
      // remove them if a later list refresh fails.
      uploadedPaths.length = 0;

      setNewTrackTitle('');
      setNewTrackArtist('');
      setNewTrackAudio(null);
      setNewTrackCover(null);
      setMusicRightsConfirmed(false);
      notify('آهنگ با موفقیت در کتابخانه مرکزی ثبت شد.');
      await Promise.all([refreshAudioTracks(), refreshAudit()]);
    } catch (error) {
      if (uploadedPaths.length) {
        const cleanup = await supabase.storage.from('post-media').remove(uploadedPaths);
        if (cleanup.error) {
          notify('ثبت آهنگ ناموفق بود و پاک‌سازی فایل‌های بارگذاری‌شده کامل نشد: ' + cleanup.error.message, 'error');
        } else {
          notify(error instanceof Error ? error.message : 'ثبت آهنگ ناموفق بود.', 'error');
        }
      } else {
        notify(error instanceof Error ? error.message : 'ثبت آهنگ ناموفق بود.', 'error');
      }
    } finally {
      setTrackSaving(false);
    }
  };

  const setAudioTrackActive = async (trackId: string, isActive: boolean) => {
    setUserBusy(trackId);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'set_audio_track_active', trackId, isActive } });
    setUserBusy(null);
    if (error || data?.ok !== true) { notify('تغییر وضعیت آهنگ انجام نشد.', 'error'); return; }
    setAudioTracks((rows) => rows.map((track) => track.id === trackId ? { ...track, is_active: isActive } : track));
    notify(isActive ? 'آهنگ دوباره در کتابخانه کاربران فعال شد.' : 'آهنگ از کتابخانه عمومی پنهان شد.');
    await refreshAudit();
  };

  const refreshUsers = useCallback(async () => {
    setUsersLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'users_list' } });
    setUsersLoading(false);
    if (error || data?.ok !== true) {
      notify('دریافت فهرست کاربران یا مجوز مدیریت ناموفق بود.', 'error');
      return;
    }
    setManagedUsers(data.users ?? []);
    setCanManageAdmins(data.can_manage_admins === true);
  }, [supabase, notify]);

  useEffect(() => { void refreshOverview(); }, [refreshOverview]);
  useEffect(() => {
    if (adminTab === 'audit') void refreshAudit();
  }, [adminTab, refreshAudit]);
  useEffect(() => {
    if (adminTab === 'users') void refreshUsers();
  }, [adminTab, refreshUsers]);
  useEffect(() => {
    if (adminTab === 'reports') void refreshReports();
  }, [adminTab, refreshReports]);
  useEffect(() => {
    if (adminTab === 'media') void refreshAudioTracks();
  }, [adminTab, refreshAudioTracks]);


  const refreshAppearance = useCallback(async () => {
    setAppearanceLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'appearance_history' } });
    setAppearanceLoading(false);
    if (error || data?.ok !== true) { notify('دریافت تنظیمات ظاهری ناموفق بود.', 'error'); return; }
    const rows = (data.versions ?? []) as typeof appearanceRows;
    setCanRollbackAppearance(data.can_rollback === true);
    setAppearanceRows(rows);
    const value = rows.find((row) => row.is_published)?.config?.appearance;
    if (value) setAppearanceDraft({ accent: value.accent ?? '#168bff', background: value.background ?? '#07111f', surface: value.surface ?? '#101b2c', radius: value.radius ?? 16 });
  }, [supabase, notify]);

  const refreshScheduledNotifications = useCallback(async () => {
    setScheduledLoading(true);
    const { data, error } = await supabase.from('scheduled_notifications')
      .select('id,title,body,audience,recipient_ids,scheduled_at,status,sent_at,error_message,created_at,category,image_path,priority,channels,platform_target,push_sent,in_app_sent')
      .order('scheduled_at', { ascending: false }).limit(100);
    setScheduledLoading(false);
    if (error) { notify('دریافت اعلان‌های زمان‌بندی‌شده ناموفق بود.', 'error'); return; }
    setScheduledRows((data ?? []) as typeof scheduledRows);
  }, [supabase, notify]);

  useEffect(() => { if (adminTab === 'notifications') void refreshScheduledNotifications(); }, [adminTab, refreshScheduledNotifications]);
  useEffect(() => { if (adminTab === 'notifications' && announcementAudience === 'specific' && managedUsers.length === 0) void refreshUsers(); }, [adminTab, announcementAudience, managedUsers.length, refreshUsers]);

  const createScheduledNotification = async () => {
    if (scheduledSaving) return;
    const title = announcementTitle.trim();
    const body = announcementBody.trim();
    const scheduledAt = new Date(announcementAt);
    if (title.length < 1 || title.length > 180 || body.length < 1 || body.length > 5000 || !announcementAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 60_000) {
      notify('عنوان، متن و زمان معتبر (حداقل یک دقیقه بعد) وارد کنید.', 'error');
      return;
    }
    const recipientInputs = announcementRecipients.split(/[\n,;\s]+/).map((value) => value.trim()).filter(Boolean);
    const normalizedInputs = recipientInputs.map((value) => value.replace(/^@/, '').toLocaleLowerCase());
    const resolvedRecipients = normalizedInputs.map((value) => managedUsers.find((user) =>
      user.id.toLocaleLowerCase() === value ||
      (user.email ?? '').toLocaleLowerCase() === value ||
      (user.username ?? '').replace(/^@/, '').toLocaleLowerCase() === value ||
      (user.display_name ?? '').trim().toLocaleLowerCase() === value
    ));
    const unresolvedInputs = normalizedInputs.filter((value) => !managedUsers.some((user) =>
      user.id.toLocaleLowerCase() === value ||
      (user.email ?? '').toLocaleLowerCase() === value ||
      (user.username ?? '').replace(/^@/, '').toLocaleLowerCase() === value ||
      (user.display_name ?? '').trim().toLocaleLowerCase() === value
    ));
    const recipientIds = [...new Set(resolvedRecipients.filter((user): user is NonNullable<typeof user> => Boolean(user)).map((user) => user.id))];
    if (announcementAudience === 'specific' && (recipientInputs.length === 0 || unresolvedInputs.length > 0 || recipientIds.length === 0)) {
      notify(unresolvedInputs.length ? 'این ایمیل/شناسه/نام کاربری پیدا نشد: ' + unresolvedInputs.join('، ') : 'حداقل یک کاربر مشخص انتخاب کنید.', 'error');
      if (unresolvedInputs.length) { setUserSearch(unresolvedInputs[0]); void refreshUsers(); }
      return;
    }
    setScheduledSaving(true);
    const { data: authResult } = await supabase.auth.getUser();
    if (!authResult.user) { setScheduledSaving(false); notify('برای ثبت اعلان باید دوباره وارد حساب مدیر شوید.', 'error'); return; }
    if (!announcementInApp && !announcementPush && !announcementEmail) {
      setScheduledSaving(false); notify('حداقل یک روش ارسال را فعال کنید.', 'error'); return;
    }
    let imagePath: string | null = null;
    if (announcementImage) {
      if (!announcementImage.type.startsWith('image/') || announcementImage.size > 5 * 1024 * 1024) {
        setScheduledSaving(false); notify('تصویر اعلان باید معتبر و حداکثر ۵ مگابایت باشد.', 'error'); return;
      }
      imagePath = authResult.user.id + '/notifications/' + crypto.randomUUID() + '-' + announcementImage.name.replace(/[^A-Za-z0-9_.-]/g, '_').slice(-80);
      const uploaded = await supabase.storage.from('post-media').upload(imagePath, announcementImage, { contentType: announcementImage.type, cacheControl: '3600', upsert: false });
      if (uploaded.error) { setScheduledSaving(false); notify('بارگذاری تصویر اعلان ناموفق بود: ' + uploaded.error.message, 'error'); return; }
    }
    const { error } = await supabase.from('scheduled_notifications').insert({
      title, body, audience: announcementAudience, recipient_ids: announcementAudience === 'specific' ? recipientIds : [],
      scheduled_at: scheduledAt.toISOString(), created_by: authResult.user.id,
      category: announcementCategory, image_path: imagePath, priority: announcementPriority,
      platform_target: announcementPlatform,
      channels: { in_app: announcementInApp, push: announcementPush, email: announcementEmail },
    });
    setScheduledSaving(false);
    if (error) {
      if (imagePath) await supabase.storage.from('post-media').remove([imagePath]);
      notify('ثبت اعلان زمان‌بندی‌شده انجام نشد؛ سطح دسترسی مدیر را بررسی کنید.', 'error'); return;
    }
    setAnnouncementTitle(''); setAnnouncementBody(''); setAnnouncementRecipients(''); setAnnouncementAt(''); setAnnouncementImage(null);
    notify('اعلان با تنظیمات انتخاب‌شده ثبت شد؛ ارسال در زمان مقرر انجام می‌شود.');
    await refreshScheduledNotifications();
  };

  const cancelScheduledNotification = async (id: string) => {
    const { data, error } = await supabase.from('scheduled_notifications').update({ status: 'cancelled' }).eq('id', id).in('status', ['pending', 'awaiting_push']).select('id').maybeSingle();
    if (error || !data) { notify('لغو اعلان ممکن نشد؛ ممکن است قبلاً پردازش شده باشد.', 'error'); return; }
    notify('اعلان زمان‌بندی‌شده لغو شد.');
    await refreshScheduledNotifications();
  };

  const processDueNotifications = async () => {
    setScheduledSaving(true);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'process_scheduled_notifications' } });
    setScheduledSaving(false);
    if (error || data?.ok !== true) { notify('پردازش اعلان‌های سررسیدشده ناموفق بود.', 'error'); return; }
    notify(`${data.processed ?? 0} اعلان پردازش شد؛ ${data.delivered ?? 0} گیرنده، ${data.failed ?? 0} مورد ناموفق.`);
    await refreshScheduledNotifications();
  };

  useEffect(() => { if (adminTab === 'appearance') void refreshAppearance(); }, [adminTab, refreshAppearance]);

  const publishAppearance = async () => {
    if (appearanceSaving) return;
    setAppearanceSaving(true);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'appearance_publish', config: { appearance: appearanceDraft } } });
    setAppearanceSaving(false);
    if (error || data?.ok !== true) { notify('انتشار تنظیمات ظاهری انجام نشد.', 'error'); return; }
    notify(`نسخه ${data.appearance.version} از ظاهر سایت منتشر شد.`);
    await refreshAppearance();
  };

  const rollbackAppearance = async (version: number) => {
    if (appearanceSaving || !window.confirm(`ظاهر سایت به تنظیمات نسخه ${version} برگردد؟ یک نسخه جدید نیز در تاریخچه ثبت می‌شود.`)) return;
    setAppearanceSaving(true);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'appearance_rollback', version } });
    setAppearanceSaving(false);
    if (error || data?.ok !== true) { notify(data?.reason === 'owner_only_rollback' ? 'بازگردانی فقط برای مالک اصلی مجاز است.' : 'بازگردانی نسخه انجام نشد.', 'error'); return; }
    notify(`تنظیمات نسخه ${version} به‌عنوان نسخه جدید منتشر شد.`);
    await refreshAppearance();
  };

  const reviewReport = async (reportId: string, status: 'reviewing' | 'resolved' | 'rejected') => {
    if (userBusy) return;
    setUserBusy(reportId);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'review_report', reportId, status } });
    setUserBusy(null);
    if (error || data?.ok !== true) {
      notify('ثبت نتیجه بررسی گزارش ناموفق بود.', 'error');
      return;
    }
    notify(status === 'reviewing' ? 'گزارش به صف بررسی منتقل شد.' : status === 'resolved' ? 'گزارش تأیید و تعیین تکلیف شد.' : 'گزارش رد شد.');
    await Promise.all([refreshReports(), refreshAudit()]);
  };

  const manageAdminRole = async (action: 'set_admin_role' | 'remove_admin_role', userId: string) => {
    if (userBusy) return;
    setUserBusy(userId);
    const { data, error } = await supabase.functions.invoke('admin-console', {
      body: { action, userId, ...(action === 'set_admin_role' ? { role: adminRoleDrafts[userId] ?? 'admin' } : {}) },
    });
    setUserBusy(null);
    if (error || data?.ok !== true) {
      const messages: Record<string, string> = {
        owner_only: 'فقط مالک اصلی می‌تواند نقش مدیران را تغییر دهد.',
        owner_role_protected: 'نقش مالک اصلی قابل تغییر یا لغو نیست.',
        cannot_change_own_role: 'تغییر نقش حساب خودتان مجاز نیست.',
      };
      notify(messages[data?.reason] ?? 'تغییر دسترسی مدیریتی انجام نشد.', 'error');
      return;
    }
    notify(action === 'set_admin_role' ? 'نقش مدیریتی ذخیره شد.' : 'دسترسی مدیریتی کاربر لغو شد.');
    await Promise.all([refreshUsers(), refreshAudit()]);
  };

  const moderateUser = async (action: 'warn_user' | 'ban_user' | 'unban_user', userId: string) => {
    if (userBusy) return;
    const reason = (userReasons[userId] ?? '').trim();
    if (reason.length < 3 || reason.length > 500) {
      notify('برای ثبت عملیات، دلیل ۳ تا ۵۰۰ حرفی وارد کنید.', 'error');
      return;
    }
    setUserBusy(userId);
    const { data, error } = await supabase.functions.invoke('admin-console', {
      body: {
        action,
        userId,
        reason,
        ...(action === 'ban_user' ? { duration: userDurations[userId] ?? '24h' } : {}),
      },
    });
    setUserBusy(null);
    if (error || data?.ok !== true) {
      const messages: Record<string, string> = {
        cannot_moderate_admin: 'حساب‌های مدیریتی قابل مسدودسازی از این بخش نیستند.',
        cannot_moderate_self: 'نمی‌توانید حساب خودتان را محدود کنید.',
        insufficient_role: 'نقش مدیریتی شما اجازه این عملیات را ندارد.',
      };
      notify(messages[data?.reason] ?? 'عملیات مدیریت کاربر انجام نشد.', 'error');
      return;
    }
    notify(action === 'warn_user' ? 'اخطار در سابقه مدیریتی ثبت شد.' : action === 'ban_user' ? 'محدودیت ورود کاربر اعمال شد.' : 'محدودیت ورود کاربر برداشته شد.');
    setUserReasons((current) => ({ ...current, [userId]: '' }));
    await Promise.all([refreshUsers(), refreshAudit()]);
  };

  const moderateMute = async (action: 'mute_user' | 'unmute_user', userId: string, muteId?: string) => {
    if (userBusy) return;
    const reason = (userReasons[userId] ?? '').trim() || (action === 'unmute_user' ? 'لغو محدودیت توسط مدیر' : '');
    if (reason.length < 3 || reason.length > 500) {
      notify('برای ثبت یا لغو محدودیت، دلیل ۳ تا ۵۰۰ حرفی وارد کنید.', 'error');
      return;
    }
    setUserBusy(userId);
    const { data, error } = await supabase.functions.invoke('admin-console', {
      body: action === 'mute_user'
        ? {
            action,
            userId,
            reason,
            restriction: userMuteRestrictions[userId] ?? 'message_send',
            duration: userMuteDurations[userId] ?? '24h',
          }
        : { action, userId, muteId, reason },
    });
    setUserBusy(null);
    if (error || data?.ok !== true) {
      const messages: Record<string, string> = {
        cannot_moderate_admin: 'حساب‌های مدیریتی از این عملیات محافظت شده‌اند.',
        cannot_moderate_self: 'نمی‌توانید حساب خودتان را محدود کنید.',
        invalid_mute_restriction: 'نوع محدودیت انتخاب‌شده معتبر نیست.',
        invalid_mute_duration: 'مدت محدودیت انتخاب‌شده معتبر نیست.',
      };
      notify(messages[data?.reason] ?? 'مدیریت میوت انجام نشد.', 'error');
      return;
    }
    notify(action === 'mute_user' ? 'محدودیت عملکردی ثبت شد.' : 'محدودیت عملکردی لغو شد.');
    if (action === 'mute_user') setUserReasons((current) => ({ ...current, [userId]: '' }));
    await Promise.all([refreshUsers(), refreshAudit()]);
  };

  const moderatePost = async (postId: string, visibility: 'public' | 'private') => {
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'moderate_post', postId, visibility } });
    if (error || data?.ok !== true) return notify('تغییر وضعیت پست انجام نشد.', 'error');
    notify(visibility === 'private' ? 'پست از دید عموم مخفی شد.' : 'پست دوباره عمومی شد.');
    await refreshOverview();
  };

  const deletePost = async (postId: string) => {
    if (deleteCandidate !== postId) { setDeleteCandidate(postId); return; }
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'delete_post', postId } });
    setDeleteCandidate(null);
    if (error || data?.ok !== true) return notify('حذف پست انجام نشد.', 'error');
    notify('پست و رسانه‌های پیوست آن حذف شدند.');
    await refreshOverview();
  };

  const deleteReel = async (reelId: string) => {
    const candidateKey = 'reel:' + reelId;
    if (deleteCandidate !== candidateKey) { setDeleteCandidate(candidateKey); return; }
    setUserBusy(candidateKey);
    const { data, error } = await supabase.functions.invoke('admin-console', { body: { action: 'delete_reel', reelId } });
    setUserBusy(null);
    setDeleteCandidate(null);
    if (error || data?.ok !== true) {
      notify(data?.reason === 'insufficient_role' ? 'حذف ریلز فقط برای مدیر و مالک مجاز است.' : 'حذف ریلز انجام نشد.', 'error');
      return;
    }
    notify('ریلز و فایل ویدئویی آن حذف شد؛ دیدگاه‌ها، پسندها و بازدیدهای وابسته نیز پاک شدند.');
    await Promise.all([refreshReports(), refreshAudit(), refreshOverview()]);
  };

  useEffect(() => {
    let active = true;
    void supabase.functions.invoke('access-code-login', { body: { action: 'admin_get' } })
      .then(({ data, error }) => {
        if (!active) return;
        if (error || data?.isAdmin !== true || data?.ok !== true) {
          setLoadError('دسترسی مدیریت این بخش تأیید نشد. با حساب مدیر وارد شوید.');
          return;
        }
        setEnabled(data.enabled === true);
      })
      .catch(() => {
        if (active) setLoadError('دریافت تنظیمات ورود با کد ناموفق بود.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [supabase]);

  const save = async () => {
    if (saving || loadError) return;
    const normalizedCode = newCode.trim().toUpperCase();
    if (normalizedCode && !isValidAccessCode(normalizedCode)) {
      notify('کد جدید باید دقیقاً ۶ حرف یا عدد انگلیسی باشد.', 'error');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.functions.invoke('access-code-login', {
      body: {
        action: 'admin_update',
        enabled,
        ...(normalizedCode ? { code: normalizedCode } : {}),
      },
    });
    setSaving(false);

    if (error || data?.ok !== true) {
      notify('ذخیره تنظیمات ورود با کد ناموفق بود.', 'error');
      return;
    }
    setNewCode('');
    notify('تنظیمات ورود با کد ذخیره شد.');
  };

  const normalizedUserSearch = userSearch.trim().toLocaleLowerCase();
  const visibleManagedUsers = normalizedUserSearch
    ? managedUsers.filter((user) => [user.display_name, user.email ?? '', user.username ?? '', user.id].some((value) => value.toLocaleLowerCase().includes(normalizedUserSearch)))
    : managedUsers;

  return (
    <div className="page-stack">
      <SectionHeader
        eyebrow="مرکز فرماندهی"
        title="پنل مدیریت کاوه"
        description="نمای کلی جامعه، مدیریت محتوا و کنترل دسترسی مهمان‌ها."
        action={<button className="button button-quiet" type="button" onClick={() => void refreshOverview()}><Activity size={16}/> تازه‌سازی</button>}
      />
      <section className="admin-dashboard">
        <div className="admin-stat-grid">
          <div className="admin-stat"><Users/><span>کاربران</span><strong>{overview?.stats.users ?? '—'}</strong></div>
          <div className="admin-stat"><LayoutDashboard/><span>پست‌ها</span><strong>{overview?.stats.posts ?? '—'}</strong></div>
          <div className="admin-stat"><MessageCircle/><span>دیدگاه‌ها</span><strong>{overview?.stats.comments ?? '—'}</strong></div>
          <div className="admin-stat"><Film/><span>رسانه‌ها</span><strong>{overview?.stats.media ?? '—'}</strong></div>
          <div className="admin-stat"><Film/><span>ریلز</span><strong>{overview?.stats.reels ?? '—'}</strong></div>
          <div className="admin-stat"><Music2/><span>آهنگ‌ها</span><strong>{overview?.stats.audio_tracks ?? '—'}</strong></div>
          <div className="admin-stat"><ListMusic/><span>فهرست‌های پخش</span><strong>{overview?.stats.playlists ?? '—'}</strong></div>
          <div className="admin-stat"><Megaphone/><span>عنوان‌ها و اطلاعیه‌ها</span><strong>{overview?.stats.daily_titles ?? '—'}</strong></div>
          <div className="admin-stat"><Eye/><span>بازدید ریلز</span><strong>{overview?.stats.reel_views ?? '—'}</strong></div>
          <div className="admin-stat"><Users/><span>عضو جدید (۷ روز)</span><strong>{overview?.stats.new_users_7d ?? '—'}</strong></div>
          <div className="admin-stat"><Flag/><span>گزارش‌های باز</span><strong>{overview?.stats.pending_reports ?? '—'}</strong></div>
          <div className="admin-stat"><Megaphone/><span>اعلان‌های ثبت‌شده (۷ روز)</span><strong>{overview?.stats.notifications_7d ?? '—'}</strong></div>
        </div>
        <div className="admin-tabs">
          <button className={adminTab === 'overview' ? 'active' : ''} onClick={() => setAdminTab('overview')}><Activity size={15}/> نمای کلی</button>
          {role !== 'moderator' && <button className={adminTab === 'users' ? 'active' : ''} onClick={() => setAdminTab('users')}><Users size={15}/> کاربران</button>}
          <button className={adminTab === 'posts' ? 'active' : ''} onClick={() => setAdminTab('posts')}><LayoutDashboard size={15}/> مدیریت پست‌ها</button>
          <button className={adminTab === 'reports' ? 'active' : ''} onClick={() => setAdminTab('reports')}><Flag size={15}/> گزارش تخلف‌ها</button>
          {role !== 'moderator' && <button className={adminTab === 'audit' ? 'active' : ''} onClick={() => setAdminTab('audit')}><ShieldCheck size={15}/> گزارش مدیریت</button>}
          {role !== 'moderator' && <button className={adminTab === 'media' ? 'active' : ''} onClick={() => setAdminTab('media')}><Music2 size={15}/> کتابخانه رسانه</button>}
          {role !== 'moderator' && <button className={adminTab === 'notifications' ? 'active' : ''} onClick={() => setAdminTab('notifications')}><Megaphone size={15}/> اعلان‌های زمان‌بندی‌شده</button>}
          {role !== 'moderator' && <button className={adminTab === 'appearance' ? 'active' : ''} onClick={() => setAdminTab('appearance')}><Palette size={15}/> ظاهر سایت</button>}
          {role === 'owner' && <button className={adminTab === 'ranks' ? 'active' : ''} onClick={() => setAdminTab('ranks')}><ShieldCheck size={15}/> رتبه‌ها و مجوزها</button>}
          {role !== 'moderator' && <button className={adminTab === 'features' ? 'active' : ''} onClick={() => setAdminTab('features')}><ShieldCheck size={15}/> کنترل امکانات</button>}
          {role !== 'moderator' && <button className={adminTab === 'access' ? 'active' : ''} onClick={() => setAdminTab('access')}><KeyRound size={15}/> ورود مهمان</button>}
        </div>
        {overviewLoading ? <div className="admin-loading"><span className="spinner"/><span>در حال دریافت اطلاعات پنل…</span></div> : null}
        {adminTab === 'overview' && <div className="admin-live-status"><span className={liveStatsConnected?'is-live':''}/>{liveStatsConnected?'آمار زنده متصل است':'اتصال زنده در حال برقراری؛ به‌روزرسانی دوره‌ای فعال است'}</div>}
        {adminTab === 'overview' && !overviewLoading && <div className="admin-overview-grid">
          <div className="admin-console-card"><strong>آخرین فعالیت‌ها</strong>{(overview?.posts ?? []).slice(0,5).map((post) => <div className="admin-activity-row" key={post.id}><span className="admin-activity-dot"/><div><b>{post.body || 'پست رسانه‌ای'}</b><small>{post.visibility === 'public' ? 'عمومی' : 'محدود'} · {new Date(post.created_at).toLocaleDateString('fa-IR')}</small></div></div>)}{!overview?.posts.length && <p>هنوز فعالیتی ثبت نشده است.</p>}</div>
          <div className="admin-console-card"><strong>آخرین اعضا</strong>{(overview?.users ?? []).slice(0,5).map((user) => <div className="admin-user-row" key={user.id}><span className="admin-user-avatar">{(user.display_name || 'ک').slice(0,1)}</span><div><b>{user.display_name || 'کاربر کاوه'}</b><small>{user.username ? '@' + user.username : 'نام کاربری ثبت نشده'}</small></div></div>)}</div>
          <div className="admin-console-card">
            <strong>روند فعالیت هفت‌روزه</strong>
            <p className="admin-user-policy-note">تعداد پست‌ها، دیدگاه‌ها و ریلزهای ایجادشده در هر روز (بر اساس زمان UTC)</p>
            <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
              {(overview?.daily_activity ?? []).map((day) => {
                const total = day.posts + day.comments + day.reels;
                const max = Math.max(1, ...(overview?.daily_activity ?? []).map((item) => item.posts + item.comments + item.reels));
                return <div key={day.date} style={{ display: 'grid', gridTemplateColumns: '76px minmax(0,1fr) 38px', gap: 10, alignItems: 'center' }}>
                  <small>{new Date(day.date + 'T00:00:00Z').toLocaleDateString('fa-IR', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</small>
                  <div title={`پست: ${day.posts} · دیدگاه: ${day.comments} · ریلز: ${day.reels}`} style={{ height: 10, background: 'var(--surface-muted, rgba(127,127,127,.16))', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((total / max) * 100)}%`, height: '100%', background: 'var(--accent, #168bff)', borderRadius: 99, minWidth: total ? 3 : 0 }}/>
                  </div>
                  <b style={{ textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>{total}</b>
                </div>;
              })}
            </div>
            <small style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}><span>پست: {(overview?.daily_activity ?? []).reduce((sum, day) => sum + day.posts, 0)}</span><span>دیدگاه: {(overview?.daily_activity ?? []).reduce((sum, day) => sum + day.comments, 0)}</span><span>ریلز: {(overview?.daily_activity ?? []).reduce((sum, day) => sum + day.reels, 0)}</span></small>
          </div>
        </div>}
        {adminTab === 'users' && <div className="admin-console-card">
          <div className="admin-audit-heading"><strong>مدیریت کاربران ({visibleManagedUsers.length} از {managedUsers.length})</strong><button className="button button-quiet" type="button" onClick={() => void refreshUsers()}><Activity size={15}/> تازه‌سازی</button></div>
          <label className="field-label" htmlFor="admin-user-search">جستجوی سریع کاربر</label>
          <input id="admin-user-search" className="text-input" type="search" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="نام، ایمیل، نام کاربری یا شناسه کاربر…" autoComplete="off"/>
          <p className="admin-user-policy-note">اخطار فقط در سوابق ثبت می‌شود. مسدودسازی ورود، ورود و تمدید نشست‌های جدید را متوقف می‌کند؛ نشست‌های دارای توکن فعال ممکن است تا زمان انقضای توکن دسترسی فعلی کار کنند. حساب‌های مدیریتی از این عملیات محافظت شده‌اند.</p>
          {usersLoading ? <div className="admin-loading"><span className="spinner"/><span>در حال دریافت کاربران…</span></div> : managedUsers.length === 0 ? <p>کاربری برای نمایش پیدا نشد.</p> : visibleManagedUsers.length === 0 ? <p>کاربری با این عبارت در نتایج بارگذاری‌شده پیدا نشد.</p> : visibleManagedUsers.map((user) => {
            const isBanned = user.is_banned;
            const roleLabel = user.admin_role === 'owner' ? 'مالک' : user.admin_role === 'admin' ? 'مدیر' : user.admin_role === 'moderator' ? 'ناظر' : user.admin_role === 'support' ? 'پشتیبانی' : '';
            return <div className="admin-managed-user" key={user.id}>
              <div className="admin-user-row">
                <span className="admin-user-avatar">{(user.display_name || 'ک').slice(0,1)}</span>
                <div className="admin-managed-user-info">
                  <b>{user.display_name || 'کاربر کاوه'}</b>
                  <small>{user.email || (user.is_anonymous ? 'حساب مهمان' : 'ایمیل ثبت نشده')} · {user.username ? '@' + user.username : 'نام کاربری ثبت نشده'}</small>
                  <small>عضویت: {new Date(user.created_at).toLocaleDateString('fa-IR')} · آخرین ورود: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('fa-IR') : 'ثبت نشده'}</small>
                  {roleLabel ? <small className="admin-protected-label">حساب مدیریتی: {roleLabel} — محافظت‌شده</small> : isBanned ? <small className="admin-banned-label">محدود تا {new Date(user.banned_until!).toLocaleString('fa-IR')}</small> : <small>وضعیت حساب: عادی</small>}
                  <small>اخطارهای ثبت‌شده: {user.warning_count ?? 0}</small>
                  {(user.active_mutes ?? []).map((mute) => (
                    <div className="admin-user-row" key={mute.id}>
                      <small>
                        میوت فعال: {mute.restriction === 'message_send' ? 'ارسال پیام' : mute.restriction === 'group_message_send' ? 'پیام گروهی' : mute.restriction === 'comment' ? 'دیدگاه' : mute.restriction === 'post_publish' ? 'انتشار پست' : mute.restriction === 'reel_publish' ? 'انتشار ریلز' : mute.restriction === 'file_upload' ? 'بارگذاری فایل' : mute.restriction}
                        {' · '}{mute.expires_at ? 'تا ' + new Date(mute.expires_at).toLocaleString('fa-IR') : 'دائمی'}
                      </small>
                      <button className="button button-quiet" type="button" disabled={userBusy !== null} onClick={() => void moderateMute('unmute_user', user.id, mute.id)}>رفع میوت</button>
                    </div>
                  ))}
                </div>
              </div>
              {canManageAdmins && user.admin_role !== 'owner' && <div className="admin-role-management">
                <select className="auth-input admin-role-select" value={adminRoleDrafts[user.id] ?? user.admin_role ?? 'admin'} onChange={(event) => setAdminRoleDrafts((current) => ({ ...current, [user.id]: event.target.value }))} disabled={userBusy !== null}>
                  <option value="admin">مدیر</option><option value="moderator">ناظر</option><option value="support">پشتیبانی</option>
                </select>
                <button className="button button-quiet" type="button" disabled={userBusy !== null} onClick={() => void manageAdminRole('set_admin_role', user.id)}>{user.admin_role ? 'ذخیره نقش' : 'افزودن به مدیران'}</button>
                {user.admin_role && <button className="button button-quiet admin-ban-button" type="button" disabled={userBusy !== null} onClick={() => void manageAdminRole('remove_admin_role', user.id)}>لغو دسترسی</button>}
              </div>}
              {!user.admin_role && <div className="admin-user-moderation">
                <input className="auth-input" type="text" maxLength={500} value={userReasons[user.id] ?? ''} onChange={(event) => setUserReasons((current) => ({ ...current, [user.id]: event.target.value }))} placeholder="دلیل اخطار یا محدودیت را بنویسید" disabled={userBusy === user.id}/>
                <div className="admin-user-actions">
                  <button className="button button-quiet" type="button" disabled={userBusy !== null} onClick={() => void moderateUser('warn_user', user.id)}>ثبت اخطار</button>
                  {isBanned ? <button className="button button-quiet" type="button" disabled={userBusy !== null} onClick={() => void moderateUser('unban_user', user.id)}><CheckCircle2 size={14}/> رفع محدودیت</button> : <>
                    <select className="auth-input admin-ban-duration" value={userDurations[user.id] ?? '24h'} onChange={(event) => setUserDurations((current) => ({ ...current, [user.id]: event.target.value }))} disabled={userBusy !== null}>
                      <option value="1h">۱ ساعت</option><option value="24h">۲۴ ساعت</option><option value="168h">۷ روز</option><option value="720h">۳۰ روز</option><option value="876000h">بلندمدت</option>
                    </select>
                    <button className="button button-quiet admin-ban-button" type="button" disabled={userBusy !== null} onClick={() => void moderateUser('ban_user', user.id)}><Ban size={14}/> مسدودسازی</button>
                  </>}
                  <select className="auth-input admin-ban-duration" value={userMuteRestrictions[user.id] ?? 'message_send'} onChange={(event) => setUserMuteRestrictions((current) => ({ ...current, [user.id]: event.target.value }))} disabled={userBusy !== null}>
                    <option value="message_send">محدودیت همه پیام‌ها</option>
                    <option value="group_message_send">محدودیت پیام گروه</option>
                    <option value="comment">محدودیت دیدگاه</option>
                    <option value="post_publish">محدودیت انتشار پست</option>
                    <option value="reel_publish">محدودیت انتشار ریلز</option>
                    <option value="file_upload">محدودیت بارگذاری فایل</option>
                  </select>
                  <select className="auth-input admin-ban-duration" value={userMuteDurations[user.id] ?? '24h'} onChange={(event) => setUserMuteDurations((current) => ({ ...current, [user.id]: event.target.value }))} disabled={userBusy !== null}>
                    <option value="1h">میوت ۱ ساعت</option><option value="24h">میوت ۲۴ ساعت</option><option value="168h">میوت ۷ روز</option><option value="720h">میوت ۳۰ روز</option><option value="permanent">میوت دائمی</option>
                  </select>
                  <button className="button button-quiet admin-ban-button" type="button" disabled={userBusy !== null} onClick={() => void moderateMute('mute_user', user.id)}><Ban size={14}/> اعمال میوت</button>
                </div>
              </div>}
              {userBusy === user.id && <small className="admin-user-busy">در حال اجرای عملیات…</small>}
            </div>;
          })}
        </div>}
        {adminTab === 'posts' && !overviewLoading && <div className="admin-console-card"><strong>مدیریت محتوا ({overview?.posts.length ?? 0} پست اخیر)</strong>{(overview?.posts ?? []).map((post) => <div className="admin-post-row" key={post.id}><div><b>{post.body || 'پست رسانه‌ای'}</b><small>{post.visibility === 'public' ? 'قابل مشاهده برای عموم' : 'محدود / مخفی'} · {new Date(post.created_at).toLocaleDateString('fa-IR')}</small></div><div className="admin-post-actions"><button className="icon-button" title={post.visibility === 'public' ? 'مخفی‌کردن' : 'عمومی‌کردن'} onClick={() => void moderatePost(post.id, post.visibility === 'public' ? 'private' : 'public')}>{post.visibility === 'public' ? <EyeOff size={16}/> : <Eye size={16}/>}</button>{role !== 'moderator' && <button className="icon-button admin-delete" title={deleteCandidate === post.id ? 'برای تأیید دوباره بزن' : 'حذف پست'} onClick={() => void deletePost(post.id)}><Trash2 size={16}/></button>}</div></div>)}</div>}
        {adminTab === 'reports' && <div className="admin-console-card">
          <div className="admin-audit-heading"><strong>صف بررسی گزارش‌ها ({reportRows.length})</strong><button className="button button-quiet" type="button" onClick={() => void refreshReports()}><Activity size={15}/> تازه‌سازی</button></div>
          {reportsLoading ? <div className="admin-loading"><span className="spinner"/><span>در حال دریافت گزارش‌ها…</span></div> : reportRows.length === 0 ? <p>گزارش ثبت‌شده‌ای برای بررسی وجود ندارد.</p> : reportRows.map((report) => <div className="admin-report-row" key={report.id}>
            <div className="admin-report-heading">
              <b>{report.target_type === 'user' ? 'گزارش درباره کاربر' : report.target_type === 'post' ? 'گزارش درباره پست' : report.target_type === 'comment' ? 'گزارش درباره دیدگاه' : report.target_type === 'reel' ? 'گزارش درباره ریلز' : report.target_type === 'message' ? 'گزارش درباره پیام' : report.target_type === 'group' ? 'گزارش درباره گروه' : report.target_type === 'channel' ? 'گزارش درباره کانال' : report.target_type === 'file' ? 'گزارش درباره فایل' : 'گزارش تخلف'}</b>
              <span className={`admin-report-status status-${report.status}`}>{report.status === 'open' ? 'باز' : report.status === 'reviewing' ? 'در حال بررسی' : report.status === 'resolved' ? 'تأیید و بسته‌شده' : 'ردشده'}</span>
            </div>
            <small>دلیل: {report.reason} · گزارش‌دهنده: {report.reporter_id.slice(0, 8)}… · شناسه هدف: {report.target_id.slice(0, 8)}…</small>
            {report.target_summary && <p className="admin-report-target">محتوای هدف: {report.target_summary}</p>}
            {report.details && <p className="admin-report-details">{report.details}</p>}
            <small>{new Date(report.created_at).toLocaleString('fa-IR')}</small>
            {report.target_type === 'reel' && report.status !== 'resolved' && report.status !== 'rejected' && <div className="admin-report-actions"><button className="button button-quiet admin-ban-button" type="button" disabled={userBusy !== null} onClick={() => void deleteReel(report.target_id)}><Trash2 size={14}/>{deleteCandidate === 'reel:' + report.target_id ? 'برای تأیید دوباره بزن' : 'حذف ریلز'}</button></div>}
            {report.status !== 'resolved' && report.status !== 'rejected' && <div className="admin-report-actions">
              {report.status === 'open' && <button className="button button-quiet" type="button" disabled={userBusy !== null} onClick={() => void reviewReport(report.id, 'reviewing')}>شروع بررسی</button>}
              <button className="button button-quiet" type="button" disabled={userBusy !== null} onClick={() => void reviewReport(report.id, 'resolved')}>تأیید گزارش</button>
              <button className="button button-quiet admin-ban-button" type="button" disabled={userBusy !== null} onClick={() => void reviewReport(report.id, 'rejected')}>رد گزارش</button>
            </div>}
            {userBusy === report.id && <small className="admin-user-busy">در حال ثبت نتیجه…</small>}
          </div>)}
        </div>}
        {adminTab === 'media' && <div className="admin-console-card">
          <div className="admin-audit-heading"><strong>کتابخانه مرکزی موسیقی ({audioTracks.length} آهنگ)</strong><button className="button button-quiet" type="button" onClick={() => void refreshAudioTracks()}><Activity size={15}/> تازه‌سازی</button></div>
          <p className="admin-user-policy-note">آهنگ غیرفعال از فهرست عمومی و پخش کاربران عادی پنهان می‌شود؛ فایل و ارتباط آن با فهرست‌های پخش حذف نمی‌شود. فقط مالک و مدیر می‌توانند وضعیت انتشار را تغییر دهند.</p>
          {role !== 'moderator' && <div className="admin-console-card" style={{ marginBottom: 16 }}>
            <strong>افزودن آهنگ به کتابخانه مرکزی</strong>
            <label className="field-label">نام آهنگ</label>
            <input className="text-input" maxLength={120} value={newTrackTitle} onChange={(event) => setNewTrackTitle(event.target.value)} placeholder="نام آهنگ" disabled={trackSaving}/>
            <label className="field-label">هنرمند / خواننده</label>
            <input className="text-input" maxLength={120} value={newTrackArtist} onChange={(event) => setNewTrackArtist(event.target.value)} placeholder="نام هنرمند" disabled={trackSaving}/>
            <label className="field-label">فایل صوتی (حداکثر ۵۰ مگابایت)</label>
            <input className="text-input" type="file" accept="audio/*" onChange={(event) => setNewTrackAudio(event.target.files?.[0] ?? null)} disabled={trackSaving}/>
            {newTrackAudio && <small>{newTrackAudio.name} · {(newTrackAudio.size / 1024 / 1024).toFixed(2)} MB</small>}
            <label className="field-label">کاور اختیاری (حداکثر ۵ مگابایت)</label>
            <input className="text-input" type="file" accept="image/*" onChange={(event) => setNewTrackCover(event.target.files?.[0] ?? null)} disabled={trackSaving}/>
            {newTrackCover && <small>{newTrackCover.name} · {(newTrackCover.size / 1024 / 1024).toFixed(2)} MB</small>}
            <label className="setting-choice" style={{ justifyContent: 'flex-start', gap: 10 }}>
              <input type="checkbox" checked={musicRightsConfirmed} onChange={(event) => setMusicRightsConfirmed(event.target.checked)} disabled={trackSaving}/>
              <span>تأیید می‌کنم مجوز لازم برای بارگذاری و انتشار این موسیقی را دارم.</span>
            </label>
            <button className="button button-primary" type="button" disabled={trackSaving || !newTrackTitle.trim() || !newTrackAudio || !musicRightsConfirmed} onClick={() => void uploadCentralTrack()}>
              <Music2 size={15}/>{trackSaving ? 'در حال بارگذاری و ثبت…' : 'بارگذاری و انتشار آهنگ'}
            </button>
          </div>}
          {mediaLoading ? <div className="admin-loading"><span className="spinner"/><span>در حال دریافت کتابخانه موسیقی…</span></div> : audioTracks.length === 0 ? <p>هنوز آهنگی در کتابخانه ثبت نشده است.</p> : audioTracks.map((track) => <div className="admin-managed-user" key={track.id}>
            <div className="admin-user-row">
              {track.cover_path
                ? <img src={supabase.storage.from('post-media').getPublicUrl(track.cover_path).data.publicUrl} alt={track.title} loading="lazy" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }}/>
                : <span className="admin-user-avatar"><Music2 size={18}/></span>}
              <div className="admin-managed-user-info"><b>{track.title}</b><small>{track.artist} · {track.duration_seconds ? Math.floor(track.duration_seconds / 60) + ':' + String(track.duration_seconds % 60).padStart(2, '0') : 'مدت نامشخص'}</small><small>ثبت: {new Date(track.created_at).toLocaleDateString('fa-IR')} · {track.is_active ? 'در دسترس کاربران' : 'پنهان از کتابخانه عمومی'}</small></div>
            </div>
            <div className="admin-user-actions"><button className="button button-quiet" type="button" disabled={userBusy !== null} onClick={() => void setAudioTrackActive(track.id, !track.is_active)}>{userBusy === track.id ? 'در حال ذخیره…' : track.is_active ? 'غیرفعال‌کردن آهنگ' : 'فعال‌کردن آهنگ'}</button></div>
          </div>)}
          <div className="admin-audit-heading" style={{ marginTop: 28 }}><strong>کتابخانه ریلز ({managedReels.length})</strong></div>
          {mediaLoading ? null : managedReels.length === 0 ? <p>هنوز ریلزی ثبت نشده است.</p> : managedReels.map((reel) => <div className="admin-managed-user" key={reel.id}>
            <div className="admin-user-row"><span className="admin-user-avatar"><Film size={18}/></span><div className="admin-managed-user-info"><b>{reel.caption || 'ریلز بدون توضیح'}</b><small>سازنده: {reel.author_id.slice(0, 8)}… · {reel.visibility === 'public' ? 'عمومی' : reel.visibility === 'followers' ? 'دنبال‌کنندگان' : 'خصوصی'}</small><small>{reel.views_count} بازدید · انتشار: {new Date(reel.published_at).toLocaleDateString('fa-IR')}</small></div></div>
            <div className="admin-user-actions"><button className="button button-quiet admin-ban-button" type="button" disabled={userBusy !== null} onClick={() => void deleteReel(reel.id)}><Trash2 size={14}/>{deleteCandidate === 'reel:' + reel.id ? 'برای تأیید دوباره بزن' : 'حذف ریلز'}</button></div>
          </div>)}
        </div>}
        {adminTab === 'notifications' && <div className="admin-console-card">
          <div className="admin-audit-heading"><strong>مرکز اعلان‌های مدیریتی و Push</strong><button className="button button-quiet" type="button" onClick={() => void refreshScheduledNotifications()}><Activity size={15}/> تازه‌سازی</button></div>
          <p className="admin-user-policy-note">از اینجا می‌توانی اعلان تصویری با موضوع، اولویت، مخاطب و کانال ارسال بسازی. اعلان داخل برنامه مستقل است؛ Push اندروید پس از افزودن تنظیمات Firebase و کلید امن FCM فعال می‌شود. زمان‌بند فعلی دیتابیس اعلان‌های سررسیدشده را هر دقیقه پردازش می‌کند.</p>
          <div className="admin-console-card" style={{ marginBottom: 16 }}>
            <strong>ساخت و زمان‌بندی اعلان</strong>
            <label className="field-label">موضوع اعلان</label>
            <select className="text-input" value={announcementCategory} onChange={(event) => setAnnouncementCategory(event.target.value)}>
              <option value="general">عمومی و اطلاعیه</option><option value="news">خبر و به‌روزرسانی</option><option value="maintenance">تعمیرات و قطعی</option><option value="security">امنیتی و هشدار</option><option value="event">رویداد و مناسبت</option><option value="promotion">ویژه و تبلیغاتی</option><option value="message">پیام مدیر</option>
            </select>
            <label className="field-label">عنوان اعلان</label>
            <input className="text-input" maxLength={180} value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="عنوان کوتاه و واضح برای اعلان"/>
            <label className="field-label">متن اعلان</label>
            <textarea className="text-input" rows={4} maxLength={5000} value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} placeholder="متن کامل پیام برای کاربران…"/>
            <label className="field-label">تصویر اعلان (اختیاری، حداکثر ۵ مگابایت)</label>
            <input className="text-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setAnnouncementImage(event.target.files?.[0] ?? null)}/>
            {announcementImage && <small>{announcementImage.name} · {(announcementImage.size / 1024 / 1024).toFixed(2)} MB</small>}
            <label className="field-label">مخاطبان</label>
            <select className="text-input" value={announcementAudience} onChange={(event) => setAnnouncementAudience(event.target.value as typeof announcementAudience)}>
              <option value="all">همه کاربران</option><option value="admins">فقط مدیران</option><option value="specific">کاربران مشخص</option>
            </select>
            {announcementAudience === 'specific' && <>
              <label className="field-label">جست‌وجو و انتخاب کاربران ({announcementRecipients.split(/[\\n,;\\s]+/).filter(Boolean).length} انتخاب‌شده)</label>
              <textarea className="text-input" rows={3} value={announcementRecipients} onChange={(event) => setAnnouncementRecipients(event.target.value)} placeholder="ایمیل، UUID یا شناسه کاربر یا نام کاربری را وارد کن؛ هر مورد در یک خط یا با ویرگول جدا شود…"/>
              <small>می‌توانی چند مورد را هم‌زمان وارد کنی. ایمیل کامل، UUID یا نام کاربری دقیق پذیرفته می‌شود. موارد باید در فهرست کاربران سایت پیدا شوند.</small>
              <label className="field-label">یا جست‌وجو و انتخاب از فهرست کاربران</label>
              <input className="text-input" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="نام، ایمیل، شناسه یا نام کاربری را جست‌وجو کن…"/>
              {usersLoading ? <small>در حال دریافت فهرست کاربران…</small> : <div style={{ maxHeight: 260, overflowY: 'auto', display: 'grid', gap: 8, padding: 10, border: '1px solid var(--border, rgba(127,127,127,.25))', borderRadius: 12 }}>
                {visibleManagedUsers.slice(0, 100).map((user) => {
                  const selected = announcementRecipients.split(/[\\n,;\\s]+/).filter(Boolean).some((value) => [user.id, user.email ?? '', user.username ?? ''].some((candidate) => candidate.toLocaleLowerCase() === value.toLocaleLowerCase()));
                  return <label key={user.id} className="setting-choice"><input type="checkbox" checked={selected} onChange={(event) => setAnnouncementRecipients((current) => {
                    const ids = current.split(/[\\n,;\\s]+/).filter(Boolean);
                    const identifiers = [user.id, user.email ?? '', user.username ?? ''].filter(Boolean);
                    const filtered = ids.filter((id) => !identifiers.some((candidate) => candidate.toLocaleLowerCase() === id.toLocaleLowerCase()));
                    return event.target.checked ? [...filtered, user.email ?? user.id].join('\\n') : filtered.join('\\n');
                  })}/><span>{user.display_name || 'کاربر کاوه'} · {user.username ? '@' + user.username : user.email ?? user.id.slice(0, 8)}</span></label>;
                })}
                {visibleManagedUsers.length === 0 && <small>کاربری با این عبارت پیدا نشد.</small>}
              </div>}
              <small>حداکثر ۱۰۰ نتیجه در فهرست نمایش داده می‌شود. انتخاب از فهرست، شناسه همان کاربر را به ورودی بالا اضافه می‌کند.</small>
            </>}
            <label className="field-label">دستگاه مقصد</label>
            <select className="text-input" value={announcementPlatform} onChange={(event) => setAnnouncementPlatform(event.target.value as typeof announcementPlatform)}>
              <option value="all">همه دستگاه‌های ثبت‌شده (فعلاً اندروید برای Push)</option><option value="android">فقط اندروید</option>
            </select>
            <label className="field-label">اولویت اعلان</label>
            <select className="text-input" value={announcementPriority} onChange={(event) => setAnnouncementPriority(event.target.value as typeof announcementPriority)}>
              <option value="normal">عادی</option><option value="high">بالا و فوری</option>
            </select>
            <label className="field-label">روش‌های ارسال</label>
            <label className="setting-choice"><input type="checkbox" checked={announcementInApp} onChange={(event) => setAnnouncementInApp(event.target.checked)}/> صندوق اعلان داخل برنامه</label>
            <label className="setting-choice"><input type="checkbox" checked={announcementPush} onChange={(event) => setAnnouncementPush(event.target.checked)}/> اعلان سیستمی گوشی (Push / FCM)</label>
            <label className="field-label">زمان ارسال</label>
            <input className="text-input" type="datetime-local" value={announcementAt} onChange={(event) => setAnnouncementAt(event.target.value)}/>
            <button className="button button-primary" type="button" disabled={scheduledSaving} onClick={() => void createScheduledNotification()}><Megaphone size={15}/>{scheduledSaving ? 'در حال ثبت…' : 'ثبت و زمان‌بندی اعلان'}</button>
          </div>
          <div className="admin-audit-heading"><strong>تاریخچه اعلان‌ها ({scheduledRows.length})</strong><button className="button button-primary" type="button" disabled={scheduledSaving} onClick={() => void processDueNotifications()}><Activity size={15}/> پردازش اعلان‌های سررسیدشده</button></div>
          {scheduledLoading ? <div className="admin-loading"><span className="spinner"/>در حال دریافت…</div> : scheduledRows.length === 0 ? <p>هنوز اعلانی ثبت نشده است.</p> : scheduledRows.map((item) => <div className="admin-report-row" key={item.id}>
            <div><strong>{item.title}</strong><p>{item.body}</p><small>موضوع: {item.category ?? 'عمومی'} · مخاطب: {item.audience === 'all' ? 'همه کاربران' : item.audience === 'admins' ? 'مدیران' : 'کاربران مشخص'} · اولویت: {item.priority === 'high' ? 'بالا' : 'عادی'}</small><small>{new Date(item.scheduled_at).toLocaleString('fa-IR')} · وضعیت: {item.status === 'pending' ? 'در انتظار زمان' : item.status === 'awaiting_push' ? 'در انتظار اتصال Push' : item.status === 'sent' ? 'ارسال‌شده' : item.status === 'failed' ? 'ناموفق' : item.status === 'cancelled' ? 'لغوشده' : 'در حال پردازش'} · داخل برنامه: {item.in_app_sent ?? 0} · Push: {item.push_sent ?? 0}</small>{item.image_path && <img src={supabase.storage.from('post-media').getPublicUrl(item.image_path).data.publicUrl} alt="" style={{ maxWidth: 180, maxHeight: 110, objectFit: 'cover', borderRadius: 10, marginTop: 8 }}/ >}{item.error_message && <small className="notice-error">{item.error_message}</small>}</div>
            {(item.status === 'pending' || item.status === 'awaiting_push') && <button className="button button-quiet" type="button" onClick={() => void cancelScheduledNotification(item.id)}>لغو</button>}
          </div>)}
        </div>}
        {adminTab === 'audit' && <div className="admin-console-card">
          <div className="admin-audit-heading"><strong>گزارش عملیات حساس (۱۰۰ مورد اخیر)</strong><button className="button button-quiet" type="button" onClick={() => void refreshAudit()}><Activity size={15}/> تازه‌سازی</button></div>
          {auditLoading ? <div className="admin-loading"><span className="spinner"/><span>در حال دریافت گزارش‌ها…</span></div> : auditRows.length === 0 ? <p>هنوز عملیات مدیریتی ثبت نشده است.</p> : auditRows.map((entry) => <div className="admin-activity-row" key={entry.id}>
            <span className="admin-activity-dot"/>
            <div>
              <b>{entry.action === 'set_audio_track_active' ? 'تغییر وضعیت آهنگ' : entry.action === 'delete_reel' ? 'حذف ریلز گزارش‌شده' : entry.action === 'delete_post' ? 'حذف پست' : entry.action === 'moderate_post' ? 'تغییر وضعیت پست' : entry.action === 'warn_user' ? 'اخطار به کاربر' : entry.action === 'ban_user' ? 'مسدودسازی کاربر' : entry.action === 'unban_user' ? 'رفع مسدودی کاربر' : entry.action === 'mute_user' ? 'اعمال میوت' : entry.action === 'unmute_user' ? 'رفع میوت' : entry.action === 'set_admin_role' ? 'تغییر نقش مدیریتی' : entry.action === 'remove_admin_role' ? 'لغو دسترسی مدیریتی' : entry.action === 'review_report' ? 'بررسی گزارش تخلف' : entry.action}</b>
              <small>{entry.target_type === 'feature_flag' ? 'امکان: ' + String(entry.details?.feature_key ?? '') + ' · مدیر: ' : entry.target_type === 'user' ? 'شناسه کاربر: ' : entry.target_type === 'report' ? 'شناسه گزارش: ' : entry.target_type === 'audio_track' ? 'شناسه آهنگ: ' : 'شناسه محتوا: '}{entry.target_type === 'feature_flag' ? '' : entry.target_id.slice(0, 8) + '…'} · مدیر: {entry.actor_id?.slice(0, 8) ?? 'نامشخص'} · {entry.status === 'succeeded' ? 'موفق' : entry.status === 'failed' ? 'ناموفق' : 'در حال اجرا'}</small>
              <small>{entry.details?.visibility ? 'وضعیت مقصد: ' + String(entry.details.visibility) + ' · ' : ''}{entry.details?.duration ? 'مدت محدودیت: ' + String(entry.details.duration) + ' · ' : ''}{entry.details?.role ? 'نقش: ' + String(entry.details.role) + ' · ' : ''}{entry.details?.previous_role ? 'نقش قبلی: ' + String(entry.details.previous_role) + ' · ' : ''}{entry.details?.reason ? 'دلیل: ' + String(entry.details.reason) + ' · ' : ''}{new Date(entry.created_at).toLocaleString('fa-IR')}</small>
            </div>
          </div>)}
        </div>}
      </section>
      {adminTab === 'features' && <section className="admin-console-card admin-feature-flags">
        <div className="admin-audit-heading"><strong>مرکز کنترل امکانات پلتفرم</strong><button className="button button-quiet" type="button" onClick={()=>void refreshFeatureFlags()}><Activity size={15}/> تازه‌سازی</button></div>
        <p className="admin-user-policy-note">تغییرات با دسترسی مدیریتی ثبت و در گزارش فعالیت مدیران ذخیره می‌شوند. خاموش‌کردن هر قابلیت باید با توجه به اثر آن بر تجربه کاربران انجام شود.</p>
        {featureFlagsLoading?<div className="admin-loading"><span className="spinner"/>در حال دریافت تنظیمات…</div>:featureFlags.map(flag=><div className="admin-feature-row" key={flag.key}>
          <div><strong>{flag.title}</strong><small>{flag.description}</small><small>آخرین تغییر: {new Date(flag.updated_at).toLocaleString('fa-IR')}</small></div>
          <button type="button" role="switch" aria-checked={flag.enabled} aria-label={'تغییر وضعیت '+flag.title} className={'switch '+(flag.enabled?'on':'')} disabled={featureBusy!==null} onClick={()=>void setFeatureFlag(flag.key,!flag.enabled)}><i/></button>
        </div>)}
      </section>}
      {adminTab === 'appearance' && <section className="admin-console-card admin-appearance">
  <div className="admin-audit-heading"><strong>مدیریت ظاهر و تنظیمات مرکزی</strong><button className="button button-quiet" type="button" onClick={() => void refreshAppearance()}><Activity size={15}/> تازه‌سازی</button></div>
  <p className="admin-user-policy-note">تغییرات ابتدا در پیش‌نمایش محلی دیده می‌شوند. با انتشار، نسخه جدید در دیتابیس ثبت و برای تمام کاربران وب اعمال می‌شود. فایل‌ها و داده کاربران دست‌نخورده می‌مانند.</p>
  {appearanceLoading ? <div className="admin-loading"><span className="spinner"/><span>در حال دریافت نسخه‌های ظاهر…</span></div> : <>
    <div className="admin-appearance-grid">
      <label>رنگ اصلی <input aria-label="رنگ اصلی" type="color" value={appearanceDraft.accent} onChange={(event) => setAppearanceDraft((value) => ({ ...value, accent: event.target.value }))}/></label>
      <label>پس‌زمینه تیره <input aria-label="رنگ پس‌زمینه" type="color" value={appearanceDraft.background} onChange={(event) => setAppearanceDraft((value) => ({ ...value, background: event.target.value }))}/></label>
      <label>رنگ کارت‌ها <input aria-label="رنگ کارت‌ها" type="color" value={appearanceDraft.surface} onChange={(event) => setAppearanceDraft((value) => ({ ...value, surface: event.target.value }))}/></label>
      <label className="admin-radius-control">گردی گوشه‌ها: {appearanceDraft.radius}px <input type="range" min="8" max="28" value={appearanceDraft.radius} onChange={(event) => setAppearanceDraft((value) => ({ ...value, radius: Number(event.target.value) }))}/></label>
    </div>
    <div className="admin-appearance-preview" style={{ background: appearanceDraft.background, borderRadius: appearanceDraft.radius }}>
      <div style={{ background: appearanceDraft.surface, borderRadius: Math.max(6, appearanceDraft.radius - 4) }}>
        <b style={{ color: appearanceDraft.accent }}>پیش‌نمایش کاوه انتقامجو</b><p>این نمونه قبل از انتشار قابل مشاهده است.</p>
        <button type="button" style={{ background: appearanceDraft.accent, borderRadius: appearanceDraft.radius }}>دکمه نمونه</button>
      </div>
    </div>
    <div className="admin-access-footer"><span>نسخه فعال: {appearanceRows.find((row) => row.is_published)?.version ?? '—'}</span><button className="button button-primary" type="button" disabled={appearanceSaving} onClick={() => void publishAppearance()}><Save size={15}/>{appearanceSaving ? 'در حال انتشار…' : 'انتشار تنظیمات'}</button></div>
    <div className="admin-appearance-history"><strong>تاریخچه نسخه‌ها</strong>{appearanceRows.map((row) => <div className="admin-appearance-version" key={row.id}><span>نسخه {row.version} · {new Date(row.created_at).toLocaleString('fa-IR')} {row.is_published ? '· فعال' : ''}</span>{!row.is_published && canRollbackAppearance && <button className="button button-quiet" type="button" disabled={appearanceSaving} onClick={() => void rollbackAppearance(row.version)}><RotateCcw size={14}/> بازگردانی</button>}</div>)}</div>
  </>}
</section>}
{adminTab === 'ranks' && role === 'owner' && <RankManagementPanel supabase={supabase} notify={notify}/>}
      {adminTab === 'access' && <section className="settings-card admin-access-card">
        <div className="side-info-title"><ShieldCheck size={19}/><strong>تنظیمات دسترسی مهمان</strong></div>
        {loadError && <div className="notice notice-error" role="alert">{loadError}</div>}
        {loading ? (
          <div className="admin-loading"><span className="spinner"/><span>در حال دریافت تنظیمات…</span></div>
        ) : !loadError ? (
          <>
            <p>هر فردی که کد معتبر را داشته باشد، یک حساب مهمان مستقل می‌سازد. این روش به ایمیل نیاز ندارد و به حساب مدیر یا کاربران دیگر وارد نمی‌شود.</p>
            <div className="setting-choice admin-toggle-row">
              <div><strong>فعال بودن ورود با کد</strong><small>{enabled ? 'کاربران می‌توانند با کد وارد شوند.' : 'ورود با کد برای همه غیرفعال است.'}</small></div>
              <button
                className={`switch ${enabled ? 'on' : ''}`}
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => setEnabled((value) => !value)}
                disabled={saving}
                aria-label="فعال یا غیرفعال کردن ورود با کد"
              ><i/></button>
            </div>
            <label className="auth-label" htmlFor="admin-access-code">تنظیم کد جدید (اختیاری)</label>
            <input
              id="admin-access-code"
              className="auth-input admin-code-input"
              type="text"
              inputMode="text"
              autoComplete="off"
              maxLength={6}
              pattern="[A-Za-z0-9]{6}"
              dir="ltr"
              placeholder="برای حفظ کد فعلی خالی بگذارید"
              value={newCode}
              onChange={(event) => setNewCode(normalizeAccessCode(event.target.value))}
              disabled={saving}
            />
            <p className="admin-security-note">کد دسترسی فقط به‌صورت هش امن در پایگاه داده نگهداری می‌شود و پس از ذخیره قابل مشاهده نیست. برای استفاده عمومی، یک کد تصادفی و غیرقابل حدس انتخاب کنید.</p>
            <div className="admin-access-footer">
              <span><KeyRound size={14}/> پنج تلاش اشتباه، محدودیت ۱۵ دقیقه‌ای ایجاد می‌کند.</span>
              <button className="button button-primary" type="button" onClick={() => void save()} disabled={saving}>
                <Save size={16}/>{saving ? 'در حال ذخیره…' : 'ذخیره تنظیمات'}
              </button>
            </div>
          </>
        ) : null}
      </section>}
    </div>
  );
}
