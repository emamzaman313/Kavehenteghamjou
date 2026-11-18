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
  return <div className="brand-mark" aria-hidden="true"><span>ک</span><i /></div>;
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="section-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

