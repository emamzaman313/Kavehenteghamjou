'use client';

import type { CSSProperties } from 'react';

export const RPG_ICON_OPTIONS = [
  { value: 'bolt', label: 'انرژی' },
  { value: 'diamond', label: 'الماس' },
  { value: 'sword', label: 'شمشیر' },
  { value: 'skull', label: 'جمجمه' },
  { value: 'star', label: 'ستاره' },
  { value: 'potion', label: 'معجون' },
  { value: 'trophy', label: 'جام' },
  { value: 'hourglass', label: 'ساعت شنی' },
  { value: 'coin', label: 'سکه' },
  { value: 'axe', label: 'تبر' },
  { value: 'flame', label: 'شعله' },
  { value: 'shield', label: 'سپر' },
  { value: 'heart', label: 'قلب' },
  { value: 'bomb', label: 'بمب' },
  { value: 'mana', label: 'اکسیر آبی' },
] as const;

export type RpgIconName = typeof RPG_ICON_OPTIONS[number]['value'];

const colors: Record<RpgIconName, string> = {
  bolt: '#ffb52e', diamond: '#35b9e8', sword: '#b77be8', skull: '#f3f4f6',
  star: '#ffe23f', potion: '#64d98c', trophy: '#ff9e32', hourglass: '#d78a61',
  coin: '#ffd33d', axe: '#d8e4ed', flame: '#ff8b24', shield: '#c8e5f5',
  heart: '#ff3e52', bomb: '#cbd5e1', mana: '#25a9e8',
};

export default function RpgIcon({ name, size = 30, className, title }: {
  name?: string | null; size?: number; className?: string; title?: string;
}) {
  const key = (RPG_ICON_OPTIONS.some((item) => item.value === name) ? name : 'trophy') as RpgIconName;
  const fill = colors[key];
  const common = { fill, stroke: '#202333', strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'square' as const };
  let art;
  switch (key) {
    case 'bolt': art = <><path {...common} d="M18 2 6 18h8l-2 12 14-18h-9z"/><path d="m9 19 5-1-1 7" fill="#fff2a6"/></>; break;
    case 'diamond': art = <><path {...common} d="m4 11 7-8h10l7 8-12 18z"/><path d="m11 3 5 26 5-26M4 11h24" fill="none" stroke="#d8f7ff" strokeWidth="2"/></>; break;
    case 'sword': art = <><path {...common} d="m5 25 17-19 5 5L8 28z"/><path d="m4 21 7 7M19 6l7 7" fill="none" stroke="#f3e8ff" strokeWidth="3"/><path d="m3 26 4 4" stroke="#a45a35" strokeWidth="5"/></>; break;
    case 'skull': art = <><path {...common} d="M5 15a11 11 0 1 1 22 0c0 5-3 7-5 9v4H10v-4c-3-2-5-5-5-9z"/><path d="M10 14h4v4h-4zm8 0h4v4h-4zM14 21h4v3h-4z" fill="#242334"/></>; break;
    case 'star': art = <><path {...common} d="m16 2 4 9 10 1-7.5 7 2 11L16 24l-8.5 6 2-11L2 12l10-1z"/><path d="m16 5 2 8 7 1-6 5 1 7-4-3" fill="#fff5a4"/></>; break;
    case 'potion': art = <><path {...common} d="M12 3h8v5l3 4v14l-3 3H12l-4-3V12l4-4z"/><path d="M9 19h14v7l-3 2h-8l-3-2z" fill="#54dc83"/><path d="M12 3h8M12 8h8" stroke="#f2f5f8" strokeWidth="2"/></>; break;
    case 'trophy': art = <><path {...common} d="M9 4h14v8c0 6-3 9-7 9s-7-3-7-9z"/><path d="M9 7H4v4c0 5 3 7 7 7m12-11h5v4c0 5-3 7-7 7M16 21v6m-7 2h14" fill="none" stroke="#202333" strokeWidth="3"/><path d="M11 6h10v6c0 4-2 6-5 6s-5-2-5-6z" fill="#ffb53f"/></>; break;
    case 'hourglass': art = <><path {...common} d="M8 3h16v5l-6 8 6 8v5H8v-5l6-8-6-8z"/><path d="M11 6h10l-5 7zm0 20h10l-5-7z" fill="#d78a61"/></>; break;
    case 'coin': art = <><circle {...common} cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="8" fill="none" stroke="#fff1a0" strokeWidth="2"/><path d="M18 9h-4v14h4m-5-7h7" fill="none" stroke="#b77913" strokeWidth="2.5"/></>; break;
    case 'axe': art = <><path {...common} d="M5 27 20 10l4 4L9 31z"/><path d="M16 11 22 4q7 0 8 7l-6 7z" fill="#dce9f3" stroke="#202333" strokeWidth="2.2"/><path d="m5 27 4 4" stroke="#b66a35" strokeWidth="4"/></>; break;
    case 'flame': art = <><path {...common} d="M17 2c2 8-5 8-2 14 2-3 5-4 6-8 7 8 8 14 3 20-5 6-16 4-19-3C2 17 13 12 17 2z"/><path d="M16 18c4 4 4 7 1 10-3 1-6-1-5-5z" fill="#ffe45b"/></>; break;
    case 'shield': art = <><path {...common} d="M16 2 28 7v9c0 8-5 12-12 15C9 28 4 24 4 16V7z"/><path d="m16 6 8 3v7c0 5-3 8-8 11-5-3-8-6-8-11V9z" fill="#f4f8fc"/></>; break;
    case 'heart': art = <><path {...common} d="M16 29 4 17C-2 8 8 1 16 9 24 1 34 8 28 17z"/><path d="m7 11 4-3 4 4" fill="none" stroke="#ffb5bd" strokeWidth="2.5"/></>; break;
    case 'bomb': art = <><circle {...common} cx="15" cy="18" r="12"/><path d="m22 8 4-5m-2 1 5 2" stroke="#d99a46" strokeWidth="3"/><path d="M12 11q5-3 8 1" fill="none" stroke="#fff" strokeWidth="2"/></>; break;
    case 'mana': art = <><path {...common} d="M12 3h8v5l4 5v14l-4 3H12l-4-3V13l4-5z"/><path d="M9 20h14v7l-3 2h-8l-3-2z" fill="#31bde9"/><path d="M12 3h8M12 8h8" stroke="#e3f7ff" strokeWidth="2"/><path d="M13 23h6" stroke="#fff" strokeWidth="2"/></>; break;
  }
  const style: CSSProperties = { width: size, height: size, imageRendering: 'pixelated', flex: '0 0 auto' };
  return <svg className={className} style={style} viewBox="0 0 32 32" role={title ? 'img' : 'presentation'} aria-label={title} aria-hidden={title ? undefined : true} shapeRendering="crispEdges">{art}</svg>;
}
