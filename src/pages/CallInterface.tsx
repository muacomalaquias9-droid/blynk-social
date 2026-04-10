import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react';
import { toast } from 'sonner';
import CallInterfaceComponent from '@/components/call/CallInterface';

export default function CallInterface() {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const callType = searchParams.get('type') || 'voice';
  const navigate = useNavigate();
  const { user } = useAuth();
  const [otherUser, setOtherUser] = useState<any>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState<'calling' | 'ringing' | 'connected' | 'ended'>('calling');
  const [callDuration, setCallDuration] = useState(0);
  const [showCallInterface, setShowCallInterface] = useState(false);
  const [callingSound] = useState(() => new Audio('/sounds/calling.mp3'));
  const [connectSound] = useState(() => new Audio('/sounds/connect.mp3'));
  const [hangupSound] = useState(() => new Audio('/sounds/hangup.mp3'));

  useEffect(() => {
    if (userId && user) {
      loadUser();
      initiateCall();
    }
    
    return () => {
      callingSound.pause();
      callingSound.currentTime = 0;
    };
  }, [userId, user]);

  useEffect(() => {
    let interval: ReturnType<typeof setTimeout>;
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus]);

  const loadUser = async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setOtherUser(data);
    }
  };

  const initiateCall = async () => {
    if (!userId || !user) return;

    try {
      const { data, error } = await supabase
        .from('calls')
        .insert({
          caller_id: user.id,
          receiver_id: userId,
          call_type: callType,
          status: 'calling',
        })
        .select()
        .single();

      if (error) throw error;

      setCallId(data.id);
      setCallStatus('ringing');

      // Play calling sound
      callingSound.loop = true;
      callingSound.play().catch(console.error);

      // Subscribe to call status changes
      const channel = supabase
        .channel(`call_status:${data.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `id=eq.${data.id}`,
          },
          (payload) => {
            if (payload.new.status === 'accepted') {
              callingSound.pause();
              callingSound.currentTime = 0;
              connectSound.play().catch(console.error);
              setCallStatus('connected');
              setShowCallInterface(true);
            } else if (payload.new.status === 'rejected' || payload.new.status === 'missed') {
              callingSound.pause();
              callingSound.currentTime = 0;
              setCallStatus('ended');
              toast.error('Chamada não atendida');
              setTimeout(() => navigate(-1), 1500);
            }
          }
        )
        .subscribe();
    } catch (error: any) {
      console.error('Error initiating call:', error);
      toast.error('Erro ao iniciar chamada');
      navigate(-1);
    }
  };

  const endCall = async () => {
    if (!callId) return;

    try {
      callingSound.pause();
      callingSound.currentTime = 0;
      hangupSound.play().catch(console.error);

      await supabase
        .from('calls')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', callId);

      setCallStatus('ended');
      setTimeout(() => {
        navigate(-1);
      }, 1000);
    } catch (error) {
      console.error('Error ending call:', error);
      navigate(-1);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'calling':
        return 'Iniciando chamada...';
      case 'ringing':
        return 'Chamando...';
      case 'connected':
        return formatDuration(callDuration);
      case 'ended':
        return 'Chamada encerrada';
      default:
        return '';
    }
  };

  if (!otherUser) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (showCallInterface && callId) {
    return (
      <CallInterfaceComponent
        callId={callId}
        isVideo={callType === 'video'}
        onEnd={() => navigate(-1)}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col items-center justify-between bg-gradient-to-b from-primary/20 to-background p-6">
      <div className="flex-1 flex flex-col items-center justify-center">
        <Avatar className="h-32 w-32 mb-6">
          <AvatarImage src={otherUser.avatar_url || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
            {otherUser.first_name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <h1 className="text-2xl font-bold mb-2">{otherUser.first_name}</h1>
        <p className="text-lg text-muted-foreground mb-6">{getStatusText()}</p>

        {callStatus === 'connected' && callType === 'video' && (
          <div className="w-full max-w-md aspect-video bg-muted rounded-2xl mb-6 flex items-center justify-center">
            <VideoOff className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="w-full max-w-md space-y-4">
        {callStatus === 'connected' && (
          <div className="flex justify-center gap-6 mb-8">
            <Button
              variant={isMuted ? 'destructive' : 'secondary'}
              size="lg"
              className="h-16 w-16 rounded-full"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>

            {callType === 'video' && (
              <Button
                variant={isVideoOff ? 'destructive' : 'secondary'}
                size="lg"
                className="h-16 w-16 rounded-full"
                onClick={() => setIsVideoOff(!isVideoOff)}
              >
                {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
              </Button>
            )}
          </div>
        )}

        <Button
          variant="destructive"
          size="lg"
          className="w-full h-16 rounded-full"
          onClick={endCall}
        >
          <PhoneOff className="h-6 w-6 mr-2" />
          Encerrar
        </Button>
      </div>
    </div>
  );
}
