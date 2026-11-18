import type { ReactNode } from 'react';
import type { Profile } from '@/lib/types';
import { initials } from '@/lib/format';

export function Avatar({ profile, size = 'md' }: { profile?: Partial<Profile> | null; size?: 'sm' | 'md' | 'lg' }) {
  const cls = `avatar avatar-${size}`;
  return profile?.avatar_url
    ? <img className={cls} src={profile.avatar_url} alt={profile.display_name ?? 'کاربر'} />
    : <span className={`${cls} avatar-fallback`}>{initials(profile?.display_name ?? 'کاوه')}</span>;
}

export function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><svg viewBox="0 0 100 100" role="img">
    <defs><linearGradient id="kaveh-blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8ce7ff"/><stop offset=".55" stopColor="#168bff"/><stop offset="1" stopColor="#063dba"/></linearGradient></defs>
    <rect x="3" y="3" width="94" height="94" rx="23" fill="#03060c" stroke="url(#kaveh-blue)" strokeWidth="2.5"/>
    <g fill="#f5f9ff">
      <ellipse cx="35" cy="35" rx="8.2" ry="21" transform="rotate(-42 35 35)"/>
      <ellipse cx="65" cy="35" rx="8.2" ry="21" transform="rotate(42 65 35)"/>
      <ellipse cx="35" cy="65" rx="8.2" ry="21" transform="rotate(42 35 65)"/>
      <ellipse cx="65" cy="65" rx="8.2" ry="21" transform="rotate(-42 65 65)"/>
      <circle cx="50" cy="17" r="5.2"/><circle cx="17" cy="50" r="5.2"/><circle cx="83" cy="50" r="5.2"/><circle cx="50" cy="83" r="5.2"/>
    </g>
    <circle cx="50" cy="50" r="8.4" fill="#03060c" stroke="#f5f9ff" strokeWidth="2.8"/>
  </svg></div>
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="section-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

