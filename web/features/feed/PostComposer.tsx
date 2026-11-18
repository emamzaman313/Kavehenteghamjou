'use client';

import { Cloud, FileText, ImagePlus, Paperclip, Send, Video, X } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FileAsset } from '@/lib/types';
import type { Notify } from '@/lib/ui-types';
import { formatBytes, safeDisplayName, validateUpload } from '@/lib/format';
import { Avatar } from '@/components/ui';

const MAX_FILES = 4;

export default function PostComposer({ supabase, userId, notify, onPublished }: {
  supabase: SupabaseClient;
  userId: string;
  notify: Notify;
  onPublished: () => void;
}) {
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [cloudItems, setCloudItems] = useState<FileAsset[]>([]);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const addFiles = (selected: FileList | File[]) => {
    const next = Array.from(selected);
    if (!next.length) return;
    if (files.length + next.length > MAX_FILES) return notify('حداکثر ۴ فایل برای هر پست مجاز است.', 'error');
    const invalid = next.find((file) => validateUpload(file));
    if (invalid) return notify(`${safeDisplayName(invalid.name)}: ${validateUpload(invalid)}`, 'error');
    setFiles((current) => [...current, ...next]);
  };

  const openCloud = async () => {
    setCloudOpen((value) => !value);
    if (cloudItems.length || cloudLoading) return;
    setCloudLoading(true);
    const { data, error } = await supabase.from('file_assets').select('*').eq('owner_id', userId).eq('status', 'ready').order('created_at', { ascending: false }).limit(100);
    setCloudLoading(false);
    if (error) notify(`دریافت فایل‌های ابری ناموفق بود: ${error.message}`, 'error');
    else setCloudItems((data ?? []) as FileAsset[]);
  };

  const addCloudFile = async (asset: FileAsset) => {
    if (files.length >= MAX_FILES) return notify('حداکثر ۴ فایل برای هر پست مجاز است.', 'error');
    setCloudLoading(true);
    const { data, error } = await supabase.storage.from(asset.bucket_id).download(asset.object_path);
    setCloudLoading(false);
    if (error || !data) return notify('دریافت فایل از فضای ابری ناموفق بود.', 'error');
    setFiles((current) => [...current, new File([data], safeDisplayName(asset.original_name), { type: asset.mime_type || data.type || 'application/octet-stream' })]);
    setCloudOpen(false);
    notify('فایل انتخاب شد؛ یک نسخهٔ عمومی از آن به پست پیوست می‌شود.');
  };

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (publishing || (!body.trim() && !files.length)) return;
    setPublishing(true);
    const { data: post, error: postError } = await supabase.from('posts').insert({
      author_id: userId, body: body.trim(), visibility: 'public',
      comments_enabled: true, published_at: new Date().toISOString(),
    }).select('id').single();
    if (postError || !post?.id) {
      setPublishing(false);
      return notify(`انتشار پست ناموفق بود: ${postError?.message ?? 'خطای ناشناخته'}`, 'error');
    }

    const uploaded: string[] = [];
    try {
      for (const file of files) {
        const path = `${userId}/${crypto.randomUUID()}`;
        const { error } = await supabase.storage.from('post-media').upload(path, file, {
          upsert: false, contentType: file.type || 'application/octet-stream', cacheControl: '3600',
        });
        if (error) throw error;
        uploaded.push(path);
        const { error: rowError } = await supabase.from('post_attachments').insert({
          post_id: post.id, author_id: userId, bucket_id: 'post-media',
          object_path: path, original_name: safeDisplayName(file.name),
          mime_type: file.type || null, byte_size: file.size,
        });
        if (rowError) throw rowError;
      }
    } catch (error) {
      if (uploaded.length) await supabase.storage.from('post-media').remove(uploaded);
      await supabase.from('posts').delete().eq('id', post.id).eq('author_id', userId);
      setPublishing(false);
      return notify(`بارگذاری رسانه ناموفق بود: ${error instanceof Error ? error.message : 'خطای ناشناخته'}`, 'error');
    }
    setPublishing(false);
    setBody('');
    setFiles([]);
    notify('پست با موفقیت منتشر شد.');
    onPublished();
  };

  return <form className="composer-card" onSubmit={(event) => void publish(event)}>
    <div className="composer-top"><Avatar profile={{ display_name: 'شما' }} size="md"/><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="چه چیزی می‌خواهی با دیگران به اشتراک بگذاری؟" rows={3} maxLength={5000}/></div>
    {files.length > 0 && <div className="composer-attachments">{files.map((file, index) => <div className="composer-file" key={`${file.name}-${index}`}><span>{file.type.startsWith('video/') ? <Video size={16}/> : file.type.startsWith('image/') ? <ImagePlus size={16}/> : <Paperclip size={16}/>}</span><div><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></div><button type="button" className="icon-button" title="حذف فایل" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}><X size={16}/></button></div>)}</div>}
    {cloudOpen && <div className="cloud-picker"><div className="cloud-picker-head"><strong>انتخاب از فضای ابری من</strong><button type="button" className="icon-button" onClick={() => setCloudOpen(false)}><X size={16}/></button></div>{cloudLoading ? <p>در حال دریافت فایل‌ها…</p> : cloudItems.length ? <div className="cloud-picker-list">{cloudItems.map((asset) => <button type="button" key={asset.id} onClick={() => void addCloudFile(asset)}><FileText size={17}/><span><strong>{asset.original_name}</strong><small>{formatBytes(Number(asset.byte_size))}</small></span><ImagePlus size={15}/></button>)}</div> : <p>هنوز فایلی در فضای ابری ذخیره نکرده‌ای.</p>}</div>}
    <input ref={input} className="visually-hidden" type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar" onChange={(event: ChangeEvent<HTMLInputElement>) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }}/>
    <div className="composer-bottom"><div className="composer-tools"><button type="button" onClick={() => input.current?.click()} disabled={publishing}><ImagePlus size={17}/> عکس / ویدئو / فایل</button><button type="button" onClick={() => void openCloud()} disabled={publishing}><Cloud size={17}/> از فضای ابری</button><span className="composer-limit">حداکثر ۴ فایل · هرکدام ۵۰ مگابایت</span></div><button className="button button-primary" disabled={publishing || (!body.trim() && !files.length)}>{publishing ? 'در حال انتشار…' : 'انتشار پست'}<Send size={16}/></button></div>
  </form>;
}
