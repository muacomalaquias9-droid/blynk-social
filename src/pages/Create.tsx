import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Image as ImageIcon, 
  Video, 
  Users, 
  MapPin, 
  Music, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  Sliders,
  Play,
  Pause,
  Volume2,
  Hash,
  AtSign,
  Globe,
  Timer,
  BarChart3,
  Smile
} from "lucide-react";
import MentionTextarea from "@/components/MentionTextarea";
import { useNavigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useHashtagsAndMentions } from "@/hooks/useHashtagsAndMentions";
import { useActiveProfile } from "@/contexts/ActiveProfileContext";
import { useAuth } from "@/contexts/AuthContext";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import MusicSearch from "@/components/MusicSearch";
import { Card } from "@/components/ui/card";

interface VideoFilter {
  name: string;
  style: string;
}

const videoFilters: VideoFilter[] = [
  { name: 'Normal', style: '' },
  { name: 'Clarendon', style: 'contrast(1.2) saturate(1.35)' },
  { name: 'Gingham', style: 'brightness(1.05) hue-rotate(-10deg)' },
  { name: 'Moon', style: 'grayscale(1) contrast(1.1) brightness(1.1)' },
  { name: 'Lark', style: 'contrast(0.9) brightness(1.1) saturate(0.9)' },
  { name: 'Reyes', style: 'sepia(0.22) brightness(1.1) contrast(0.85) saturate(0.75)' },
  { name: 'Juno', style: 'sepia(0.35) contrast(1.15) brightness(1.15) saturate(1.8)' },
  { name: 'Aden', style: 'hue-rotate(-20deg) contrast(0.9) saturate(0.85) brightness(1.2)' },
];

const visibilityOptions = [
  { value: 'public', label: 'Público', icon: Globe, desc: 'Todos podem ver' },
  { value: 'friends', label: 'Amigos', icon: Users, desc: 'Apenas amigos' },
  { value: 'private', label: 'Só eu', icon: Timer, desc: 'Apenas tu' },
];

export default function Create() {
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'compose' | 'edit' | 'music'>('compose');
  const [selectedFilter, setSelectedFilter] = useState<VideoFilter>(videoFilters[0]);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [selectedMusic, setSelectedMusic] = useState<{ name: string; artist: string; url: string } | null>(null);
  const [musicVolume, setMusicVolume] = useState(50);
  const [videoVolume, setVideoVolume] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [musicDialogOpen, setMusicDialogOpen] = useState(false);
  const [visibility, setVisibility] = useState('public');
  const [showVisibility, setShowVisibility] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const navigate = useNavigate();
  const { processPostHashtagsAndMentions } = useHashtagsAndMentions();
  const { activeProfile } = useActiveProfile();
  const { user } = useAuth();

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    const supported = picked.filter((f) => {
      if (f.type.startsWith("image/")) return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(f.type);
      if (f.type.startsWith("video/")) return ["video/mp4", "video/webm"].includes(f.type);
      return false;
    });
    if (supported.length !== picked.length) toast.error("Alguns ficheiros não são suportados.");
    if (mediaFiles.length + supported.length > 10) { toast.error("Máximo 10 mídias"); return; }
    setMediaFiles(prev => [...prev, ...supported]);
    setMediaPreviews(prev => [...prev, ...supported.map(f => URL.createObjectURL(f))]);
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const hasVideo = mediaFiles.some(f => f.type.startsWith('video/'));

  const getFilterStyle = () => {
    let style = selectedFilter.style;
    if (brightness !== 100 || contrast !== 100 || saturation !== 100) {
      style += ` brightness(${brightness / 100}) contrast(${contrast / 100}) saturate(${saturation / 100})`;
    }
    return style.trim();
  };

  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) { videoRef.current.pause(); audioRef.current?.pause(); }
      else { videoRef.current.play(); audioRef.current?.play(); }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMusicSelect = (music: { name: string; artist: string; preview?: string }) => {
    if (music.preview) setSelectedMusic({ name: music.name, artist: music.artist, url: music.preview });
    setMusicDialogOpen(false);
  };

  const handleCreatePost = async () => {
    if (!content.trim() && mediaFiles.length === 0) { toast.error("Digite algo ou adicione mídia"); return; }
    setLoading(true);
    try {
      if (!user) throw new Error("Não autenticado");
      const postUserId = activeProfile?.type === 'page' ? activeProfile.id : user.id;
      const mediaUrls: string[] = [];
      for (const file of mediaFiles) {
        const fileExt = file.name.split(".").pop()?.toLowerCase();
        const fileName = `${user.id}/${Date.now()}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("post-images").upload(fileName, file, { cacheControl: "3600", upsert: false, contentType: file.type });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("post-images").getPublicUrl(fileName);
        mediaUrls.push(publicUrl);
      }
      const { data: newPost, error } = await supabase.from("posts").insert({
        user_id: postUserId, content, media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        music_name: selectedMusic?.name || null, music_artist: selectedMusic?.artist || null,
        music_url: selectedMusic?.url || null, visibility,
      }).select().single();
      if (error) throw error;
      if (newPost) await processPostHashtagsAndMentions(newPost.id, content, postUserId);
      toast.success("Publicação criada!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar post");
    } finally { setLoading(false); }
  };

  const avatarUrl = activeProfile ? activeProfile.avatar_url : user?.user_metadata?.avatar_url;
  const displayName = activeProfile 
    ? (activeProfile.type === 'page' ? activeProfile.name : user?.user_metadata?.first_name || user?.email?.split('@')[0])
    : (user?.user_metadata?.first_name || user?.email?.split('@')[0]);

  const currentVisibility = visibilityOptions.find(v => v.value === visibility) || visibilityOptions[0];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Liquid Glass Header */}
        <div className="sticky top-0 z-30"
          style={{
            backdropFilter: 'blur(50px) saturate(200%)',
            WebkitBackdropFilter: 'blur(50px) saturate(200%)',
            backgroundColor: 'hsl(var(--background) / 0.72)',
            borderBottom: '1px solid hsl(var(--border) / 0.5)',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 safe-area-top">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                if (step === 'edit') setStep('compose');
                else if (step === 'music') setStep('edit');
                else navigate(-1);
              }}
              className="font-medium text-muted-foreground"
            >
              Cancelar
            </Button>
            <h1 className="text-base font-bold">
              {step === 'compose' ? 'Nova thread' : step === 'edit' ? 'Editar' : 'Música'}
            </h1>
            {step === 'compose' && hasVideo ? (
              <Button onClick={() => setStep('edit')} size="sm" variant="ghost" className="font-semibold text-primary">
                Seguinte
              </Button>
            ) : step === 'edit' ? (
              <Button onClick={() => setStep('music')} size="sm" variant="ghost" className="font-semibold text-primary">
                Seguinte
              </Button>
            ) : (
              <Button
                onClick={handleCreatePost}
                disabled={loading || (!content.trim() && mediaFiles.length === 0)}
                size="sm"
                className="rounded-full px-5 font-semibold"
              >
                {loading ? "..." : "Publicar"}
              </Button>
            )}
          </div>
        </div>

        {step === 'compose' && (
          <div className="max-w-2xl mx-auto">
            {/* Threads-style compose */}
            <div className="flex gap-3 px-4 pt-4">
              {/* Left: Avatar + line */}
              <div className="flex flex-col items-center">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                    {displayName?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="w-0.5 flex-1 bg-border mt-2 min-h-[40px]" />
              </div>

              {/* Right: Content */}
              <div className="flex-1 pb-4">
                <p className="font-semibold text-sm mb-1">{displayName || 'User'}</p>
                <MentionTextarea
                  placeholder="Comece uma thread..."
                  value={content}
                  onChange={setContent}
                  rows={4}
                  className="min-h-[100px] bg-transparent border-0 text-foreground text-[16px] resize-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground p-0"
                  style={{ fontSize: '16px' }}
                />

                {/* Media Previews */}
                {mediaPreviews.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                    {mediaPreviews.map((preview, index) => (
                      <div key={index} className="relative flex-shrink-0 w-40 h-40 rounded-2xl overflow-hidden">
                        {mediaFiles[index]?.type.startsWith('video/') ? (
                          <video src={preview} className="w-full h-full object-cover" />
                        ) : (
                          <img src={preview} alt="" className="w-full h-full object-cover" />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-1 right-1 h-6 w-6 p-0 bg-black/60 hover:bg-black/80 rounded-full"
                          onClick={() => removeMedia(index)}
                        >
                          <X className="h-3 w-3 text-white" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Actions Row */}
                <div className="flex items-center gap-1 mt-3">
                  <input type="file" accept="image/*,video/*" onChange={handleMediaChange} className="hidden" id="media-upload" multiple />
                  <label htmlFor="media-upload">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted/50 cursor-pointer transition-colors">
                      <ImageIcon className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>
                  </label>
                  <button className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors" onClick={() => setMusicDialogOpen(true)}>
                    <Music className="h-4.5 w-4.5 text-muted-foreground" />
                  </button>
                  <button className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors">
                    <Hash className="h-4.5 w-4.5 text-muted-foreground" />
                  </button>
                  <button className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors">
                    <AtSign className="h-4.5 w-4.5 text-muted-foreground" />
                  </button>
                  <button className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors">
                    <BarChart3 className="h-4.5 w-4.5 text-muted-foreground" />
                  </button>
                  <button className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors">
                    <MapPin className="h-4.5 w-4.5 text-muted-foreground" />
                  </button>
                </div>

                {/* Selected Music */}
                {selectedMusic && (
                  <div className="mt-3 flex items-center gap-2 bg-muted/50 rounded-xl p-2.5">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Music className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{selectedMusic.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{selectedMusic.artist}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedMusic(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Reply avatar hint (like Threads) */}
            <div className="flex items-center gap-3 px-4 pb-4">
              <Avatar className="h-5 w-5 opacity-40">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="text-[8px]">{displayName?.[0]}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">Adicionar à thread...</span>
            </div>

            {/* Visibility + Options */}
            <div className="border-t border-border px-4 py-3">
              <button 
                onClick={() => setShowVisibility(!showVisibility)}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <currentVisibility.icon className="h-4 w-4" />
                <span>{currentVisibility.label}</span>
                <span className="text-xs">· {currentVisibility.desc}</span>
              </button>
              
              {showVisibility && (
                <div className="mt-3 space-y-1">
                  {visibilityOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setVisibility(opt.value); setShowVisibility(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        visibility === opt.value ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                      }`}
                    >
                      <opt.icon className="h-5 w-5" />
                      <div className="text-left">
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Video Editor Step */}
        {step === 'edit' && mediaPreviews.length > 0 && (
          <div className="max-w-2xl mx-auto">
            <div className="relative bg-black aspect-[9/16] max-h-[60vh] mx-4 mt-4 rounded-2xl overflow-hidden">
              {mediaFiles[0]?.type.startsWith('video/') ? (
                <video ref={videoRef} src={mediaPreviews[0]} className="w-full h-full object-contain"
                  style={{ filter: getFilterStyle() }} loop playsInline muted={videoVolume === 0}
                  onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
              ) : (
                <img src={mediaPreviews[0]} alt="" className="w-full h-full object-contain" style={{ filter: getFilterStyle() }} />
              )}
              <button className="absolute inset-0 flex items-center justify-center" onClick={togglePlayback}>
                {!isPlaying && (
                  <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="h-7 w-7 text-foreground fill-foreground ml-0.5" />
                  </div>
                )}
              </button>
            </div>

            <div className="px-4 mt-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4" /> Filtros
              </h3>
              <ScrollArea className="w-full">
                <div className="flex gap-2 pb-2">
                  {videoFilters.map((filter) => (
                    <button key={filter.name} onClick={() => setSelectedFilter(filter)}
                      className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                        selectedFilter.name === filter.name ? 'bg-primary/20 ring-2 ring-primary' : 'bg-muted/50 hover:bg-muted'
                      }`}>
                      <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-pink-400 to-purple-600" style={{ filter: filter.style || 'none' }} />
                      <span className="text-[10px] font-medium">{filter.name}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="px-4 mt-4 space-y-3 pb-8">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <Sliders className="h-4 w-4" /> Ajustes
              </h3>
              {[
                { label: 'Brilho', value: brightness, set: setBrightness, min: 50, max: 150 },
                { label: 'Contraste', value: contrast, set: setContrast, min: 50, max: 150 },
                { label: 'Saturação', value: saturation, set: setSaturation, min: 0, max: 200 },
              ].map(s => (
                <div key={s.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs">{s.label}</span>
                    <span className="text-xs text-muted-foreground">{s.value}%</span>
                  </div>
                  <Slider value={[s.value]} onValueChange={([v]) => s.set(v)} min={s.min} max={s.max} step={1} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Music Step */}
        {step === 'music' && (
          <div className="max-w-2xl mx-auto p-4">
            <div className="relative bg-black aspect-[9/16] max-h-[50vh] rounded-2xl overflow-hidden mb-6">
              {mediaFiles[0]?.type.startsWith('video/') ? (
                <video ref={videoRef} src={mediaPreviews[0]} className="w-full h-full object-contain"
                  style={{ filter: getFilterStyle() }} loop playsInline />
              ) : (
                <img src={mediaPreviews[0]} alt="" className="w-full h-full object-contain" style={{ filter: getFilterStyle() }} />
              )}
              {selectedMusic && <audio ref={audioRef} src={selectedMusic.url} loop />}
            </div>

            <Card className="p-4 rounded-2xl border-border/50" style={{
              backdropFilter: 'blur(20px) saturate(180%)',
              backgroundColor: 'hsl(var(--card) / 0.8)',
            }}>
              <button onClick={() => setMusicDialogOpen(true)}
                className="w-full flex items-center gap-3 p-3 bg-muted/50 rounded-xl hover:bg-muted transition-colors">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                  <Music className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  {selectedMusic ? (
                    <><p className="font-semibold text-sm">{selectedMusic.name}</p><p className="text-xs text-muted-foreground">{selectedMusic.artist}</p></>
                  ) : (
                    <><p className="font-semibold text-sm">Adicionar música</p><p className="text-xs text-muted-foreground">Escolha uma música</p></>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>

              {selectedMusic && (
                <div className="mt-4 space-y-3">
                  {[
                    { label: 'Música', icon: Music, value: musicVolume, set: (v: number) => { setMusicVolume(v); if (audioRef.current) audioRef.current.volume = v / 100; } },
                    { label: 'Vídeo', icon: Volume2, value: videoVolume, set: (v: number) => { setVideoVolume(v); if (videoRef.current) videoRef.current.volume = v / 100; } },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs flex items-center gap-1"><s.icon className="h-3 w-3" /> {s.label}</span>
                        <span className="text-xs text-muted-foreground">{s.value}%</span>
                      </div>
                      <Slider value={[s.value]} onValueChange={([v]) => s.set(v)} min={0} max={100} step={1} />
                    </div>
                  ))}
                  <Button variant="outline" className="w-full rounded-xl" onClick={() => setSelectedMusic(null)}>
                    <X className="h-4 w-4 mr-2" /> Remover música
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}

        {musicDialogOpen && <MusicSearch onSelect={handleMusicSelect} onClose={() => setMusicDialogOpen(false)} />}
      </div>
    </ProtectedRoute>
  );
}
