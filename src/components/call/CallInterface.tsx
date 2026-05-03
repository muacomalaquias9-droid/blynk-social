import { useEffect, useRef, useState } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Volume2 } from 'lucide-react';
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
  const connectSoundRef = useRef<HTMLAudioElement | null>(null);
  const offerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const missedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    connectSoundRef.current = new Audio('/sounds/connect.mp3');
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
      const { data: callRow, error: callErr } = await supabase
        .from('calls')
        .select('caller_id, receiver_id, status')
        .eq('id', callId)
        .single();

      if (callErr || !callRow) { onEnd(); return; }

      const isCaller = callRow.caller_id === user?.id;
      if (isCaller) {
        missedTimeoutRef.current = setTimeout(async () => {
          if (peerConnectionRef.current?.connectionState !== 'connected') {
            await supabase.from('calls').update({ status: 'missed', ended_at: new Date().toISOString() }).eq('id', callId);
            cleanup();
            onEnd();
          }
        }, 45_000);
      }

      // Get user media with echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: isVideo ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
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

      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      // Add local tracks - IMPORTANT: only add tracks once
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream - route to separate audio/video elements
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (!remoteStream) return;

        if (event.track.kind === 'audio') {
          // Route remote audio to audio element (NOT back to local user)
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.volume = 1.0;
            remoteAudioRef.current.play().catch(console.error);
          }
        }

        if (event.track.kind === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      // Signaling channel
      const channel = supabase
        .channel(`call-${callId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` },
          ({ new: updatedCall }: any) => {
            if (['ended', 'missed', 'rejected', 'completed'].includes(updatedCall?.status)) {
              cleanup();
              onEnd();
            }
          }
        )
        .on('broadcast', { event: 'signal' }, async ({ payload }) => {
          // Skip our own signals
          if (payload?.from === user?.id) return;

          try {
            if (payload.type === 'ready' && isCaller) {
              // Receiver just subscribed — (re)send the offer immediately
              await sendOffer();
            } else if (payload.type === 'offer' && !isCaller) {
              if (pc.signalingState !== 'stable' && pc.currentRemoteDescription) {
                // Already negotiated — ignore duplicate offers
                return;
              }
              await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
              // Drain any queued ICE
              for (const c of pendingIceRef.current) {
                try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
              }
              pendingIceRef.current = [];
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'answer', answer, from: user?.id },
              });
            } else if (payload.type === 'answer' && isCaller) {
              if (pc.currentRemoteDescription) return; // already set
              await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
              // Stop resending offers once answered
              if (offerIntervalRef.current) {
                clearInterval(offerIntervalRef.current);
                offerIntervalRef.current = null;
              }
              for (const c of pendingIceRef.current) {
                try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
              }
              pendingIceRef.current = [];
            } else if (payload.type === 'ice-candidate' && payload.candidate) {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
              } else {
                pendingIceRef.current.push(payload.candidate);
              }
            } else if (payload.type === 'end-call') {
              cleanup();
              onEnd();
            }
          } catch (err) {
            console.error('Signal error:', err);
          }
        })
        .subscribe(async (status) => {
          if (status !== 'SUBSCRIBED') return;
          if (isCaller) {
            // Send first offer; keep retrying until we get an answer (max ~30s)
            await sendOffer();
            offerIntervalRef.current = setInterval(() => {
              if (pc.currentRemoteDescription) {
                if (offerIntervalRef.current) clearInterval(offerIntervalRef.current);
                offerIntervalRef.current = null;
                return;
              }
              sendOffer().catch(() => {});
            }, 2000);
          } else {
            // Tell caller we're here so they (re)send their offer
            channel.send({
              type: 'broadcast',
              event: 'signal',
              payload: { type: 'ready', from: user?.id },
            });
          }
        });

      channelRef.current = channel;

      async function sendOffer() {
        if (!isCaller) return;
        try {
          if (pc.signalingState === 'closed') return;
          // Only create a new offer if we don't have one yet
          if (!pc.localDescription || pc.signalingState === 'stable') {
            const offer = await pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: isVideo,
            });
            await pc.setLocalDescription(offer);
          }
          channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'offer', offer: pc.localDescription, from: user?.id },
          });
        } catch (e) {
          console.error('sendOffer error', e);
        }
      }

      // ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'ice-candidate', candidate: event.candidate.toJSON(), from: user?.id },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          if (missedTimeoutRef.current) {
            clearTimeout(missedTimeoutRef.current);
            missedTimeoutRef.current = null;
          }
          setIsConnected(true);
          connectSoundRef.current?.play().catch(() => {});
          supabase.from('calls').update({ status: 'ongoing' }).eq('id', callId).then(() => {});
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          // Try to reconnect or end
          if (pc.connectionState === 'failed') {
            endCall();
          }
        }
      };

    } catch (error) {
      console.error('Call init error:', error);
      onEnd();
    }
  };

  const cleanup = () => {
    if (offerIntervalRef.current) {
      clearInterval(offerIntervalRef.current);
      offerIntervalRef.current = null;
    }
    if (missedTimeoutRef.current) {
      clearTimeout(missedTimeoutRef.current);
      missedTimeoutRef.current = null;
    }
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
    // Notify remote user
    channelRef.current?.send({
      type: 'broadcast',
      event: 'signal',
      payload: { type: 'end-call', from: user?.id },
    });
    
    const hangupSound = new Audio('/sounds/hangup.mp3');
    hangupSound.play().catch(() => {});
    
    await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callId);
    cleanup();
    onEnd();
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-gray-900 to-black flex flex-col">
      {/* Hidden audio element for remote voice - CRITICAL: autoPlay + playsInline */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      
      <div className="flex-1 relative flex items-center justify-center">
        {isVideo ? (
          <>
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute bottom-24 right-4 w-32 h-44 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl"
            >
              {/* Local video is muted so we don't hear our own voice */}
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

      {/* Call duration overlay for video calls */}
      {isVideo && isConnected && (
        <div className="absolute top-12 left-0 right-0 flex justify-center">
          <div className="px-4 py-1.5 rounded-full bg-black/50 backdrop-blur-sm">
            <span className="text-white text-sm font-medium">{formatDuration(callDuration)}</span>
          </div>
        </div>
      )}

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
