import { Image, Video, Mic, X, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import GifPicker from './GifPicker';

interface MediaPickerProps {
  onMediaSelect: (url: string, type: 'image' | 'video' | 'audio', duration?: number) => void;
}

export default function MediaPicker({ onMediaSelect }: MediaPickerProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const uploadFile = async (file: File, folder: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('chat-media')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast({
        title: 'Enviando imagem...',
      });
      const url = await uploadFile(file, 'images');
      onMediaSelect(url, 'image');
      toast({
        title: 'Imagem enviada!',
      });
    } catch (error) {
      console.error('Image upload error:', error);
      toast({
        title: 'Erro ao enviar imagem',
        description: 'Tente novamente',
        variant: 'destructive',
      });
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast({
        title: 'Enviando vídeo...',
      });
      const url = await uploadFile(file, 'videos');
      onMediaSelect(url, 'video');
      toast({
        title: 'Vídeo enviado!',
      });
    } catch (error) {
      console.error('Video upload error:', error);
      toast({
        title: 'Erro ao enviar vídeo',
        description: 'Tente novamente',
        variant: 'destructive',
      });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
        
        try {
          toast({
            title: 'Enviando áudio...',
          });
          const url = await uploadFile(file, 'audios');
          onMediaSelect(url, 'audio', recordingTime);
          toast({
            title: 'Áudio enviado!',
          });
        } catch (error) {
          console.error('Audio upload error:', error);
          toast({
            title: 'Erro ao enviar áudio',
            description: 'Tente novamente',
            variant: 'destructive',
          });
        }
        
        stream.getTracks().forEach(track => track.stop());
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Microphone access error:', error);
      toast({
        title: 'Erro ao acessar microfone',
        description: 'Permita o acesso ao microfone',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleGifSelect = (gifUrl: string) => {
    onMediaSelect(gifUrl, 'image'); // Treat GIF as image
  };

  return (
    <>
      <div className="flex gap-2 items-center">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          id="image-upload"
          onChange={handleImageSelect}
        />
        <label htmlFor="image-upload">
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10" asChild>
            <span>
              <Image className="h-5 w-5" />
            </span>
          </Button>
        </label>

        <input
          type="file"
          accept="video/*"
          className="hidden"
          id="video-upload"
          onChange={handleVideoSelect}
        />
        <label htmlFor="video-upload">
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10" asChild>
            <span>
              <Video className="h-5 w-5" />
            </span>
          </Button>
        </label>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => setShowGifPicker(true)}
        >
          <Smile className="h-5 w-5" />
        </Button>

        {!isRecording ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={startRecording}
          >
            <Mic className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="h-10 w-10 animate-pulse"
            onClick={stopRecording}
          >
            <X className="h-5 w-5" />
            <span className="ml-1 text-xs">{recordingTime}s</span>
          </Button>
        )}
      </div>

      <GifPicker
        open={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onGifSelect={handleGifSelect}
      />
    </>
  );
}
