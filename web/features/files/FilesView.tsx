'use client';
import { Activity, ArrowDownToLine, File, FilePlus2, FolderOpen, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FileAsset } from '@/lib/types';
import type { Notify } from '@/lib/ui-types';
import { formatBytes, formatDate, safeDisplayName, validateUpload } from '@/lib/format';
import { hashFile } from '@/lib/files';
import { EmptyState, SectionHeader } from '@/components/ui';

export default function FilesView({ supabase, userId, notify }: { supabase: SupabaseClient; userId: string; notify: Notify }) {
  const [files, setFiles] = useState<FileAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    setLoading(true); const { data, error } = await supabase.from('file_assets').select('*').eq('owner_id', userId).order('created_at', { ascending: false }).limit(100);
    if (error) notify(`دریافت فایل‌ها ناموفق بود: ${error.message}`, 'error'); else setFiles((data ?? []) as FileAsset[]); setLoading(false);
  }, [supabase, userId, notify]);
  useEffect(() => { void load(); }, [load]);

  const uploadFiles = async (selected: FileList | File[]) => {
    const list = Array.from(selected); if (!list.length) return;
    const invalid = list.find((f) => validateUpload(f));
    if (invalid) { notify(`${safeDisplayName(invalid.name)}: ${validateUpload(invalid)}`, 'error'); return; }
    setUploading(true); setProgress(0);
    let succeeded = 0; let failed = 0;
    for (let i = 0; i < list.length; i++) {
      const file = list[i]; const path = `${userId}/${crypto.randomUUID()}`;
      try {
        const sha256Hex = await hashFile(file);
        const { error: uploadError } = await supabase.storage.from('user-files').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase.from('file_assets').insert({ owner_id: userId, bucket_id: 'user-files', object_path: path, original_name: safeDisplayName(file.name), mime_type: file.type || null, byte_size: file.size, sha256_hex: sha256Hex, status: 'ready' });
        if (insertError) { await supabase.storage.from('user-files').remove([path]); throw insertError; }
        succeeded += 1;
        setProgress(Math.round(((i + 1) / list.length) * 100));
      } catch (error) { failed += 1; const message = error instanceof Error ? error.message : 'خطای ناشناخته'; notify(`آپلود ${file.name} ناموفق بود: ${message}`, 'error'); }
    }
    setUploading(false); await load();
    if (failed === 0) notify(`${succeeded} فایل با موفقیت بارگذاری شد.`);
    else notify(`بارگذاری پایان یافت: ${succeeded} موفق، ${failed} ناموفق.`, 'error');
  };
  const download = async (file: FileAsset) => {
    const { data, error } = await supabase.storage.from(file.bucket_id).createSignedUrl(file.object_path, 90, { download: safeDisplayName(file.original_name) });
    if (error || !data?.signedUrl) { notify(`دریافت لینک امن ناموفق بود: ${error?.message ?? 'خطای نامشخص'}`, 'error'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };
  const onInput = (event: ChangeEvent<HTMLInputElement>) => { if (event.target.files) void uploadFiles(event.target.files); event.target.value = ''; };
  return <div className="page-stack"><SectionHeader eyebrow="فضای ذخیره‌سازی ابری" title="فایل‌های من" description="هر نوع فایل تا سقف ۵۰٬۰۰۰٬۰۰۰ بایت؛ با نام اصلی و فضای خصوصی." action={<button className="button button-primary" onClick={() => inputRef.current?.click()} disabled={uploading}><Plus size={17}/> افزودن فایل</button>}/>
    <input ref={inputRef} type="file" multiple className="visually-hidden" onChange={onInput}/>
    <div className={`dropzone ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); void uploadFiles(e.dataTransfer.files); }} onClick={() => !uploading && inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}><div className="drop-icon"><FilePlus2 size={24}/></div><h3>{uploading ? 'در حال بارگذاری فایل‌ها…' : 'فایل‌ها را اینجا رها کن'}</h3><p>یا برای انتخاب از دستگاه کلیک کن · بدون محدودیت پسوند</p><div className="upload-limit">حداکثر حجم هر فایل <strong>۵۰ MB</strong></div>{uploading && <><div className="progress-track"><i style={{ width: `${progress}%` }}/></div><small className="upload-progress-label">پیشرفت دستهٔ فایل‌ها: {progress}٪</small></>}</div>
    <div className="files-toolbar"><div><strong>فایل‌های ذخیره‌شده</strong><span>{files.length} مورد</span></div><button className="icon-button" onClick={() => void load()} title="تازه‌سازی"><Activity size={18}/></button></div>
    {loading ? <div className="skeleton-list"><div className="skeleton-card"/><div className="skeleton-card"/></div> : files.length === 0 ? <EmptyState icon={<FolderOpen/>} title="فضای فایل هنوز خالی است" description="اولین فایل خودت را بارگذاری کن. فایل‌ها به‌صورت خصوصی نگهداری می‌شوند."/> : <div className="file-grid">{files.map((file) => <article className="file-card" key={file.id}><div className="file-type-icon"><File size={22}/></div><div className="file-card-info"><strong title={file.original_name}>{file.original_name}</strong><span>{formatBytes(Number(file.byte_size))} · {file.mime_type ?? 'نوع ناشناخته'}</span><small>{formatDate(file.created_at)}</small></div><button className="icon-button" onClick={() => void download(file)} title="دانلود امن"><ArrowDownToLine size={18}/></button></article>)}</div>}
  </div>;
}
