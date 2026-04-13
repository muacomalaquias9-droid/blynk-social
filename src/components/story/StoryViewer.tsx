import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, ChevronRight, ChevronLeft, Music, Eye, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { showNotification } from '@/utils/pushNotifications';
import { StoryViewersSheet } from './StoryViewersSheet';
import { motion, AnimatePresence } from 'framer-motion';
import heartIcon from "@/assets/reactions/heart.png";
import laughingIcon from "@/assets/reactions/laughing.png";
import thumbsUpIcon from "@/assets/reactions/thumbs-up.png";
import sadIcon from "@/assets/reactions/sad.png";
import angryIcon from "@/assets/reactions/angry.png";

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  music_name?: string | null;
  music_artist?: string | null;
  profile: {
    username: string;
    first_name: string;
    avatar_url: string | null;
  };
}

interface StoryViewerProps {
  stories: Story[];
  initialIndex: number;
  onClose: () => void;
  onDelete?: () => void;
}

export const StoryViewer = ({ stories, initialIndex, onClose, onDelete }: StoryViewerProps) => {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [views, setViews] = useState<number>(0);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [musicCover, setMusicCover] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [viewersSheetOpen, setViewersSheetOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const currentStory = stories[currentIndex];
  const isOwnStory = currentStory.user_id === user?.id;

  // Real-time view counter
  useEffect(() => {
    if (!currentStory) return;
    const channel = supabase
      .channel(`story-views-${currentStory.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'story_views', filter: `story_id=eq.${currentStory.id}` }, () => {
        loadViewCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentStory?.id]);

  useEffect(() => {
    if (!user || !currentStory) return;

    setMusicCover(null);
    setAudioEnabled(false);
    setIsPaused(false);

    // Cleanup previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }

    if (!isOwnStory) recordView();
    loadViewCount();
    loadUserReaction();

    if (currentStory.music_name) {
      loadMusicData();
    }

    // Story duration: 45s if music, 15s otherwise
    const duration = currentStory.music_name ? 45000 : 15000;
    const interval = setInterval(() => {
      if (!isPaused) {
        setProgress((prev) => {
          if (prev >= 100) {
            handleNext();
            return 0;
          }
          return prev + (100 / (duration / 100));
        });
      }
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [currentIndex, currentStory?.id, user]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  const loadMusicData = async () => {
    try {
      if (!currentStory.music_name) return;
      const searchQuery = `${currentStory.music_artist || ''} ${currentStory.music_name}`.trim();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/music-search?query=${encodeURIComponent(searchQuery)}`,
        {
          method: 'GET',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) return;
      const data = await response.json();
      
      if (data.tracks && data.tracks.length > 0) {
        const track = data.tracks[0];
        if (!track.preview) return;

        const newAudio = new Audio();
        newAudio.crossOrigin = "anonymous";
        newAudio.preload = "auto";
        newAudio.volume = 0.7;
        newAudio.src = track.preview;
        newAudio.load();
        
        audioRef.current = newAudio;
        if (track.cover) setMusicCover(track.cover);

        try {
          await newAudio.play();
          setAudioEnabled(true);
        } catch {
          console.log('Autoplay blocked');
        }
      }
    } catch (error) {
      console.error('Music load error:', error);
    }
  };

  const playMusic = async () => {
    if (!audioRef.current) {
      await loadMusicData();
      return;
    }
    try {
      if (audioRef.current.paused) { await audioRef.current.play(); setAudioEnabled(true); }
      else { audioRef.current.pause(); setAudioEnabled(false); }
    } catch { setAudioEnabled(false); }
  };

  const recordView = async () => {
    if (!user) return;
    await supabase.from('story_views').insert({ story_id: currentStory.id, viewer_id: user.id }).select().single();
  };

  const loadViewCount = async () => {
    const { count } = await supabase.from('story_views').select('*', { count: 'exact', head: true }).eq('story_id', currentStory.id);
    setViews(count || 0);
  };

  const loadUserReaction = async () => {
    if (!user || isOwnStory) return;
    const { data } = await supabase.from('story_reactions').select('reaction_type').eq('story_id', currentStory.id).eq('user_id', user.id).single();
    setUserReaction(data?.reaction_type || null);
  };

  const handleClose = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null; }
    onClose();
  };

  const handleNext = () => {
    if (currentIndex < stories.length - 1) { setCurrentIndex(currentIndex + 1); setProgress(0); }
    else handleClose();
  };

  const handlePrevious = () => {
    if (currentIndex > 0) { setCurrentIndex(currentIndex - 1); setProgress(0); }
  };

  const handleDelete = async () => {
    if (!isOwnStory) return;
    try {
      const { error } = await supabase.from('stories').delete().eq('id', currentStory.id);
      if (error) throw error;
      toast.success('Story deletada!');
      onDelete?.();
      handleClose();
    } catch { toast.error('Erro ao deletar story'); }
  };

  const handleReaction = async (reactionType: string) => {
    if (!user || isOwnStory) return;
    try {
      if (userReaction) {
        await supabase.from('story_reactions').delete().eq('story_id', currentStory.id).eq('user_id', user.id);
        if (userReaction === reactionType) { setUserReaction(null); return; }
      }
      await supabase.from('story_reactions').insert({ story_id: currentStory.id, user_id: user.id, reaction_type: reactionType });
      setUserReaction(reactionType);

      const { data: profile } = await supabase.from('profiles').select('first_name, avatar_url').eq('id', user.id).single();
      await supabase.from('notifications').insert({
        user_id: currentStory.user_id, type: 'story_reaction', title: 'Nova reação no seu story',
        message: `${profile?.first_name || 'Alguém'} reagiu ao seu story`, related_id: currentStory.id, avatar_url: profile?.avatar_url
      });
      toast.success('Reação enviada!');
    } catch { toast.error('Erro ao reagir'); }
  };

  const handleSendMessage = async () => {
    if (!replyText.trim() || !user || isOwnStory) return;
    try {
      await supabase.from('messages').insert({ sender_id: user.id, receiver_id: currentStory.user_id, content: replyText, message_type: 'text' });
      const { data: profile } = await supabase.from('profiles').select('first_name, avatar_url').eq('id', user.id).single();
      await supabase.from('notifications').insert({
        user_id: currentStory.user_id, type: 'message', title: 'Nova mensagem',
        message: `${profile?.first_name || 'Alguém'} respondeu ao seu story`, related_id: user.id, avatar_url: profile?.avatar_url
      });
      toast.success('Mensagem enviada!');
      setReplyText('');
    } catch { toast.error('Erro ao enviar mensagem'); }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const diffMs = Date.now() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 1) return 'Agora';
    if (diffHrs === 1) return '1h';
    return `${diffHrs}h`;
  };

  return createPortal(
    <div className="fixed inset-0 bg-black z-[9999] flex items-center justify-center select-none">
      <div className="absolute inset-0 bg-[#0a0a0a]" />
      
      {/* Navigation Arrows - Desktop */}
      {currentIndex > 0 && (
        <button onClick={handlePrevious}
          className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-30 h-10 w-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-all">
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>
      )}
      {currentIndex < stories.length - 1 && (
        <button onClick={handleNext}
          className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-30 h-10 w-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-all">
          <ChevronRight className="h-5 w-5 text-white" />
        </button>
      )}
      
      {/* Story Card */}
      <div className="relative w-full h-full md:w-[390px] md:h-[calc(100vh-40px)] md:max-h-[844px] bg-black md:rounded-[44px] overflow-hidden md:shadow-2xl md:border md:border-white/5">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 flex gap-[3px] px-2 pt-[14px] z-20">
          {stories.map((_, idx) => (
            <div key={idx} className="flex-1 h-[2px] bg-white/25 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-white rounded-full"
                style={{ width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%' }}
                transition={{ duration: 0.1, ease: "linear" }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-[22px] left-0 right-0 flex items-center justify-between px-3 z-20">
          <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-3">
            <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600">
              <Avatar className="h-8 w-8 border-[2px] border-black">
                <AvatarImage src={currentStory.profile.avatar_url || undefined} />
                <AvatarFallback className="bg-neutral-700 text-white text-xs font-bold">
                  {currentStory.profile.first_name[0]}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <p className="text-white font-semibold text-[13px] truncate">{currentStory.profile.first_name}</p>
              <p className="text-white/50 text-[12px] flex-shrink-0">{formatTime(currentStory.created_at)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-0.5">
            {currentStory.music_name && (
              <button onClick={playMusic}
                className={`h-8 px-2.5 rounded-full flex items-center gap-1.5 text-white text-[11px] font-medium transition-all ${audioEnabled ? 'bg-white/15' : 'bg-white/10 animate-pulse'}`}>
                {musicCover && <img src={musicCover} alt="" className="h-4 w-4 rounded-sm object-cover" />}
                <Music className="h-3 w-3" />
                <span className="truncate max-w-[60px]">{currentStory.music_name}</span>
              </button>
            )}
            
            {isOwnStory && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setViewersSheetOpen(true)}
                  className="h-8 px-2 text-white hover:bg-white/10 flex items-center gap-1 rounded-full text-[12px]">
                  <Eye className="h-3.5 w-3.5" />
                  <motion.span key={views} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="tabular-nums">{views}</motion.span>
                </Button>
                <Button variant="ghost" size="icon" onClick={handleDelete} className="h-8 w-8 text-white hover:bg-white/10 rounded-full">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8 text-white hover:bg-white/10 rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Touch Navigation */}
        <div className="absolute inset-0 flex z-10">
          <button 
            onClick={handlePrevious}
            onMouseDown={() => setIsPaused(true)} onMouseUp={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)} onTouchEnd={() => setIsPaused(false)}
            className="flex-1" disabled={currentIndex === 0}
          />
          <button 
            onClick={handleNext}
            onMouseDown={() => setIsPaused(true)} onMouseUp={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)} onTouchEnd={() => setIsPaused(false)}
            className="flex-1"
          />
        </div>

        {/* Media */}
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          {currentStory.media_type === 'image' ? (
            <img src={currentStory.media_url} alt="Story" className="w-full h-full object-cover" />
          ) : currentStory.media_type === 'video' ? (
            <video key={currentStory.id} src={currentStory.media_url}
              className="w-full h-full object-cover" autoPlay muted={false} playsInline controls={false} />
          ) : currentStory.media_type === 'text' ? (
            <div className="w-full h-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center p-8">
              <p className="text-white text-2xl font-bold text-center leading-relaxed drop-shadow-lg">
                {decodeURIComponent(currentStory.media_url.replace('data:text/plain,', ''))}
              </p>
            </div>
          ) : null}
        </div>

        {/* Bottom - Reactions & Reply */}
        {!isOwnStory && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-16 pb-4 px-3">
            <div className="flex items-center justify-center gap-1.5 mb-3">
              {[
                { type: 'heart', icon: heartIcon },
                { type: 'thumbs-up', icon: thumbsUpIcon },
                { type: 'laughing', icon: laughingIcon },
                { type: 'sad', icon: sadIcon },
                { type: 'angry', icon: angryIcon },
              ].map(({ type, icon }) => (
                <motion.button key={type} onClick={() => handleReaction(type)} whileTap={{ scale: 1.3 }}
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                    userReaction === type ? 'bg-white/25 ring-2 ring-white/40 scale-110' : 'bg-white/8 hover:bg-white/15'
                  }`}>
                  <img src={icon} alt={type} className="h-6 w-6" />
                </motion.button>
              ))}
              {[
                { type: 'fire', emoji: '🔥' },
                { type: 'love', emoji: '😍' },
                { type: 'clap', emoji: '👏' },
              ].map(({ type, emoji }) => (
                <motion.button key={type} onClick={() => handleReaction(type)} whileTap={{ scale: 1.3 }}
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                    userReaction === type ? 'bg-white/25 ring-2 ring-white/40 scale-110' : 'bg-white/8 hover:bg-white/15'
                  }`}>
                  <span className="text-xl">{emoji}</span>
                </motion.button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-white/10 backdrop-blur-xl rounded-full px-4 py-2.5 border border-white/15">
                <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Enviar mensagem..."
                  className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-[14px]" />
              </div>
              {replyText.trim() && (
                <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} onClick={handleSendMessage}
                  className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                  <Send className="h-4 w-4 text-primary-foreground" />
                </motion.button>
              )}
            </div>
          </div>
        )}

        {/* Own story - view count */}
        {isOwnStory && (
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/60 to-transparent pt-12 pb-6 px-4">
            <button onClick={() => setViewersSheetOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white/10 backdrop-blur-xl rounded-full border border-white/10">
              <Eye className="h-4 w-4 text-white" />
              <span className="text-white text-sm font-medium">
                <motion.span key={views} initial={{ scale: 1.2 }} animate={{ scale: 1 }} className="tabular-nums">{views}</motion.span>
                {' '}visualizações
              </span>
            </button>
          </div>
        )}
      </div>
      
      <StoryViewersSheet open={viewersSheetOpen} onOpenChange={setViewersSheetOpen} storyId={currentStory.id} viewCount={views} />
    </div>,
    document.body
  );
};
