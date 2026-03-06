import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Hook global para gerenciar presença do usuário
export const useGlobalUserPresence = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const setOnline = async () => {
      await supabase.from('user_presence').upsert({
        user_id: user.id,
        is_online: true,
        last_seen: new Date().toISOString(),
      });
    };

    const setOffline = async () => {
      // Use sendBeacon for reliable offline marking on page close
      await supabase.from('user_presence').update({
        is_online: false,
        last_seen: new Date().toISOString(),
      }).eq('user_id', user.id);
    };

    setOnline();

    // Heartbeat every 30s - if user misses 2 heartbeats (60s), they're considered offline
    const interval = setInterval(setOnline, 30000);

    // Cleanup stale online users (haven't sent heartbeat in 90s)
    const cleanupInterval = setInterval(async () => {
      const cutoff = new Date(Date.now() - 90000).toISOString();
      await supabase.from('user_presence').update({ is_online: false })
        .eq('is_online', true)
        .lt('last_seen', cutoff);
    }, 60000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setOffline();
      } else {
        setOnline();
      }
    };

    const handleBeforeUnload = () => {
      // Use navigator.sendBeacon for reliability
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${user.id}`;
      const body = JSON.stringify({ is_online: false, last_seen: new Date().toISOString() });
      navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      clearInterval(cleanupInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      setOffline();
    };
  }, [user]);
};
