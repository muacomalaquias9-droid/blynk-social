import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { MessageNotification } from "@/components/MessageNotification";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Share2, Bookmark, Play, Volume2, VolumeX, MoreHorizontal, Heart, Send, Menu, RefreshCw, Loader2 } from "lucide-react";
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
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [optionsSheet, setOptionsSheet] = useState<{ open: boolean; post: Post | null }>({ open: false, post: null });
  const [mutedVideos, setMutedVideos] = useState<{ [key: string]: boolean }>({});
  const [likeAnimations, setLikeAnimations] = useState<{ [key: string]: boolean }>({});
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedVideosRef = useRef<Set<HTMLVideoElement>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = scrollContainerRef.current;
    if (container && container.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || refreshing) return;
    const container = scrollContainerRef.current;
    if (container && container.scrollTop > 0) { isPulling.current = false; setPullDistance(0); return; }
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 80));
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > 50 && !refreshing) {
      setRefreshing(true);
      setPullDistance(60);
      await loadPosts();
      await new Promise(r => setTimeout(r, 600));
      setRefreshing(false);
    }
    setPullDistance(0);
    isPulling.current = false;
  }, [pullDistance, refreshing]);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const [profileResult, savedResult, blockedResult] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('saved_posts').select('post_id').eq('user_id', user.id),
          supabase.from('blocked_accounts').select('user_id'),
        ]);
        if (profileResult.data) setMyProfile(profileResult.data);
        if (savedResult.data) setSavedPosts(savedResult.data.map(s => s.post_id));
        if (blockedResult.data) setBlockedUserIds(blockedResult.data.map(b => b.user_id));
      }
      await Promise.all([loadPosts(), loadSponsoredAds()]);
      setLoading(false);
    };
    loadData();

    // Real-time: posts + stories update instantly
    const channel = supabase.channel("feed-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_reactions" }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => {
        // Stories bar updates automatically via its own channel
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    observerRef.current?.disconnect();
    observedVideosRef.current = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            pauseAllAudio();
            observedVideosRef.current.forEach((v) => { if (v !== video && !v.paused) v.pause(); });
            video.muted = false;
            video.play().catch(() => { video.muted = true; video.play().catch(console.log); });
          } else { if (!video.paused) video.pause(); }
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
    const { data } = await supabase.from("posts")
      .select(`*, profiles(id, username, full_name, first_name, avatar_url, verified, badge_type), post_likes(user_id), post_reactions(user_id, reaction_type), comments(id)`)
      .order("created_at", { ascending: false }).limit(30);
    if (data) setPosts(data);
  };

  const loadSponsoredAds = async () => {
    const { data } = await supabase.from("sponsored_ads").select("*").eq("is_active", true);
    if (data) setSponsoredAds(data);
  };

  // Optimistic like
  const handleLike = async (postId: string) => {
    if (!currentUserId) return;
    const postIdx = posts.findIndex(p => p.id === postId);
    if (postIdx === -1) return;
    const post = posts[postIdx];
    const existingReaction = post.post_reactions?.find(r => r.user_id === currentUserId);
    const existingLike = post.post_likes?.find(l => l.user_id === currentUserId);
    const existing = existingReaction || existingLike;

    // Optimistic update
    const newPosts = [...posts];
    if (existing) {
      newPosts[postIdx] = {
        ...post,
        post_reactions: (post.post_reactions || []).filter(r => r.user_id !== currentUserId),
        post_likes: (post.post_likes || []).filter(l => l.user_id !== currentUserId),
      };
      playClickSound();
    } else {
      const allowed = await checkLikeLimit();
      if (!allowed) return;
      newPosts[postIdx] = {
        ...post,
        post_reactions: [...(post.post_reactions || []), { user_id: currentUserId, reaction_type: "heart" }],
        post_likes: [...(post.post_likes || []), { user_id: currentUserId }],
      };
      playLikeSound();
      setLikeAnimations(prev => ({ ...prev, [postId]: true }));
      setTimeout(() => setLikeAnimations(prev => ({ ...prev, [postId]: false })), 1000);
    }
    setPosts(newPosts);

    // DB operation
    if (existing) {
      await Promise.all([
        supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", currentUserId),
        supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", currentUserId),
      ]);
    } else {
      await Promise.all([
        supabase.from("post_reactions").insert({ post_id: postId, user_id: currentUserId, reaction_type: "heart" }),
        supabase.from("post_likes").insert({ post_id: postId, user_id: currentUserId }),
      ]);
    }
  };

  const handleDoubleTapLike = async (postId: string) => {
    const userReaction = posts.find(p => p.id === postId)?.post_reactions?.find(r => r.user_id === currentUserId);
    if (!userReaction) { await handleLike(postId); }
    else {
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
    const reaction = post.post_reactions?.find(r => r.user_id === currentUserId)?.reaction_type;
    if (reaction) return reaction;
    return post.post_likes?.some(like => like.user_id === currentUserId) ? 'heart' : undefined;
  };

  const getLikeCount = (post: Post) => Math.max(post.post_reactions?.length || 0, post.post_likes?.length || 0);

  const isVideo = (url: string) => {
    if (!url) return false;
    const l = url.toLowerCase();
    return l.includes(".mp4") || l.includes(".webm") || l.includes(".mov") || l.includes(".avi") || l.includes(".mkv");
  };

  const toggleVideoMute = (postId: string) => {
    const video = videoRefs.current[postId];
    if (video) { video.muted = !video.muted; setMutedVideos({ ...mutedVideos, [postId]: video.muted }); }
  };

  const registerVideoRef = (key: string) => (el: HTMLVideoElement | null) => {
    const prev = videoRefs.current[key];
    if (prev && observerRef.current) { observerRef.current.unobserve(prev); observedVideosRef.current.delete(prev); }
    if (el) { videoRefs.current[key] = el; observedVideosRef.current.add(el); observerRef.current?.observe(el); }
    else { delete videoRefs.current[key]; }
  };

  const VideoPlayer = ({ url, postId }: { url: string; postId: string }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const isMuted = mutedVideos[postId] ?? false;

    const handleError = () => {
      if (retryCount < 2) {
        setRetryCount(r => r + 1);
        const video = videoRefs.current[postId];
        if (video) { video.load(); video.play().catch(() => {}); }
      } else {
        setHasError(true);
      }
    };

    if (hasError) {
      return (
        <div className="relative bg-muted/30 overflow-hidden aspect-video flex items-center justify-center rounded-3xl">
          <div className="text-center p-4">
            <Play className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-xs text-muted-foreground">Não foi possível carregar</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative bg-black/5 dark:bg-white/5 overflow-hidden rounded-3xl" onClick={() => {
        const video = videoRefs.current[postId];
        if (video) { if (video.paused) { pauseAllAudio(); video.play(); } else { video.pause(); } }
      }}>
        <video ref={registerVideoRef(postId)} className="w-full max-h-[520px] object-contain cursor-pointer"
          playsInline muted={isMuted} loop preload="auto"
          onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onError={handleError}>
          <source src={url} type="video/mp4" />
        </video>
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-16 w-16 rounded-full bg-background/80 backdrop-blur-xl flex items-center justify-center shadow-2xl border border-border/20">
              <Play className="h-7 w-7 text-foreground fill-foreground ml-1" />
            </div>
          </div>
        )}
        <button className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-background/60 backdrop-blur-xl flex items-center justify-center border border-border/20"
          onClick={(e) => { e.stopPropagation(); toggleVideoMute(postId); }}>
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
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
          {isVideo(url) ? <VideoPlayer url={url} postId={postId} /> : (
            <img src={url} alt="Post" className="w-full object-cover rounded-3xl cursor-pointer" loading="lazy" onClick={() => setGalleryImages(mediaUrls)} />
          )}
          <AnimatePresence>
            {likeAnimations[postId] && (
              <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }} className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Heart className="h-24 w-24 text-white fill-white drop-shadow-2xl" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }
    return (
      <div className={`grid gap-1.5 rounded-3xl overflow-hidden ${mediaUrls.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`} onDoubleClick={() => handleDoubleTapLike(postId)}>
        {mediaUrls.slice(0, 4).map((url, idx) => (
          <div key={idx} className={`relative cursor-pointer ${mediaUrls.length === 3 && idx === 0 ? 'row-span-2' : ''}`}
            onClick={() => { if (!isVideo(url)) { setGalleryImages(mediaUrls.filter(u => !isVideo(u))); setGalleryIndex(idx); } }}>
            {isVideo(url) ? (
              <div className="relative aspect-square bg-black/5 dark:bg-white/5">
                <video src={url} className="w-full h-full object-cover" playsInline muted preload="metadata"
                  onClick={(e) => { e.stopPropagation(); pauseAllAudio(); const vid = e.currentTarget; if (vid.paused) vid.play(); else vid.pause(); }} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Play className="h-8 w-8 text-white/80 fill-white/80" />
                </div>
              </div>
            ) : (
              <img src={url} alt="" className="w-full aspect-square object-cover" loading="lazy" />
            )}
            {idx === 3 && mediaUrls.length > 4 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-xl font-bold">+{mediaUrls.length - 4}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const visiblePosts = posts.filter(post => !blockedUserIds.includes(post.user_id));

  if (loading) {
    return (
      <ProtectedRoute>
        <MessageNotification />
        <div className="min-h-screen bg-background"><FeedSkeleton /></div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <MessageNotification />
      <div className="min-h-screen bg-background">
        {/* Header - Floating glass */}
        <header className="fixed top-0 left-0 right-0 z-50 safe-area-top"
          style={{
            background: 'hsl(var(--background) / 0.72)',
            backdropFilter: 'blur(48px) saturate(200%)',
            WebkitBackdropFilter: 'blur(48px) saturate(200%)',
            borderBottom: '0.5px solid hsl(var(--border) / 0.08)',
          }}
        >
          <div className="flex items-center justify-between h-12 px-4 max-w-lg mx-auto">
            <div className="flex items-center gap-2.5">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl active:scale-90 transition-transform" onClick={() => navigate("/sidebar")}>
                <Menu className="h-5 w-5" strokeWidth={1.5} />
              </Button>
              <Logo2026 size="sm" />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl active:scale-90 transition-transform" onClick={() => navigate("/notifications")}>
                <Heart className="h-5 w-5" strokeWidth={1.5} />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl active:scale-90 transition-transform" onClick={() => navigate("/messages")}>
                <Send className="h-5 w-5" strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        </header>

        {/* Pull-to-refresh indicator */}
        <div className="fixed top-12 left-0 right-0 z-40 flex justify-center pointer-events-none"
          style={{ transform: `translateY(${Math.max(pullDistance - 20, 0)}px)`, opacity: pullDistance > 10 ? 1 : 0, transition: refreshing ? 'none' : 'all 0.2s ease-out' }}>
          <div className={`h-10 w-10 rounded-full bg-background shadow-lg border border-border/30 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
            {refreshing ? <Loader2 className="h-5 w-5 text-primary" /> : <RefreshCw className={`h-4 w-4 text-muted-foreground transition-transform`} style={{ transform: `rotate(${pullDistance * 3}deg)` }} />}
          </div>
        </div>

        <div ref={scrollContainerRef}
          className="pt-12 pb-[72px] h-screen overflow-y-auto native-scroll"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ transform: refreshing ? 'translateY(40px)' : `translateY(${pullDistance > 0 ? pullDistance * 0.3 : 0}px)`, transition: refreshing || pullDistance > 0 ? 'transform 0.3s ease-out' : 'none' }}
        >
          <div className="max-w-lg mx-auto">
            <StoriesBar onCreateStory={() => setCreateStoryOpen(true)} />

            <div className="px-3 my-2"><UserSuggestions /></div>

            {/* Posts Feed - New unique card design */}
            <div className="space-y-3 px-3 pb-4">
              {visiblePosts.map((post, index) => {
                const userReaction = getUserReaction(post);
                const totalReactions = getLikeCount(post);
                const isSaved = savedPosts.includes(post.id);
                const showAd = index > 0 && index % 5 === 0 && sponsoredAds.length > 0;
                const adIndex = Math.floor(index / 5) % sponsoredAds.length;

                return (
                  <motion.div key={post.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                  >
                    {showAd && <div className="mb-3"><SponsoredAd ad={sponsoredAds[adIndex]} likesCount={0} isLiked={false} userId={currentUserId} /></div>}
                    
                    {/* Card with subtle glass effect */}
                    <article className="rounded-[28px] overflow-hidden"
                      style={{
                        background: 'hsl(var(--card) / 0.5)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid hsl(var(--border) / 0.08)',
                        boxShadow: '0 2px 16px hsl(var(--foreground) / 0.03)',
                      }}
                    >
                      {/* User Header */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="relative">
                          <Avatar className="h-10 w-10 cursor-pointer ring-2 ring-border/10" onClick={() => navigate(`/profile/${post.profiles.id}`)}>
                            <AvatarImage src={post.profiles.avatar_url} className="object-cover" />
                            <AvatarFallback className="bg-muted text-sm font-semibold">
                              {post.profiles.first_name?.[0] || post.profiles.username?.[0]}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => navigate(`/profile/${post.profiles.id}`)}>
                            <span className="font-semibold text-[14px] leading-tight">{post.profiles.first_name || post.profiles.username}</span>
                            {(post.profiles.verified || hasSpecialBadgeEmoji(post.profiles.username) || hasSpecialBadgeEmoji(post.profiles.full_name)) && (
                              <VerificationBadge verified={post.profiles.verified} badgeType={post.profiles.badge_type} username={post.profiles.username} fullName={post.profiles.full_name} className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground text-[11px]">@{post.profiles.username}</span>
                            <span className="text-muted-foreground/40 text-[11px]">·</span>
                            <span className="text-muted-foreground text-[11px]">
                              {formatDistanceToNow(new Date(post.created_at), { locale: ptBR, addSuffix: false })}
                            </span>
                          </div>
                        </div>
                        
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-2xl" onClick={() => setOptionsSheet({ open: true, post })}>
                          <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                        </Button>
                      </div>

                      {/* Text Content */}
                      {post.content && (
                        <div className="px-4 pb-2.5">
                          <p className="text-[14px] leading-[22px] text-foreground/90">
                            {parseTextWithLinksAndMentions(post.content)}
                          </p>
                        </div>
                      )}

                      {/* Music tag - minimal */}
                      {post.music_name && post.music_url && (
                        <div className="px-4 pb-2">
                          <MusicPlayer
                            musicName={post.music_name}
                            musicArtist={post.music_artist}
                            musicUrl={post.music_url}
                          />
                        </div>
                      )}

                      {/* Media */}
                      {post.media_urls && post.media_urls.length > 0 && (
                        <div className="px-3 pb-2">
                          {renderMediaGrid(post.media_urls, post.id)}
                        </div>
                      )}

                      {/* Interaction bar */}
                      <div className="flex items-center px-4 py-2.5 gap-0.5">
                        <motion.button onClick={() => handleLike(post.id)} whileTap={{ scale: 0.8 }}
                          transition={{ type: "spring", stiffness: 400, damping: 17 }}
                          className="flex items-center gap-1.5 h-9 px-3 rounded-2xl hover:bg-muted/50 active:bg-muted transition-colors">
                          <Heart className={`h-[20px] w-[20px] transition-all duration-200 ${userReaction ? 'text-red-500 fill-red-500 scale-110' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                          {totalReactions > 0 && (
                            <span className={`text-[13px] font-medium tabular-nums ${userReaction ? 'text-red-500' : 'text-muted-foreground'}`}>{totalReactions}</span>
                          )}
                        </motion.button>
                        
                        <button onClick={() => navigate(`/comments/${post.id}`)}
                          className="flex items-center gap-1.5 h-9 px-3 rounded-2xl hover:bg-muted/50 active:bg-muted transition-colors">
                          <MessageCircle className="h-[20px] w-[20px] text-muted-foreground" strokeWidth={1.5} />
                          {post.comments.length > 0 && (
                            <span className="text-[13px] font-medium text-muted-foreground tabular-nums">{post.comments.length}</span>
                          )}
                        </button>
                        
                        <button onClick={() => {
                          navigator.share?.({ title: 'Publicação', text: post.content?.slice(0, 100), url: `${window.location.origin}/post/${post.id}` })
                            .catch(() => { navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`); toast.success("Link copiado!"); });
                        }} className="h-9 px-3 rounded-2xl hover:bg-muted/50 active:bg-muted transition-colors">
                          <Send className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.5} />
                        </button>
                        
                        <div className="flex-1" />
                        
                        <motion.button onClick={() => handleSave(post.id)} whileTap={{ scale: 0.8 }}
                          className="h-9 px-3 rounded-2xl hover:bg-muted/50 active:bg-muted transition-colors">
                          <Bookmark className={`h-[20px] w-[20px] transition-all duration-200 ${isSaved ? 'fill-foreground text-foreground' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                        </motion.button>
                      </div>
                    </article>
                  </motion.div>
                );
              })}

              {visiblePosts.length > 0 && (
                <div className="py-8 text-center">
                  <p className="text-[12px] text-muted-foreground/60">Estás atualizado ✓</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <BottomNav />

        {optionsSheet.post && (
          <PostOptionsSheet open={optionsSheet.open} onOpenChange={(open) => setOptionsSheet({ ...optionsSheet, open })}
            postId={optionsSheet.post.id} postUserId={optionsSheet.post.user_id} currentUserId={currentUserId} mediaUrls={optionsSheet.post.media_urls} />
        )}

        <CreateStory open={createStoryOpen} onOpenChange={setCreateStoryOpen} />
        {galleryImages && <ImageGalleryViewer images={galleryImages} initialIndex={galleryIndex} onClose={() => setGalleryImages(null)} />}
      </div>
    </ProtectedRoute>
  );
}
