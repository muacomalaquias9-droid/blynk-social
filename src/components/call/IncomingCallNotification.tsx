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
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-card rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-border animate-scale-in">
        <div className="text-center mb-8">
          <Avatar className="h-24 w-24 mx-auto mb-4 ring-4 ring-primary/20">
            <AvatarImage src={caller.avatar_url || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
              {caller.first_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-2xl font-bold mb-2">{caller.first_name}</h2>
          <p className="text-muted-foreground flex items-center justify-center gap-2">
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

        <div className="flex gap-4">
          <Button
            variant="destructive"
            size="lg"
            className="flex-1 h-16 rounded-full"
            onClick={rejectCall}
          >
            <PhoneOff className="h-6 w-6 mr-2" />
            Recusar
          </Button>
          <Button
            size="lg"
            className="flex-1 h-16 rounded-full bg-green-500 hover:bg-green-600"
            onClick={acceptCall}
          >
            <Phone className="h-6 w-6 mr-2" />
            Atender
          </Button>
        </div>
      </div>
    </div>
  );
}
