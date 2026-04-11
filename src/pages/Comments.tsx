import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, MessageCircle, Share2, Send, ArrowLeft, MoreHorizontal, Smile, Image, X, Play, ThumbsUp, Mic, Globe } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import ProtectedRoute from "@/components/ProtectedRoute";
import VerificationBadge, { hasSpecialBadgeEmoji } from "@/components/VerificationBadge";
import MentionTextarea from "@/components/MentionTextarea";
import { useHashtagsAndMentions } from "@/hooks/useHashtagsAndMentions";
import { ImageGalleryViewer } from "@/components/ImageGalleryViewer";
import { TranslateButton } from "@/components/TranslateButton";
import { motion, AnimatePresence } from "framer-motion";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  post_id: string;
  parent_comment_id?: string;
  audio_url?: string;
  profiles: {
    username: string;
    first_name: string;
    avatar_url: string;
    verified?: boolean;
    badge_type?: string | null;
  };
  likes: { count: number }[];
  replies?: Comment[];
  user_liked?: boolean;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  image_url?: string;
  video_url?: string;
  audio_url?: string;
  media_urls?: string[];
  user_id: string;
  profiles: {
    username: string;
    first_name: string;
    avatar_url: string;
    verified?: boolean;
    badge_type?: string | null;
  };
  likes: { count: number }[];
  comments: { count: number }[];
}

// Audio Player Component
const AudioPlayer = ({ url }: { url: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 bg-muted rounded-full px-3 py-2 min-w-[180px]">
      <audio ref={audioRef} src={url} />
      <button
        onClick={togglePlay}
        className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0"
      >
        {isPlaying ? (
          <div className="flex gap-0.5">
            <div className="w-0.5 h-3 bg-primary-foreground rounded-full" />
            <div className="w-0.5 h-3 bg-primary-foreground rounded-full" />
          </div>
        ) : (
          <Play className="h-4 w-4 fill-primary-foreground ml-0.5" />
        )}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="h-1.5 bg-background rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
};

// Comment Card Component with Threads-style heart likes + delete
const CommentCard = ({ 
  comment, 
  onLike, 
  onReply,
  onDelete,
  currentUserId 
}: { 
  comment: Comment; 
  onLike: (id: string) => void;
  onReply: (id: string) => void;
  onDelete: (id: string) => void;
  currentUserId: string;
}) => {
  const navigate = useNavigate();
  const [showReplies, setShowReplies] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  
  // Detect media type
  const isAudio = comment.audio_url && (
    comment.audio_url.includes('.webm') || 
    comment.audio_url.includes('.mp3') || 
    comment.audio_url.includes('.ogg') ||
    comment.audio_url.includes('.m4a')
  );
  
  const isVideo = comment.audio_url && (
    comment.audio_url.includes('.mp4') || 
    comment.audio_url.includes('.mov') ||
    comment.audio_url.includes('.avi')
  );
  
  const isImage = comment.audio_url && !isAudio && !isVideo && (
    comment.audio_url.includes('.jpg') || 
    comment.audio_url.includes('.jpeg') || 
    comment.audio_url.includes('.png') ||
    comment.audio_url.includes('.gif') ||
    comment.audio_url.includes('.webp') ||
    comment.audio_url.includes('/post-images/') ||
    comment.audio_url.includes('/chat-media/')
  );

  const likesCount = comment.likes[0]?.count || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2"
    >
      <Avatar 
        className="h-9 w-9 shrink-0 cursor-pointer ring-2 ring-border/30"
        onClick={() => navigate(`/profile/${comment.user_id}`)}
      >
        <AvatarImage src={comment.profiles.avatar_url} />
        <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-accent/20">
          {comment.profiles.first_name?.[0]?.toUpperCase() || comment.profiles.username?.[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {/* Comment Bubble */}
        <div className="bg-muted rounded-2xl px-3 py-2 inline-block max-w-full">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span 
              className="font-semibold text-sm cursor-pointer hover:underline"
              onClick={() => navigate(`/profile/${comment.user_id}`)}
            >
              {comment.profiles.first_name || comment.profiles.username}
            </span>
            {(comment.profiles.verified || hasSpecialBadgeEmoji(comment.profiles.username)) && (
              <VerificationBadge 
                verified={comment.profiles.verified} 
                badgeType={comment.profiles.badge_type}
                username={comment.profiles.username}
                className="w-3.5 h-3.5"
              />
            )}
          </div>

          {/* Text Content */}
          {comment.content && comment.content !== '🎤 Áudio' && comment.content !== '📷 Imagem' && comment.content !== '🎬 Vídeo' && (
            <p className="text-sm whitespace-pre-wrap break-words mb-1">{comment.content}</p>
          )}

          {/* Media Content */}
          {isAudio && (
            <div className="mt-1">
              <AudioPlayer url={comment.audio_url!} />
            </div>
          )}
          
          {isVideo && (
            <div className="mt-2 relative rounded-xl overflow-hidden max-w-[280px]">
              <video 
                src={comment.audio_url} 
                controls 
                className="w-full rounded-xl"
                preload="metadata"
              />
            </div>
          )}
          
          {isImage && (
            <div className="mt-2">
              <motion.img 
                src={comment.audio_url} 
                alt="Imagem do comentário" 
                className={`rounded-xl cursor-pointer transition-all ${
                  imageExpanded ? 'max-w-full' : 'max-w-[280px] max-h-[200px] object-cover'
                }`}
                onClick={() => setImageExpanded(!imageExpanded)}
                whileHover={{ scale: 1.02 }}
              />
            </div>
          )}
        </div>

        {/* Actions - Threads Style */}
        <div className="flex items-center gap-4 mt-1 px-1">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: false, locale: ptBR })}
          </span>
          
          {/* Heart Like Button - Threads Style */}
          <button 
            className="flex items-center gap-1 group"
            onClick={() => onLike(comment.id)}
          >
            <Heart 
              className={`h-4 w-4 transition-all ${
                comment.user_liked 
                  ? 'text-red-500 fill-red-500 scale-110' 
                  : 'text-muted-foreground group-hover:text-red-500 group-hover:scale-110'
              }`}
            />
            {likesCount > 0 && (
              <span className={`text-xs font-medium ${comment.user_liked ? 'text-red-500' : 'text-muted-foreground'}`}>
                {likesCount}
              </span>
            )}
          </button>
          
          <button 
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onReply(comment.id)}
          >
            Responder
          </button>

          {comment.user_id === currentUserId && (
            <button 
              className="text-xs font-semibold text-destructive/70 hover:text-destructive transition-colors"
              onClick={() => onDelete(comment.id)}
            >
              Eliminar
            </button>
          )}
        </div>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {!showReplies ? (
              <button 
                className="text-xs font-semibold text-primary/80 hover:text-primary flex items-center gap-2 transition-colors"
                onClick={() => setShowReplies(true)}
              >
                <div className="w-8 h-px bg-primary/30" />
                Ver {comment.replies.length} {comment.replies.length === 1 ? 'resposta' : 'respostas'}
              </button>
            ) : (
              <div className="space-y-3 mt-2 pl-2 border-l-2 border-muted">
                {comment.replies.map(reply => (
                  <CommentCard 
                    key={reply.id} 
                    comment={reply} 
                    onLike={onLike} 
                    onReply={onReply}
                    onDelete={onDelete}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default function Comments() {
  const { postId, videoId } = useParams();
  const contentId = postId || videoId; // Support both post and video comments
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [galleryImages, setGalleryImages] = useState<string[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [translatedContent, setTranslatedContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { processCommentHashtagsAndMentions } = useHashtagsAndMentions();

  useEffect(() => {
    loadPost();
    loadComments();
    loadCurrentUser();

    const channel = supabase
      .channel(`comments-${contentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${contentId}` },
        () => {
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contentId]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const loadPost = async () => {
    const { data } = await supabase
      .from("posts")
      .select(`
        *,
        profiles (username, first_name, avatar_url, verified, badge_type),
        likes:post_likes(count),
        comments:comments(count)
      `)
      .eq("id", contentId)
      .single();

    if (data) setPost(data);
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select(`
        *,
        profiles (username, first_name, avatar_url, verified, badge_type),
        likes:comment_likes(count)
      `)
      .eq("post_id", contentId)
      .is("parent_comment_id", null)
      .order("created_at", { ascending: true });

    if (data) {
      const { data: { user } } = await supabase.auth.getUser();
      
      const commentsWithLikesAndReplies = await Promise.all(
        data.map(async (comment) => {
          const { data: replies } = await supabase
            .from("comments")
            .select(`
              *,
              profiles (username, first_name, avatar_url, verified, badge_type),
              likes:comment_likes(count)
            `)
            .eq("parent_comment_id", comment.id)
            .order("created_at", { ascending: true });

          const { data: userLike } = await supabase
            .from("comment_likes")
            .select("*")
            .eq("comment_id", comment.id)
            .eq("user_id", user?.id)
            .maybeSingle();

          return {
            ...comment,
            replies: replies || [],
            user_liked: !!userLike,
          };
        })
      );

      setComments(commentsWithLikesAndReplies);
    }
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const url = URL.createObjectURL(file);
      setMediaPreview(url);
      setIsVideo(file.type.startsWith('video/'));
    }
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setIsVideo(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Voice Recording - 59 second limit
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
        
        // Upload audio
        const fileExt = 'webm';
        const fileName = `comments/${currentUserId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(`audios/${fileName}`, file);

        if (!uploadError) {
          const { data } = supabase.storage.from('chat-media').getPublicUrl(`audios/${fileName}`);
          handleComment(data.publicUrl);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      recordTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 59) {
            stopRecording();
            return 59;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error) {
      toast.error('Permita o acesso ao microfone');
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
    }
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setRecordingTime(0);
  };

  const handleComment = async (audioUrl?: string) => {
    if (!newComment.trim() && !audioUrl && !mediaFile) return;

    setUploading(true);
    try {
      let mediaUrl = audioUrl || null;

      if (mediaFile && !audioUrl) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `comments/${currentUserId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(fileName, mediaFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(fileName);
        mediaUrl = publicUrl;
      }

      let content = newComment.trim();
      if (audioUrl) content = "🎤 Áudio";
      else if (mediaUrl && !content) content = isVideo ? "🎬 Vídeo" : "📷 Imagem";

      const { data: newCommentData, error } = await supabase.from("comments").insert({
        post_id: contentId,
        user_id: currentUserId,
        content,
        audio_url: mediaUrl,
        parent_comment_id: replyingTo,
      }).select().single();

      if (error) throw error;

      if (newCommentData && newComment.trim()) {
        await processCommentHashtagsAndMentions(
          newCommentData.id,
          newComment,
          currentUserId,
          contentId!
        );
      }

      setNewComment("");
      setReplyingTo(null);
      clearMedia();
      loadComments();
      toast.success("Comentário publicado!");
    } catch (error: any) {
      toast.error("Erro ao comentar");
    } finally {
      setUploading(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    const findComment = (comments: Comment[]): Comment | undefined => {
      for (const c of comments) {
        if (c.id === commentId) return c;
        if (c.replies) {
          const found = findComment(c.replies);
          if (found) return found;
        }
      }
    };

    const comment = findComment(comments);
    if (!comment) return;

    if (comment.user_liked) {
      await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", currentUserId);
    } else {
      await supabase.from("comment_likes").insert({
        comment_id: commentId,
        user_id: currentUserId,
      });
    }

    loadComments();
  };

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from("comment_likes").delete().eq("comment_id", commentId);
    await supabase.from("comments").delete().eq("id", commentId).eq("user_id", currentUserId);
    loadComments();
    toast.success("Comentário eliminado");
  };

  const handleImageClick = (images: string[], index: number) => {
    setGalleryImages(images);
    setGalleryIndex(index);
  };

  if (!post) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center gap-2">
            <div className="h-12 w-12 rounded-full bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b bg-background/95 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <Avatar className="h-8 w-8">
              <AvatarImage src={post.profiles.avatar_url} />
              <AvatarFallback>{post.profiles.first_name?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-sm">{post.profiles.first_name}</span>
                {post.profiles.verified && (
                  <VerificationBadge verified={post.profiles.verified} badgeType={post.profiles.badge_type} className="w-3.5 h-3.5" />
                )}
              </div>
              <span className="text-xs text-muted-foreground">Publicação</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto">
            {/* Post */}
            <div className="p-4 border-b">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={post.profiles.avatar_url} />
                  <AvatarFallback>{post.profiles.first_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{post.profiles.first_name}</span>
                    {post.profiles.verified && (
                      <VerificationBadge verified={post.profiles.verified} badgeType={post.profiles.badge_type} className="w-4 h-4" />
                    )}
                    <span className="text-muted-foreground">·</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-[15px] whitespace-pre-wrap">{translatedContent || post.content}</p>
                  <TranslateButton text={post.content} onTranslated={setTranslatedContent} />
                </div>
              </div>

              {/* Media */}
              {post.media_urls && post.media_urls.length > 0 && (
                <div className="mt-3 -mx-4">
                  {post.media_urls.length === 1 ? (
                    <img
                      src={post.media_urls[0]}
                      alt="Post"
                      onClick={() => handleImageClick(post.media_urls!, 0)}
                      className="w-full max-h-[500px] object-cover cursor-pointer"
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-0.5">
                      {post.media_urls.slice(0, 4).map((url, idx) => (
                        <div key={idx} className="relative">
                          <img
                            src={url}
                            alt={`Media ${idx + 1}`}
                            onClick={() => handleImageClick(post.media_urls!, idx)}
                            className="w-full aspect-square object-cover cursor-pointer"
                          />
                          {idx === 3 && post.media_urls!.length > 4 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <span className="text-white text-2xl font-bold">+{post.media_urls!.length - 4}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <ThumbsUp className="h-3 w-3 text-primary-foreground fill-primary-foreground" />
                  </div>
                  <span>{post.likes[0]?.count || 0}</span>
                </div>
                <span>{post.comments[0]?.count || 0} comentários</span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-around mt-2 pt-2 border-t">
                <Button variant="ghost" className="flex-1 gap-2 h-10">
                  <ThumbsUp className="h-5 w-5" />
                  <span className="font-semibold">Gosto</span>
                </Button>
                <Button variant="ghost" className="flex-1 gap-2 h-10">
                  <MessageCircle className="h-5 w-5" />
                  <span className="font-semibold">Comentar</span>
                </Button>
                <Button variant="ghost" className="flex-1 gap-2 h-10">
                  <Share2 className="h-5 w-5" />
                  <span className="font-semibold">Partilhar</span>
                </Button>
              </div>
            </div>

            {/* Comments */}
            <div className="p-4 space-y-4">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Sê o primeiro a comentar</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    onLike={handleLikeComment}
                    onReply={setReplyingTo}
                    currentUserId={currentUserId}
                  />
                ))
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Image Gallery */}
        {galleryImages && (
          <ImageGalleryViewer
            images={galleryImages}
            initialIndex={galleryIndex}
            onClose={() => setGalleryImages(null)}
          />
        )}

        {/* Input */}
        <div className="border-t bg-background">
          {/* Media Preview */}
          <AnimatePresence>
            {mediaPreview && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 border-b"
              >
                <div className="relative inline-block max-w-xs">
                  {isVideo ? (
                    <div className="relative rounded-xl overflow-hidden bg-black">
                      <video src={mediaPreview} className="max-h-24 rounded-xl" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Play className="h-6 w-6 text-white/80 fill-white/80" />
                      </div>
                    </div>
                  ) : (
                    <img src={mediaPreview} alt="Preview" className="max-h-24 rounded-xl" />
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={clearMedia}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Replying to indicator */}
          <AnimatePresence>
            {replyingTo && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 py-2 border-b bg-muted/50 flex items-center justify-between"
              >
                <span className="text-sm text-muted-foreground">A responder a um comentário</span>
                <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-3 flex items-center gap-2 max-w-2xl mx-auto">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback>U</AvatarFallback>
            </Avatar>

            {isRecording ? (
              <div className="flex-1 flex items-center gap-3 bg-destructive/10 rounded-full px-4 py-2">
                <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm font-medium text-destructive">
                  {recordingTime}s / 59s
                </span>
                <div className="flex-1" />
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-full"
                  onClick={stopRecording}
                >
                  Parar
                </Button>
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-1 bg-muted rounded-full px-3 py-1.5">
                <MentionTextarea
                  value={newComment}
                  onChange={setNewComment}
                  placeholder={replyingTo ? "Escrever resposta..." : "Escreva um comentário..."}
                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto min-h-0 text-sm"
                  rows={1}
                />
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleMediaSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Image className="h-5 w-5 text-muted-foreground" />
                </Button>
                
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={startRecording}
                >
                  <Mic className="h-5 w-5 text-muted-foreground" />
                </Button>

                {(newComment.trim() || mediaFile) && (
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-full shrink-0"
                    disabled={uploading}
                    onClick={() => handleComment()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
