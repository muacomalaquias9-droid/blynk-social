import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { toast } from 'sonner';
import { startRingingSound, stopRingingSound } from '@/utils/callSounds';

export default function IncomingCallNotification() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [caller, setCaller] = useState<any>(null);
  // Sounds are now generated programmatically

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('incoming_calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.new.status === 'calling') {
            setIncomingCall(payload.new);
            
            // Load caller info
            const { data: callerData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', payload.new.caller_id)
              .single();
            
            setCaller(callerData);
            
            // Play ringing sound
            startRingingSound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopRingingSound();
    };
  }, [user]);

  const acceptCall = async () => {
    if (!incomingCall) return;

    stopRingingSound();
    await supabase
      .from('calls')
      .update({ status: 'accepted' })
      .eq('id', incomingCall.id);

    navigate(`/chamada/${incomingCall.caller_id}?type=${incomingCall.call_type}`);
    setIncomingCall(null);
    setCaller(null);
  };

  const rejectCall = async () => {
    if (!incomingCall) return;

    ringingSound.pause();
    ringingSound.currentTime = 0;

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
