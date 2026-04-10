import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

interface CallInterfaceProps {
  callId: string;
  isVideo: boolean;
  onEnd: () => void;
}

export default function CallInterface({ callId, isVideo, onEnd }: CallInterfaceProps) {
  const { user } = useAuth();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [remoteUser, setRemoteUser] = useState<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    loadCallData();
    initCall();
    return () => cleanup();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setTimeout>;
    if (isConnected) {
      interval = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  const loadCallData = async () => {
    const { data: call } = await supabase.from('calls').select('*').eq('id', callId).single();
    if (call) {
      const otherId = call.caller_id === user?.id ? call.receiver_id : call.caller_id;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', otherId).single();
      setRemoteUser(profile);
    }
  };

  const initCall = async () => {
    try {
      console.log('Iniciando chamada WebRTC...', { callId, isVideo });

      const { data: callRow, error: callErr } = await supabase
        .from('calls')
        .select('caller_id, receiver_id, status')
        .eq('id', callId)
        .single();

      if (callErr || !callRow) {
        console.error('Erro ao carregar chamada:', callErr);
        onEnd();
        return;
      }

      const isCaller = callRow.caller_id === user?.id;
      console.log('Call role:', isCaller ? 'caller' : 'receiver');

      // Get user media - CRITICAL for real voice
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: isVideo,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current && isVideo) {
        localVideoRef.current.srcObject = stream;
      }

      // ICE servers for NAT traversal
      const configuration: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ],
        iceCandidatePoolSize: 10,
      };

      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      // Add local tracks to connection
      stream.getTracks().forEach(track => {
        console.log('Adding track:', track.kind);
        peerConnection.addTrack(track, stream);
      });

      // Handle remote stream - CRITICAL for hearing other user
      peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);

        if (event.track.kind === 'audio') {
          // For audio calls, use audio element
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0];
            remoteAudioRef.current.play().catch(console.error);
          }
        }

        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Signaling channel via Supabase Realtime
      const channel = supabase
        .channel(`call-${callId}`)
        .on('broadcast', { event: 'signal' }, async ({ payload }) => {
          if (payload?.from && payload.from === user?.id) return;

          console.log('Signal received:', payload.type);

          try {
            if (payload.type === 'offer' && !isCaller) {
              await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.offer));
              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);

              channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'answer', answer, from: user?.id },
              });
            } else if (payload.type === 'answer' && isCaller) {
              await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
            } else if (payload.type === 'ice-candidate' && payload.candidate) {
              await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
            }
          } catch (err) {
            console.error('Signal handling error:', err);
          }
        })
        .subscribe(async (status) => {
          console.log('Channel status:', status);
          if (status === 'SUBSCRIBED') {
            // Only caller creates the offer (avoids glare)
            if (isCaller) {
              const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: isVideo,
              });
              await peerConnection.setLocalDescription(offer);

              channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'offer', offer, from: user?.id },
              });
            }
          }
        });

      channelRef.current = channel;

      // Handle ICE candidates (after channel is ready)
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          console.log('Sending ICE candidate');
          channelRef.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'ice-candidate', candidate: event.candidate.toJSON(), from: user?.id },
          });
        }
      };

      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          setIsConnected(true);
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
      };

      await supabase.from('calls').update({ status: 'ongoing' }).eq('id', callId);

    } catch (error) {
      console.error('Call init error:', error);
      onEnd();
    }
  };

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    peerConnectionRef.current?.close();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
  };

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const endCall = async () => {
    await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callId);
    cleanup();
    onEnd();
  };

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-gray-900 to-black flex flex-col">
      {/* Hidden audio element for voice calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
      
      <div className="flex-1 relative flex items-center justify-center">
        {isVideo ? (
          <>
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute bottom-24 right-4 w-32 h-44 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl"
            >
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            </motion.div>
          </>
        ) : (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center"
          >
            <div className="relative mb-6">
              <Avatar className="h-32 w-32 ring-4 ring-primary/30">
                <AvatarImage src={remoteUser?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-4xl">
                  {remoteUser?.first_name?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              {isConnected && (
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute -bottom-1 -right-1 h-8 w-8 bg-green-500 rounded-full flex items-center justify-center border-4 border-gray-900"
                >
                  <Volume2 className="h-4 w-4 text-white" />
                </motion.div>
              )}
            </div>
            <h2 className="text-white text-2xl font-bold mb-2">{remoteUser?.first_name || 'Chamada'}</h2>
            <p className="text-white/60 text-lg">
              {isConnected ? formatDuration(callDuration) : 'Conectando...'}
            </p>
          </motion.div>
        )}
      </div>

      {/* Controls */}
      <div className="p-8 flex justify-center gap-6 safe-area-bottom">
        <motion.div whileTap={{ scale: 0.9 }}>
          <Button
            variant={isMuted ? 'destructive' : 'secondary'}
            size="icon"
            className="h-16 w-16 rounded-full"
            onClick={toggleMute}
          >
            {isMuted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
          </Button>
        </motion.div>

        {isVideo && (
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button
              variant={isVideoOff ? 'destructive' : 'secondary'}
              size="icon"
              className="h-16 w-16 rounded-full"
              onClick={toggleVideo}
            >
              {isVideoOff ? <VideoOff className="h-7 w-7" /> : <Video className="h-7 w-7" />}
            </Button>
          </motion.div>
        )}

        <motion.div whileTap={{ scale: 0.9 }}>
          <Button
            variant="destructive"
            size="icon"
            className="h-20 w-20 rounded-full shadow-lg shadow-red-500/30"
            onClick={endCall}
          >
            <PhoneOff className="h-8 w-8" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
