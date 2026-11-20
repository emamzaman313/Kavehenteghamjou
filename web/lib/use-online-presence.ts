'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export function useOnlinePresence(supabase: SupabaseClient | null, userId?: string, displayName?: string) {
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!supabase || !userId) {
      setOnlineUserIds([]);
      return;
    }

    let active = true;
    const channel = supabase.channel('kaveh:online-users', {
      config: { presence: { key: userId } },
    });

    const sync = () => {
      if (!active) return;
      const state = channel.presenceState<{ user_id?: string }>();
      setOnlineUserIds(Object.values(state).flat().map((entry) => entry.user_id).filter((id): id is string => Boolean(id)));
    };

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && active) {
          await channel.track({
            user_id: userId,
            display_name: (displayName ?? '').slice(0, 80),
            online_at: new Date().toISOString(),
          });
          sync();
        }
      });

    return () => {
      active = false;
      setOnlineUserIds([]);
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, displayName]);

  return onlineUserIds;
}
