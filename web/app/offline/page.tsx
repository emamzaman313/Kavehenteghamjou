import Link from 'next/link';

export default function OfflinePage() {
  return <main className="offline-page" dir="rtl" lang="fa">
    <section className="offline-card">
      <span className="offline-mark" aria-hidden="true">ک</span>
      <p className="eyebrow">KAVEH AVENGER</p>
      <h1>اتصال اینترنت در دسترس نیست</h1>
      <p>برای حفظ حریم خصوصی، گفتگوها و محتوای حساب روی این دستگاه ذخیره نمی‌شوند. بعد از اتصال دوباره، صفحه را بارگذاری کن.</p>
      <Link href="/">تلاش دوباره</Link>
    </section>
  </main>;
}
