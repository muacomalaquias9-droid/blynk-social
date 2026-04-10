import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface AudioRecorderProps {
  onAudioRecorded: (audioUrl: string) => void;
  maxDuration?: number; // in seconds
}

export default function AudioRecorder({ onAudioRecorded, maxDuration = 59 }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        } 
      });

      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadAudio(audioBlob);
        
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
            toast.info(`Limite de ${maxDuration} segundos atingido`);
          }
          return newTime;
        });
      }, 1000);

      toast.success("Gravação iniciada");
    } catch (error) {
      console.error("Erro ao iniciar gravação:", error);
      toast.error("Erro ao acessar o microfone");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadAudio = async (audioBlob: Blob) => {
    setIsUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const fileName = `${user.id}/${timestamp}-${randomStr}.webm`;
      const filePath = `audio-messages/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm;codecs=opus',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error("Erro no upload:", uploadError);
        toast.error(`Erro ao fazer upload: ${uploadError.message}`);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error("Não foi possível obter URL do áudio");
      }

      onAudioRecorded(urlData.publicUrl);
      toast.success("Áudio gravado!");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao salvar áudio");
    } finally {
      setIsUploading(false);
      setRecordingTime(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      {!isRecording && !isUploading && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={startRecording}
          className="h-8 w-8 rounded-full hover:bg-primary/10"
        >
          <Mic className="h-5 w-5 text-muted-foreground" />
        </Button>
      )}
      
      {isRecording && (
        <div className="flex items-center gap-2 bg-red-500/10 rounded-full px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-medium text-red-500 min-w-[32px]">
            {formatTime(recordingTime)}
          </span>
          <span className="text-xs text-muted-foreground">/ {formatTime(maxDuration)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={stopRecording}
            className="h-6 w-6 rounded-full bg-red-500 hover:bg-red-600 text-white ml-1"
          >
            <Square className="h-3 w-3 fill-white" />
          </Button>
        </div>
      )}
      
      {isUploading && (
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Enviando...</span>
        </div>
      )}
    </div>
  );
}