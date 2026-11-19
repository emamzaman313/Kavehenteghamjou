export const MAX_REEL_VIDEO_BYTES = 50_000_000;
export const MAX_REEL_COVER_BYTES = 10_000_000;
export const MAX_REEL_DURATION_SECONDS = 600;

type MediaFile = { type: string; size: number };

export function validateReelUpload(
  video: MediaFile | null,
  cover: MediaFile | null,
  durationSeconds: number | null,
): string | null {
  if (!video || !video.type.startsWith('video/')) return 'یک فایل ویدیویی معتبر انتخاب کنید.';
  if (video.size <= 0 || video.size > MAX_REEL_VIDEO_BYTES) return 'حجم ویدئو باید بیشتر از صفر و حداکثر ۵۰ مگابایت باشد.';
  if (cover && !cover.type.startsWith('image/')) return 'تصویر جلد باید یک فایل تصویری معتبر باشد.';
  if (cover && (cover.size <= 0 || cover.size > MAX_REEL_COVER_BYTES)) return 'حجم تصویر جلد باید بیشتر از صفر و حداکثر ۱۰ مگابایت باشد.';
  if (durationSeconds !== null && (durationSeconds < 1 || durationSeconds > MAX_REEL_DURATION_SECONDS)) return 'مدت ریلز باید حداکثر ۱۰ دقیقه باشد.';
  return null;
}
