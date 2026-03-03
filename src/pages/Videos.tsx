import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Play, Music, Search, Heart, MessageCircle, Share2, Volume2, VolumeX, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Reel {
  id: string;
  video_url: string;
  caption: string | null;
  user_id: string;
  created_at: string;
  profile?: {
    username: string;
    first_name: string;
    avatar_url: string | null;
    verified?: boolean;
  };
}

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  preview_url?: string;
  cover_url?: string;
}

const TRENDING_MUSIC: MusicTrack[] = [
  { id: '1', title: 'Cold Keys Warm Steel', artist: 'Blynk Music', preview_url: '/music/trending/cold-keys-warm-steel.mp3' },
  { id: '2', title: 'Neon Dreams', artist: 'Afrobeat Vibes' },
  { id: '3', title: 'Luanda Nights', artist: 'Kuduro Mix' },
  { id: '4', title: 'Estrelas do Sul', artist: 'Semba Soul' },
  { id: '5', title: 'Ritmo Urbano', artist: 'Hip Hop AO' },
  { id: '6', title: 'Sunset Kizomba', artist: 'Kizomba Flow' },
];

const Videos = () => {
  const [activeTab, setActiveTab] = useState('reels');
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [musicSearch, setMusicSearch] = useState('');
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [currentReelIndex, setCurrentReelIndex] = useState(0);
  const [mutedReels, setMutedReels] = useState(true);
  const [pausedReel, setPausedReel] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reelContainerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement>>({});

  useEffect(() => {
    loadReels();
  }, []);

  const loadReels = async () => {
    try {
      const { data, error } = await supabase
        .from('verification_videos')
        .select(`
          id, video_url, caption, user_id, created_at,
          profile:profiles!verification_videos_user_id_fkey(username, first_name, avatar_url, verified)
        `)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) setReels(data as any);
    } catch (err) {
      console.error('Error loading reels:', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePlayTrack = (trackId: string, previewUrl?: string) => {
    if (playingTrack === trackId) {
      audioRef.current?.pause();
      setPlayingTrack(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (previewUrl) {
      const audio = new Audio(previewUrl);
      audio.play().catch(() => {});
      audio.onended = () => setPlayingTrack(null);
      audioRef.current = audio;
    }
    setPlayingTrack(trackId);
  };

  const toggleReelPause = (reelId: string) => {
    const video = videoRefs.current[reelId];
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setPausedReel(null);
    } else {
      video.pause();
      setPausedReel(reelId);
    }
  };

  const filteredMusic = TRENDING_MUSIC.filter(t =>
    t.title.toLowerCase().includes(musicSearch.toLowerCase()) ||
    t.artist.toLowerCase().includes(musicSearch.toLowerCase())
  );

  // Intersection observer for reels autoplay
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            video.play().catch(() => {});
            setPausedReel(null);
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.7 }
    );

    Object.values(videoRefs.current).forEach((video) => {
      if (video) observer.observe(video);
    });

    return () => observer.disconnect();
  }, [reels]);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  return (
    <MainLayout title="Vídeos">
      <div className="max-w-2xl mx-auto pb-20">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-2xl saturate-[1.8] border-b border-border/30">
            <TabsList className="grid w-full grid-cols-2 bg-transparent rounded-none h-12 p-0">
              <TabsTrigger
                value="reels"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent h-12 text-sm font-bold gap-2"
              >
                <Play className="h-4 w-4" /> Reels
              </TabsTrigger>
              <TabsTrigger
                value="music"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent h-12 text-sm font-bold gap-2"
              >
                <Music className="h-4 w-4" /> Música
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Reels Tab */}
          <TabsContent value="reels" className="mt-0">
            {loading ? (
              <div className="flex items-center justify-center h-[60vh]">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : reels.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
                <Play className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-xl font-bold mb-2">Nenhum reel</h3>
                <p className="text-muted-foreground text-sm">Seja o primeiro a publicar um vídeo!</p>
              </div>
            ) : (
              <div ref={reelContainerRef} className="snap-y snap-mandatory overflow-y-auto" style={{ height: 'calc(100vh - 180px)' }}>
                {reels.map((reel) => (
                  <div key={reel.id} className="snap-start relative w-full bg-black" style={{ height: 'calc(100vh - 180px)' }}>
                    <video
                      ref={(el) => { if (el) videoRefs.current[reel.id] = el; }}
                      src={reel.video_url}
                      className="w-full h-full object-contain"
                      loop
                      playsInline
                      muted={mutedReels}
                      preload="metadata"
                      onClick={() => toggleReelPause(reel.id)}
                    />
                    
                    {/* Paused overlay */}
                    <AnimatePresence>
                      {pausedReel === reel.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                          <div className="bg-black/40 rounded-full p-5">
                            <Pause className="h-12 w-12 text-white fill-white" />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Right sidebar actions */}
                    <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
                      <button className="flex flex-col items-center gap-1">
                        <Heart className="h-7 w-7 text-white drop-shadow-lg" />
                        <span className="text-white text-xs font-medium">0</span>
                      </button>
                      <button className="flex flex-col items-center gap-1">
                        <MessageCircle className="h-7 w-7 text-white drop-shadow-lg" />
                        <span className="text-white text-xs font-medium">0</span>
                      </button>
                      <button className="flex flex-col items-center gap-1">
                        <Share2 className="h-7 w-7 text-white drop-shadow-lg" />
                      </button>
                      <button onClick={() => setMutedReels(!mutedReels)}>
                        {mutedReels ? (
                          <VolumeX className="h-6 w-6 text-white drop-shadow-lg" />
                        ) : (
                          <Volume2 className="h-6 w-6 text-white drop-shadow-lg" />
                        )}
                      </button>
                    </div>

                    {/* Bottom info */}
                    <div className="absolute bottom-4 left-4 right-16">
                      <div className="flex items-center gap-3 mb-2">
                        <Avatar className="h-9 w-9 border-2 border-white">
                          <AvatarImage src={reel.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">{reel.profile?.first_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-white font-bold text-sm drop-shadow-lg">
                          {reel.profile?.username || 'Utilizador'}
                        </span>
                      </div>
                      {reel.caption && (
                        <p className="text-white text-sm drop-shadow-lg line-clamp-2">{reel.caption}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Music Tab */}
          <TabsContent value="music" className="mt-0">
            <div className="p-4 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar música..."
                  value={musicSearch}
                  onChange={(e) => setMusicSearch(e.target.value)}
                  className="pl-10 bg-muted/50 border-0 rounded-xl h-11"
                />
              </div>

              {/* Trending label */}
              <div className="flex items-center gap-2">
                <Music className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-lg">Em alta</h3>
              </div>

              {/* Music list */}
              <div className="space-y-2">
                {filteredMusic.map((track, index) => (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-2xl transition-all border",
                      playingTrack === track.id
                        ? "bg-primary/10 border-primary/30"
                        : "bg-card border-transparent hover:bg-muted/50"
                    )}
                  >
                    <button
                      onClick={() => togglePlayTrack(track.id, track.preview_url)}
                      className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                        playingTrack === track.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {playingTrack === track.id ? (
                        <Pause className="h-5 w-5" />
                      ) : (
                        <Play className="h-5 w-5 ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{track.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">0:45</span>
                  </motion.div>
                ))}
              </div>

              {filteredMusic.length === 0 && (
                <div className="text-center py-12">
                  <Music className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">Nenhuma música encontrada</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Videos;
