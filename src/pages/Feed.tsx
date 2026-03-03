import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { MessageNotification } from "@/components/MessageNotification";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Share2, Bookmark, Play, Volume2, VolumeX, MoreHorizontal, Heart, Send, Menu } from "lucide-react";
import { MusicPlayer, pauseAllAudio } from "@/components/MusicPlayer";
import { useNavigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import StoriesBar from "@/components/StoriesBar";
import CreateStory from "@/components/CreateStory";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import VerificationBadge, { hasSpecialBadgeEmoji } from "@/components/VerificationBadge";
import { FeedSkeleton } from "@/components/loading/FeedSkeleton";
import { parseTextWithLinksAndMentions } from "@/utils/textUtils";
import { SponsoredAd } from "@/components/SponsoredAd";
import { ImageGalleryViewer } from "@/components/ImageGalleryViewer";
import { UserSuggestions } from "@/components/UserSuggestions";
import { motion, AnimatePresence } from "framer-motion";
import PostOptionsSheet from "@/components/PostOptionsSheet";
import { playLikeSound, playClickSound } from "@/utils/soundEffects";
import { useRateLimiting } from "@/hooks/useRateLimiting";
import { Logo2026 } from "@/components/Logo2026";
import BottomNav from "@/components/BottomNav";
import { useContentProtection } from "@/hooks/useContentProtection";


interface Post {
  id: string;
  content: string;
  user_id: string;
  media_urls?: string[];
  music_name?: string | null;
  music_artist?: string | null;
  music_url?: string | null;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    full_name: string;
    first_name: string;
    avatar_url: string;
    verified?: boolean;
    badge_type?: string | null;
  };
  post_likes: { user_id: string }[];
  post_reactions: { user_id: string; reaction_type: string }[];
  comments: { id: string }[];
}

export default function Feed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { checkLikeLimit } = useRateLimiting();
  useContentProtection();
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [createStoryOpen, setCreateStoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sponsoredAds, setSponsoredAds] = useState<any[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [savedPosts, setSavedPosts] = useState<string[]>([]);
  const [optionsSheet, setOptionsSheet] = useState<{ open: boolean; post: Post | null }>({ open: false, post: null });
  const [mutedVideos, setMutedVideos] = useState<{ [key: string]: boolean }>({});
  const [likeAnimations, setLikeAnimations] = useState<{ [key: string]: boolean }>({});
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedVideosRef = useRef<Set<HTMLVideoElement>>(new Set());

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const [profileResult, savedResult] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('saved_posts').select('post_id').eq('user_id', user.id)
        ]);
        if (profileResult.data) setMyProfile(profileResult.data);
        if (savedResult.data) setSavedPosts(savedResult.data.map(s => s.post_id));
      }
      await Promise.all([loadPosts(), loadSponsoredAds()]);
      setLoading(false);
    };
    loadData();

    const channel = supabase
      .channel("posts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => loadPosts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Intersection Observer for video autoplay/pause
  useEffect(() => {
    observerRef.current?.disconnect();
    observedVideosRef.current = new Set();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            pauseAllAudio();
            observedVideosRef.current.forEach((v) => {
              if (v !== video && !v.paused) v.pause();
            });
            video.muted = false;
            video.play().catch(() => {
              video.muted = true;
              video.play().catch(console.log);
            });
          } else {
            if (!video.paused) video.pause();
          }
        });
      },
      { threshold: 0.55, rootMargin: '0px 0px -20% 0px' }
    );
    observerRef.current = observer;
    Object.values(videoRefs.current).forEach((video) => {
      if (!video) return;
      observedVideosRef.current.add(video);
      observer.observe(video);
    });
    return () => { observer.disconnect(); };
  }, [posts]);

  const loadPosts = async () => {
    const { data } = await supabase
      .from("posts")
      .select(`*, profiles(id, username, full_name, first_name, avatar_url, verified, badge_type), post_likes(user_id), post_reactions(user_id, reaction_type), comments(id)`)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setPosts(data);
  };

  const loadSponsoredAds = async () => {
    const { data } = await supabase.from("sponsored_ads").select("*").eq("is_active", true);
    if (data) setSponsoredAds(data);
  };

  const handleLike = async (postId: string) => {
    if (!currentUserId) return;
    const { data: existingReaction } = await supabase
      .from("post_reactions")
      .select("*")
      .eq("post_id", postId)
      .eq("user_id", currentUserId)
      .maybeSingle();

    if (existingReaction) {
      await supabase.from("post_reactions").delete().eq("id", existingReaction.id);
      playClickSound();
    } else {
      const allowed = await checkLikeLimit();
      if (!allowed) return;
      await supabase.from("post_reactions").insert({ post_id: postId, user_id: currentUserId, reaction_type: "heart" });
      playLikeSound();
      // Trigger heart animation
      setLikeAnimations(prev => ({ ...prev, [postId]: true }));
      setTimeout(() => setLikeAnimations(prev => ({ ...prev, [postId]: false })), 1000);
    }
    loadPosts();
  };

  const handleDoubleTapLike = async (postId: string) => {
    const userReaction = posts.find(p => p.id === postId)?.post_reactions?.find(r => r.user_id === currentUserId);
    if (!userReaction) {
      await handleLike(postId);
    } else {
      // Show animation only
      setLikeAnimations(prev => ({ ...prev, [postId]: true }));
      setTimeout(() => setLikeAnimations(prev => ({ ...prev, [postId]: false })), 1000);
    }
  };

  const handleSave = async (postId: string) => {
    if (!currentUserId) return;
    if (savedPosts.includes(postId)) {
      await supabase.from('saved_posts').delete().eq('post_id', postId).eq('user_id', currentUserId);
      setSavedPosts(savedPosts.filter(id => id !== postId));
      toast.success('Removido dos guardados');
    } else {
      await supabase.from('saved_posts').insert({ post_id: postId, user_id: currentUserId });
      setSavedPosts([...savedPosts, postId]);
      toast.success('Guardado!');
    }
  };

  const getUserReaction = (post: Post) => {
    return post.post_reactions?.find(r => r.user_id === currentUserId)?.reaction_type;
  };

  const isVideo = (url: string) => {
    if (!url) return false;
    const l = url.toLowerCase();
    return l.includes(".mp4") || l.includes(".webm") || l.includes(".mov") || l.includes(".avi") || l.includes(".mkv");
  };

  const toggleVideoMute = (postId: string) => {
    const video = videoRefs.current[postId];
    if (video) {
      video.muted = !video.muted;
      setMutedVideos({ ...mutedVideos, [postId]: video.muted });
    }
  };

  const registerVideoRef = (key: string) => (el: HTMLVideoElement | null) => {
    const prev = videoRefs.current[key];
    if (prev && observerRef.current) {
      observerRef.current.unobserve(prev);
      observedVideosRef.current.delete(prev);
    }
    if (el) {
      videoRefs.current[key] = el;
      observedVideosRef.current.add(el);
      observerRef.current?.observe(el);
    } else {
      delete videoRefs.current[key];
    }
  };

  const VideoPlayer = ({ url, postId }: { url: string; postId: string }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasError, setHasError] = useState(false);
    const isMuted = mutedVideos[postId] ?? false;

    if (hasError) {
      return (
        <div className="relative bg-muted overflow-hidden aspect-video flex items-center justify-center">
          <div className="text-center p-4">
            <Play className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Erro ao carregar vídeo</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative bg-black overflow-hidden" onClick={() => {
        const video = videoRefs.current[postId];
        if (video) {
          if (video.paused) { pauseAllAudio(); video.play(); }
          else { video.pause(); }
        }
      }}>
        <video
          ref={registerVideoRef(postId)}
          className="w-full max-h-[600px] object-contain cursor-pointer"
          playsInline muted={isMuted} loop preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => setHasError(true)}
        >
          <source src={url} type="video/mp4" />
        </video>
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
            <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play className="h-8 w-8 text-foreground fill-foreground ml-1" />
            </div>
          </div>
        )}
        <button
          className="absolute bottom-4 right-4 h-9 w-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10"
          onClick={(e) => { e.stopPropagation(); toggleVideoMute(postId); }}
        >
          {isMuted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}
        </button>
      </div>
    );
  };

  const renderMediaGrid = (mediaUrls: string[], postId: string) => {
    if (!mediaUrls || mediaUrls.length === 0) return null;

    if (mediaUrls.length === 1) {
      const url = mediaUrls[0];
      return (
        <div className="relative" onDoubleClick={() => handleDoubleTapLike(postId)}>
          {isVideo(url) ? (
            <VideoPlayer url={url} postId={postId} />
          ) : (
            <img src={url} alt="Post" className="w-full object-cover cursor-pointer" onClick={() => setGalleryImages(mediaUrls)} />
          )}
          {/* Double tap heart animation */}
          <AnimatePresence>
            {likeAnimations[postId] && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <Heart className="h-24 w-24 text-white fill-white drop-shadow-2xl" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <div className={`grid gap-0.5 ${mediaUrls.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`} onDoubleClick={() => handleDoubleTapLike(postId)}>
        {mediaUrls.slice(0, 4).map((url, idx) => (
          <div key={idx} className={`relative cursor-pointer ${mediaUrls.length === 3 && idx === 0 ? 'row-span-2' : ''}`}
            onClick={() => { if (!isVideo(url)) { setGalleryImages(mediaUrls.filter(u => !isVideo(u))); setGalleryIndex(idx); } }}>
            {isVideo(url) ? (
              <div className="relative aspect-square bg-black">
                <video src={url} className="w-full h-full object-cover" playsInline muted preload="metadata"
                  onClick={(e) => { e.stopPropagation(); pauseAllAudio(); const vid = e.currentTarget; if (vid.paused) vid.play(); else vid.pause(); }} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Play className="h-12 w-12 text-white/80 fill-white/80" />
                </div>
              </div>
            ) : (
              <img src={url} alt="" className="w-full aspect-square object-cover" />
            )}
            {idx === 3 && mediaUrls.length > 4 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white text-2xl font-bold">+{mediaUrls.length - 4}</span>
              </div>
            )}
          </div>
        ))}
        <AnimatePresence>
          {likeAnimations[posts.find(p => p.media_urls === mediaUrls)?.id || ''] && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none col-span-2"
            >
              <Heart className="h-24 w-24 text-white fill-white drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <MessageNotification />
        <div className="min-h-screen bg-background">
          <FeedSkeleton />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <MessageNotification />
      <div className="min-h-screen bg-background">
        {/* iOS Native Header - Liquid Glass */}
        <header className="fixed top-0 left-0 right-0 z-50 safe-area-top"
          style={{
            background: 'hsl(var(--card) / 0.65)',
            backdropFilter: 'blur(50px) saturate(200%) brightness(1.05)',
            WebkitBackdropFilter: 'blur(50px) saturate(200%) brightness(1.05)',
            borderBottom: '0.5px solid hsl(var(--border) / 0.2)',
            boxShadow: '0 1px 3px hsl(var(--foreground) / 0.03)',
          }}
        >
          <div className="flex items-center justify-between h-12 px-4 max-w-lg mx-auto">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full active:scale-90 transition-transform" onClick={() => navigate("/sidebar")}>
                <Menu className="h-[22px] w-[22px]" strokeWidth={1.5} />
              </Button>
              <Logo2026 size="md" />
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full active:scale-90 transition-transform" onClick={() => navigate("/notifications")}>
                <Heart className="h-[22px] w-[22px]" strokeWidth={1.5} />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full active:scale-90 transition-transform" onClick={() => navigate("/messages")}>
                <Send className="h-[22px] w-[22px]" strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        </header>

        <div className="pt-12 pb-[72px] h-screen overflow-y-auto native-scroll">
          <div className="max-w-lg mx-auto">
            {/* Stories Bar */}
            <StoriesBar onCreateStory={() => setCreateStoryOpen(true)} />

            {/* User Suggestions */}
            <div className="px-3 my-2">
              <UserSuggestions />
            </div>

            {/* Posts Feed */}
            <div className="space-y-2 px-0">
              {posts.map((post, index) => {
                const userReaction = getUserReaction(post);
                const totalReactions = post.post_reactions?.length || 0;
                const isSaved = savedPosts.includes(post.id);
                const showAd = index > 0 && index % 5 === 0 && sponsoredAds.length > 0;
                const adIndex = Math.floor(index / 5) % sponsoredAds.length;

                return (
                  <div key={post.id}>
                    {showAd && (
                      <SponsoredAd ad={sponsoredAds[adIndex]} likesCount={0} isLiked={false} userId={currentUserId} />
                    )}
                    
                    <article className="bg-card border-y border-border/20">
                      {/* Post Header - Instagram style */}
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600">
                          <Avatar
                            className="h-8 w-8 cursor-pointer border-2 border-background"
                            onClick={() => navigate(`/profile/${post.profiles.id}`)}
                          >
                            <AvatarImage src={post.profiles.avatar_url} className="object-cover" />
                            <AvatarFallback className="bg-muted text-xs font-semibold">
                              {post.profiles.first_name?.[0] || post.profiles.username?.[0]}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => navigate(`/profile/${post.profiles.id}`)}>
                            <span className="font-semibold text-[13px] text-foreground">
                              {post.profiles.username}
                            </span>
                            {(post.profiles.verified || hasSpecialBadgeEmoji(post.profiles.username) || hasSpecialBadgeEmoji(post.profiles.full_name)) && (
                              <VerificationBadge verified={post.profiles.verified} badgeType={post.profiles.badge_type} username={post.profiles.username} fullName={post.profiles.full_name} className="w-3.5 h-3.5" />
                            )}
                            <span className="text-muted-foreground text-xs">
                              · {formatDistanceToNow(new Date(post.created_at), { locale: ptBR, addSuffix: false })}
                            </span>
                          </div>
                          {post.music_name && (
                            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                              {post.music_artist} · {post.music_name}
                            </p>
                          )}
                        </div>
                        
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1" onClick={() => setOptionsSheet({ open: true, post })}>
                          <MoreHorizontal className="h-5 w-5" />
                        </Button>
                      </div>

                      {/* Media */}
                      {post.media_urls && post.media_urls.length > 0 && (
                        <div className="relative overflow-hidden">
                          {renderMediaGrid(post.media_urls, post.id)}
                          {post.music_name && (
                            <div className="absolute bottom-3 left-3 right-3">
                              <MusicPlayer musicName={post.music_name} musicArtist={post.music_artist} musicUrl={post.music_url} overlay />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Music without media */}
                      {post.music_name && (!post.media_urls || post.media_urls.length === 0) && (
                        <div className="px-3 py-2">
                          <MusicPlayer musicName={post.music_name} musicArtist={post.music_artist} musicUrl={post.music_url} />
                        </div>
                      )}

                      {/* Instagram-style Action Buttons */}
                      <div className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-4">
                          <motion.button 
                            onClick={() => handleLike(post.id)}
                            whileTap={{ scale: 0.8 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                          >
                            <Heart className={`h-[26px] w-[26px] transition-colors ${userReaction ? 'text-red-500 fill-red-500' : 'text-foreground'}`} strokeWidth={1.5} />
                          </motion.button>
                          <button onClick={() => navigate(`/comments/${post.id}`)}>
                            <MessageCircle className="h-[26px] w-[26px] text-foreground" strokeWidth={1.5} />
                          </button>
                          <button onClick={() => {
                            navigator.share?.({
                              title: 'Publicação',
                              text: post.content?.slice(0, 100),
                              url: `${window.location.origin}/post/${post.id}`
                            }).catch(() => {
                              navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
                              toast.success("Link copiado!");
                            });
                          }}>
                            <Send className="h-[24px] w-[24px] text-foreground" strokeWidth={1.5} />
                          </button>
                        </div>
                        <motion.button 
                          onClick={() => handleSave(post.id)}
                          whileTap={{ scale: 0.8 }}
                        >
                          <Bookmark className={`h-[26px] w-[26px] transition-colors ${isSaved ? 'fill-foreground text-foreground' : 'text-foreground'}`} strokeWidth={1.5} />
                        </motion.button>
                      </div>

                      {/* Likes count */}
                      {totalReactions > 0 && (
                        <button className="px-3 pb-1" onClick={() => navigate(`/post/${post.id}/likes`)}>
                          <span className="text-[13px] font-semibold">{totalReactions.toLocaleString()} gosto{totalReactions !== 1 ? 's' : ''}</span>
                        </button>
                      )}

                      {/* Content */}
                      {post.content && (
                        <div className="px-3 pb-1">
                          <p className="text-[13px] leading-[18px]">
                            <span className="font-semibold mr-1 cursor-pointer" onClick={() => navigate(`/profile/${post.profiles.id}`)}>
                              {post.profiles.username}
                            </span>
                            {parseTextWithLinksAndMentions(post.content)}
                          </p>
                        </div>
                      )}

                      {/* Comments count */}
                      {post.comments.length > 0 && (
                        <button className="px-3 pb-3" onClick={() => navigate(`/comments/${post.id}`)}>
                          <span className="text-[13px] text-muted-foreground">Ver {post.comments.length} comentário{post.comments.length !== 1 ? 's' : ''}</span>
                        </button>
                      )}
                    </article>
                  </div>
                );
              })}

              {/* End of feed */}
              {posts.length > 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">✓ Estás atualizado</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <BottomNav />

        {optionsSheet.post && (
          <PostOptionsSheet
            open={optionsSheet.open}
            onOpenChange={(open) => setOptionsSheet({ ...optionsSheet, open })}
            postId={optionsSheet.post.id}
            postUserId={optionsSheet.post.user_id}
            currentUserId={currentUserId}
            mediaUrls={optionsSheet.post.media_urls}
          />
        )}

        <CreateStory open={createStoryOpen} onOpenChange={setCreateStoryOpen} />

        {galleryImages && (
          <ImageGalleryViewer images={galleryImages} initialIndex={galleryIndex} onClose={() => setGalleryImages(null)} />
        )}
      </div>
    </ProtectedRoute>
  );
}
