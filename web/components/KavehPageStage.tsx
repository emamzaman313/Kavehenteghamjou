'use client';

import {
  Activity, ArrowLeft, Bell, Compass, Film, FolderOpen, Home, LifeBuoy,
  MessageCircle, Settings, ShieldCheck, Sparkles, Trophy, UserRound, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PointerEvent } from 'react';

type Destination =
  | 'home' | 'chats' | 'support' | 'world' | 'files' | 'discover'
  | 'social' | 'profile' | 'notifications' | 'settings' | 'admin';

type StageData = {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  index: string;
  actions: Destination[];
};

const stageData: Record<Destination, StageData> = {
  home: {
    eyebrow: 'YOUR PERSONAL UNIVERSE',
    title: 'فضای تو، جهان تو',
    subtitle: 'از جریان تازه‌ها تا گفتگوها و تجربه‌های اجتماعی؛ همه‌چیز از این نقطه به هم متصل است.',
    icon: Home, index: '01', actions: ['chats', 'social', 'world'],
  },
  chats: {
    eyebrow: 'PRIVATE COMMUNICATION',
    title: 'ارتباط نزدیک‌تر، ساده‌تر',
    subtitle: 'گفتگوهای خصوصی و گروهی را دنبال کن و برای پیدا کردن همراهان تازه به اکتشاف برو.',
    icon: MessageCircle, index: '02', actions: ['discover', 'files', 'support'],
  },
  support: {
    eyebrow: 'CARE & SUPPORT',
    title: 'همیشه یک راه ارتباط هست',
    subtitle: 'درخواست‌ها و پیگیری‌های پشتیبانی را از یک فضای منظم و در دسترس مدیریت کن.',
    icon: LifeBuoy, index: '03', actions: ['chats', 'notifications', 'home'],
  },
  world: {
    eyebrow: 'KAVEH WORLD',
    title: 'مسیر پیشرفتت را بساز',
    subtitle: 'مأموریت‌ها، رویدادها، رتبه‌ها و نشان‌ها را در جهان کاوه دنبال کن.',
    icon: Trophy, index: '04', actions: ['profile', 'social', 'home'],
  },
  files: {
    eyebrow: 'PRIVATE VAULT',
    title: 'خزانهٔ شخصی تو',
    subtitle: 'فایل‌ها و پیوست‌های خودت را در یک فضای متمرکز پیدا و مدیریت کن.',
    icon: FolderOpen, index: '05', actions: ['chats', 'home', 'profile'],
  },
  discover: {
    eyebrow: 'EXPLORE THE COMMUNITY',
    title: 'چیزهای تازه را کشف کن',
    subtitle: 'به آدم‌ها، علایق و محتواهای تازه نزدیک شو و ارتباط‌های جدید بساز.',
    icon: Compass, index: '06', actions: ['chats', 'social', 'profile'],
  },
  social: {
    eyebrow: 'KAVEH STUDIO',
    title: 'رسانه را تجربه کن',
    subtitle: 'ریلز، موسیقی و محتوای روز در استودیوی اجتماعی کاوه کنار هم قرار می‌گیرند.',
    icon: Film, index: '07', actions: ['discover', 'world', 'files'],
  },
  profile: {
    eyebrow: 'YOUR DIGITAL IDENTITY',
    title: 'هویت دیجیتال تو',
    subtitle: 'پروفایل، نشان‌ها، تنظیمات نمایش و جزئیات حساب خودت را شخصی‌سازی کن.',
    icon: UserRound, index: '08', actions: ['world', 'settings', 'social'],
  },
  notifications: {
    eyebrow: 'ACTIVITY CENTER',
    title: 'اتفاق‌ها را از دست نده',
    subtitle: 'به‌روزرسانی‌ها و پیام‌های مهم حساب خود را از مرکز اعلان‌ها پیگیری کن.',
    icon: Bell, index: '09', actions: ['chats', 'world', 'settings'],
  },
  settings: {
    eyebrow: 'PERSONAL CONTROL',
    title: 'تجربه را مطابق خودت بساز',
    subtitle: 'ترجیحات حساب، ظاهر و تنظیمات شخصی را در کنترل خودت نگه دار.',
    icon: Settings, index: '10', actions: ['profile', 'home', 'support'],
  },
  admin: {
    eyebrow: 'COMMAND CENTER',
    title: 'فرماندهی و مدیریت کاوه',
    subtitle: 'ابزارهای مدیریتی و کنترل‌های پلتفرم را از فضای متمرکز مدیریت کن.',
    icon: ShieldCheck, index: '11', actions: ['world', 'social', 'notifications'],
  },
};

const labels: Record<Destination, { title: string; icon: LucideIcon }> = {
  home: { title: 'خانه', icon: Home },
  chats: { title: 'گفتگوها', icon: MessageCircle },
  support: { title: 'پشتیبانی', icon: LifeBuoy },
  world: { title: 'جهان کاوه', icon: Trophy },
  files: { title: 'خزانه فایل', icon: FolderOpen },
  discover: { title: 'اکتشاف', icon: Compass },
  social: { title: 'استودیو و ریلز', icon: Film },
  profile: { title: 'پروفایل', icon: Users },
  notifications: { title: 'اعلان‌ها', icon: Bell },
  settings: { title: 'تنظیمات', icon: Settings },
  admin: { title: 'مدیریت', icon: ShieldCheck },
};

export default function KavehPageStage({
  activeTab,
  isAdmin,
  unread,
  onNavigate,
}: {
  activeTab: Destination;
  isAdmin: boolean;
  unread: number;
  onNavigate: (destination: Destination) => void;
}) {
  const stage = stageData[activeTab];
  const StageIcon = stage.icon;
  const actions = stage.actions.filter((id) => id !== 'admin' || isAdmin);

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    event.currentTarget.style.setProperty('--stage-pointer-x', (x * 100).toFixed(1) + '%');
    event.currentTarget.style.setProperty('--stage-pointer-y', (y * 100).toFixed(1) + '%');
    event.currentTarget.style.setProperty('--stage-pointer-rx', ((0.5 - y) * 3.2).toFixed(2) + 'deg');
    event.currentTarget.style.setProperty('--stage-pointer-ry', ((x - 0.5) * 3.2).toFixed(2) + 'deg');
  };

  const resetPointer = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.style.removeProperty('--stage-pointer-x');
    event.currentTarget.style.removeProperty('--stage-pointer-y');
    event.currentTarget.style.removeProperty('--stage-pointer-rx');
    event.currentTarget.style.removeProperty('--stage-pointer-ry');
  };

  return (
    <section
      className={'kaveh-page-stage kaveh-stage-' + activeTab}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      aria-label="معرفی بخش فعال"
    >
      <div className="kaveh-stage-backdrop" aria-hidden="true">
        <span className="kaveh-stage-grid" />
        <span className="kaveh-stage-glow" />
        <div className="kaveh-stage-orbit kaveh-stage-orbit-one"><i /><i /><i /></div>
        <div className="kaveh-stage-orbit kaveh-stage-orbit-two"><i /><i /></div>
        <div className="kaveh-stage-core"><StageIcon size={34} strokeWidth={1.45} /></div>
        <span className="kaveh-stage-spark kaveh-stage-spark-one" />
        <span className="kaveh-stage-spark kaveh-stage-spark-two" />
      </div>

      <div className="kaveh-stage-copy">
        <div className="kaveh-stage-meta">
          <span className="kaveh-stage-kicker"><i /> {stage.eyebrow}</span>
          <span className="kaveh-stage-index">{stage.index}<b> / 11</b></span>
        </div>
        <h1>{stage.title}</h1>
        <p>{stage.subtitle}</p>
        <div className="kaveh-stage-actions">
          {actions.map((id) => {
            const Icon = labels[id].icon;
            return (
              <button type="button" key={id} onClick={() => onNavigate(id)}>
                <Icon size={14} /><span>{labels[id].title}</span><ArrowLeft size={12} />
                {id === 'notifications' && unread > 0 && <b>{unread > 99 ? '۹۹+' : unread}</b>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="kaveh-stage-art" aria-hidden="true">
        <div className="kaveh-stage-art-caption"><span>KA</span><i /> KAVEH / {stage.index}</div>
        <div className="kaveh-stage-art-ring ring-large" />
        <div className="kaveh-stage-art-ring ring-small" />
        <div className="kaveh-stage-art-diamond" />
        <div className="kaveh-stage-art-beam" />
        <div className="kaveh-stage-art-label"><Sparkles size={13} /> BUILT AROUND YOU</div>
      </div>
    </section>
  );
}
