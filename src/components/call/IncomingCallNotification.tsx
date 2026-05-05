import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { toast } from 'sonner';
import { startRingingSound, stopRingingSound } from '@/utils/callSounds';
import { showIncomingCallNotification } from '@/utils/pushNotifications';

export default function IncomingCallNotification() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [caller, setCaller] = useState<any>(null);

  const isFreshCall = (callData: any) => {
    const startedAt = new Date(callData?.started_at || callData?.created_at || 0).getTime();
    return Number.isFinite(startedAt) && Date.now() - startedAt < 45_000;
  };

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    const presentIncomingCall = async (callData: any, notifyDevice = false) => {
      const { data: callerData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', callData.caller_id)
        .single();

      if (!mounted) return;

      setIncomingCall(callData);
      setCaller(callerData);
      startRingingSound();

      if (notifyDevice && callerData) {
        await showIncomingCallNotification(
          callerData.first_name || 'Nova chamada',
          callData.call_type,
          callerData.avatar_url || undefined,
          callData.caller_id,
          callData.id
        );
      }
    };

    const loadExistingIncomingCall = async () => {
      const cutoff = new Date(Date.now() - 45_000).toISOString();

      await supabase
        .from('calls')
        .update({ status: 'missed', ended_at: new Date().toISOString() })
        .eq('receiver_id', user.id)
        .eq('status', 'calling')
        .lt('started_at', cutoff);

      const { data } = await supabase
        .from('calls')
        .select('*')
        .eq('receiver_id', user.id)
        .eq('status', 'calling')
        .gte('started_at', cutoff)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && isFreshCall(data)) {
        await presentIncomingCall(data);
      }
    };

    loadExistingIncomingCall();

    const channel = supabase
      .channel(`incoming_calls:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const callData = payload.new as any;

          if (payload.eventType === 'INSERT' && callData?.status === 'calling' && isFreshCall(callData)) {
            await presentIncomingCall(callData, true);
            return;
          }

          if (payload.eventType === 'UPDATE' && callData?.status === 'calling' && isFreshCall(callData)) {
            await presentIncomingCall(callData);
            return;
          }

          if (payload.eventType === 'UPDATE' && callData?.status !== 'calling') {
            setIncomingCall((prev: any) => {
              if (prev?.id === callData.id) {
                stopRingingSound();
                setCaller(null);
                return null;
              }
              return prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      stopRingingSound();
    };
  }, [user]);

  const acceptCall = async () => {
    if (!incomingCall) return;

    try {
      const mediaPreview = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: incomingCall.call_type === 'video',
      });

      mediaPreview.getTracks().forEach((track) => track.stop());
    } catch (error) {
      toast.error('Permita microfone e câmera para atender a chamada');
      return;
    }

    stopRingingSound();
    await supabase
      .from('calls')
      .update({ status: 'accepted' })
      .eq('id', incomingCall.id);

    navigate(`/chat/${incomingCall.caller_id}?callId=${incomingCall.id}&callType=${incomingCall.call_type}&accept=1`);
    setIncomingCall(null);
    setCaller(null);
  };

  const rejectCall = async () => {
    if (!incomingCall) return;

    stopRingingSound();

    await supabase
      .from('calls')
      .update({ 
        status: 'rejected',
        ended_at: new Date().toISOString(),
      })
      .eq('id', incomingCall.id);

    toast.error('Chamada recusada');
    setIncomingCall(null);
    setCaller(null);
  };

  if (!incomingCall || !caller) return null;

  return (
    <div className="fixed inset-0 bg-mobile-header z-[100] flex items-center justify-center p-6 animate-fade-in text-mobile-header-foreground overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,hsl(var(--mobile-header-soft)),hsl(var(--mobile-header))_50%,hsl(var(--background))_145%)]" />
      <div className="relative w-full max-w-sm animate-scale-in text-center">
        <div className="mb-10">
          <div className="relative mx-auto mb-6 h-32 w-32">
            <div className="absolute -inset-6 rounded-full border border-mobile-header-foreground/20 animate-ping" />
            <div className="absolute -inset-11 rounded-full border border-mobile-header-foreground/10" />
          <Avatar className="relative h-32 w-32 mx-auto ring-4 ring-mobile-header-foreground/20 shadow-2xl">
            <AvatarImage src={caller.avatar_url || undefined} />
            <AvatarFallback className="bg-mobile-header-soft text-mobile-header-foreground text-4xl">
              {caller.first_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          </div>
          <h2 className="text-3xl font-extrabold mb-2">{caller.first_name}</h2>
          <p className="text-mobile-header-foreground/70 flex items-center justify-center gap-2 font-medium">
            {incomingCall.call_type === 'video' ? (
              <>
                <Video className="h-4 w-4" />
                Chamada de vídeo
              </>
            ) : (
              <>
                <Phone className="h-4 w-4" />
                Chamada de voz
              </>
            )}
          </p>
        </div>

        <div className="flex items-center justify-center gap-10">
          <Button
            variant="destructive"
            size="icon"
            className="h-20 w-20 rounded-full shadow-2xl shadow-destructive/30"
            onClick={rejectCall}
            aria-label="Recusar chamada"
          >
            <PhoneOff className="h-8 w-8" />
          </Button>
          <Button
            size="icon"
            className="h-20 w-20 rounded-full bg-success text-success-foreground hover:bg-success/90 shadow-2xl shadow-success/30"
            onClick={acceptCall}
            aria-label="Atender chamada"
          >
            <Phone className="h-8 w-8" />
          </Button>
        </div>
      </div>
    </div>
  );
}
