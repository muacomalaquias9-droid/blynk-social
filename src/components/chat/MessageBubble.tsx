import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Play, ImageOff } from 'lucide-react';
import { ReactionPicker } from './ReactionPicker';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import AudioWaveform from './AudioWaveform';

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  hasUserReacted: boolean;
}

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    message_type?: string;
    media_url?: string;
    duration?: number;
  };
  isSent: boolean;
  hideMedia?: boolean;
  isGroupMessage?: boolean | 'channel';
  contextType?: 'chat' | 'group' | 'channel';
  contextId?: string;
  onDeleteLocal?: (id: string) => void;
}

export default function MessageBubble({ message, isSent, hideMedia = false, isGroupMessage = false, contextType = 'chat', contextId, onDeleteLocal }: MessageBubbleProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const messageRef = useRef<HTMLDivElement>(null);

  // Determine which table to use based on message type
  const reactionTable = isGroupMessage === 'channel' 
    ? 'channel_message_reactions' 
    : isGroupMessage === true 
    ? 'group_message_reactions' 
    : 'message_reactions';

  useEffect(() => {
    loadReactions();

    // Subscribe to reactions changes
    const channel = supabase
      .channel(`reactions:${message.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: reactionTable,
          filter: `message_id=eq.${message.id}`,
        },
        () => {
          loadReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [message.id, reactionTable]);

  const loadReactions = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from(reactionTable)
      .select('emoji, user_id')
      .eq('message_id', message.id);

    if (error) {
      console.error('Error loading reactions:', error);
      return;
    }

    // Group reactions by emoji
    const reactionMap = new Map<string, { users: string[]; hasUserReacted: boolean }>();
    
    data.forEach((reaction: any) => {
      const current = reactionMap.get(reaction.emoji) || { users: [], hasUserReacted: false };
      current.users.push(reaction.user_id);
      if (reaction.user_id === user.id) {
        current.hasUserReacted = true;
        setMyReaction(reaction.emoji);
      }
      reactionMap.set(reaction.emoji, current);
    });

    const reactionsArray = Array.from(reactionMap.entries()).map(([emoji, data]) => ({
      emoji,
      count: data.users.length,
      users: data.users,
      hasUserReacted: data.hasUserReacted,
    }));

    setReactions(reactionsArray);

    // Update myReaction if user has no reaction
    if (!data.some((r: any) => r.user_id === user.id)) {
      setMyReaction(null);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };

    touchTimerRef.current = setTimeout(() => {
      // Show reaction picker instantly
      const rect = messageRef.current?.getBoundingClientRect();
      if (rect) {
        setPickerPosition({
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
        setShowReactionPicker(true);
        
        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Cancel if moved more than 10px
    const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    
    if (dx > 10 || dy > 10) {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleReactionSelect = async (emoji: string) => {
    if (!user) return;

    try {
      // If user already has a reaction, remove it first
      if (myReaction) {
        await supabase
          .from(reactionTable)
          .delete()
          .eq('message_id', message.id)
          .eq('user_id', user.id);
      }

      // Add new reaction (unless clicking the same one)
      if (myReaction !== emoji) {
        const { error } = await supabase
          .from(reactionTable)
          .insert({
            message_id: message.id,
            user_id: user.id,
            emoji,
          });

        if (error) throw error;
      }

      loadReactions();
    } catch (error: any) {
      console.error('Error adding reaction:', error);
      toast.error('Erro ao adicionar reação');
    }
  };

  const renderMedia = () => {
    if (hideMedia && (message.message_type === 'image' || message.message_type === 'video')) {
      return (
        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl mb-2">
          <ImageOff className="h-5 w-5 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            Mídia oculta por configurações de privacidade
          </div>
        </div>
      );
    }

    if (message.message_type === 'image' && message.media_url) {
      return (
        <img
          src={message.media_url}
          alt="Imagem"
          className="max-w-[200px] max-h-[200px] object-cover rounded-xl mb-2 hover:scale-[1.02] transition-transform cursor-pointer"
        />
      );
    }

    if (message.message_type === 'video' && message.media_url) {
      return (
        <video
          src={message.media_url}
          controls
          className="max-w-[200px] max-h-[200px] rounded-xl mb-2"
        />
      );
    }

    if (message.message_type === 'audio' && message.media_url) {
      return (
        <div className="mb-2">
          <AudioWaveform 
            src={message.media_url} 
            duration={message.duration} 
            isSent={isSent}
          />
        </div>
      );
    }

    return null;
  };

  const isMediaOnly = (message.message_type === 'image' || message.message_type === 'video') && !message.content;

  const handleCopy = async () => {
    try {
      const textToCopy = message.content || message.media_url || '';
      if (!textToCopy) return;
      await navigator.clipboard.writeText(textToCopy);
      toast.success('Mensagem copiada');
    } catch (error) {
      console.error('Erro ao copiar mensagem:', error);
      toast.error('Não foi possível copiar a mensagem');
    }
  };

  const handleForward = async () => {
    const textToShare = message.content || message.media_url || '';
    if (!textToShare) return;

    try {
      if (navigator.share) {
        await navigator.share({ text: textToShare });
      } else {
        await navigator.clipboard.writeText(textToShare);
        toast.success('Mensagem copiada para reenviar');
      }
    } catch (error) {
      console.error('Erro ao reenviar mensagem:', error);
    }
  };

  const handleReply = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success('Texto copiado para responder');
    } catch (error) {
      console.error('Erro ao preparar resposta:', error);
    }
  };

  const handleReport = () => {
    if (!contextId) return;
    const typeParam = contextType === 'group' ? 'grupo' : 'chat';
    navigate(`/denunciar/${typeParam}/${contextId}`);
  };

  const handleDelete = () => {
    onDeleteLocal?.(message.id);
    toast.success('Mensagem eliminada para você');
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <div
          ref={messageRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`max-w-[80%] transition-all select-text ${
            isMediaOnly 
              ? 'p-0' 
              : `rounded-2xl px-4 py-2.5 shadow-sm hover:shadow-md ${
                  isSent
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted/80 text-foreground rounded-bl-sm'
                }`
          }`}
        >
          {renderMedia()}
          {message.content && (
            <p className="text-base break-words leading-relaxed whitespace-pre-wrap">{message.content}</p>
          )}
          {!isMediaOnly && (
            <p className={`text-[11px] mt-1 ${isSent ? 'text-primary-foreground/70' : 'text-muted-foreground/70'}`}>
              {format(new Date(message.created_at), 'HH:mm')}
            </p>
          )}
        </div>

        {/* Reactions Display */}
        {reactions.length > 0 && (
          <div className={`flex gap-1 flex-wrap ${isSent ? 'justify-end' : 'justify-start'}`}>
            {reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={() => handleReactionSelect(reaction.emoji)}
                className={`
                  flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                  transition-all hover:scale-110 active:scale-95
                  ${reaction.hasUserReacted 
                    ? 'bg-primary/20 border border-primary ring-1 ring-primary/30' 
                    : 'bg-card border border-border hover:bg-muted'
                  }
                `}
              >
                <span className="text-sm">{reaction.emoji}</span>
                <span className={`font-medium ${reaction.hasUserReacted ? 'text-primary' : 'text-muted-foreground'}`}>
                  {reaction.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showReactionPicker && (
        <ReactionPicker
          onSelect={handleReactionSelect}
          onClose={() => setShowReactionPicker(false)}
          position={pickerPosition}
          currentReaction={myReaction || undefined}
          onCopy={handleCopy}
          onForward={handleForward}
          onReply={handleReply}
          onReport={handleReport}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}
