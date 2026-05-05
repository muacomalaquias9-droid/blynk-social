import { useEffect, useMemo, useState } from 'react';
import { Plus, Play, Image as ImageIcon, Type, Music, Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import CreateStory from '@/components/CreateStory';
import BottomNav from '@/components/BottomNav';
import { StoryViewer } from '@/components/story/StoryViewer';
import { motion } from 'framer-motion';

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  expires_at?: string | null;
  music_name?: string | null;
  music_artist?: string | null;
  profile: {
    username: string;
    first_name: string;
    avatar_url: string | null;
  };
}

export default function Stories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedStories, setSelectedStories] = useState<Story[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('stories-page-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => loadStories())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
    await loadStories();
  };

  const loadStories = async () => {
    const { data } = await supabase
      .from('stories')
      .select('*, profile:profiles!stories_user_id_fkey(username, first_name, avatar_url)')
      .order('created_at', { ascending: false });

    const now = Date.now();
    setStories(((data as any[]) || []).filter((story) => !story.expires_at || new Date(story.expires_at).getTime() > now));
  };

  const groupedStories = useMemo(() => {
    return stories.reduce((acc, story) => {
      if (!acc[story.user_id]) acc[story.user_id] = [];
      acc[story.user_id].push(story);
      return acc;
    }, {} as Record<string, Story[]>);
  }, [stories]);

  const storyGroups = Object.entries(groupedStories).sort(([a], [b]) => {
    if (a === currentUserId) return -1;
    if (b === currentUserId) return 1;
    return 0;
  });

  const openViewer = (userStories: Story[], index = 0) => {
    setSelectedStories(userStories);
    setSelectedIndex(index);
    setViewerOpen(true);
  };

  return (
    <div className="fixed inset-0 bg-mobile-surface overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-40 safe-area-top bg-mobile-header text-mobile-header-foreground shadow-lg shadow-mobile-header/20">
        <div className="max-w-lg mx-auto h-14 px-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-[22px] font-extrabold tracking-normal">Stories</h1>
            <p className="text-xs text-mobile-header-foreground/65">Atualizações recentes</p>
          </div>
          <Button
            type="button"
            size="icon"
            onClick={() => setCreateOpen(true)}
            className="h-10 w-10 rounded-full bg-mobile-header-foreground text-mobile-header hover:bg-mobile-header-foreground/90"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="h-[100dvh] overflow-y-auto overscroll-contain native-scroll pt-[76px] pb-[96px]">
        <div className="max-w-lg mx-auto px-4 space-y-5">
          <section className="rounded-[28px] bg-card shadow-[var(--shadow-card)] border border-border/30 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base">Todos os stories</h2>
              <span className="text-xs text-muted-foreground">{storyGroups.length} perfis</span>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1">
              <button type="button" onClick={() => setCreateOpen(true)} className="flex-shrink-0 w-[76px] text-center active:scale-95 transition-transform">
                <div className="h-[68px] w-[68px] mx-auto rounded-full bg-mobile-header text-mobile-header-foreground flex items-center justify-center border-[3px] border-background shadow-lg">
                  <Plus className="h-7 w-7" />
                </div>
                <span className="mt-2 block text-[12px] font-semibold truncate">Criar</span>
              </button>

              {storyGroups.map(([userId, userStories], index) => {
                const firstStory = userStories[0];
                return (
                  <motion.button
                    key={userId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    type="button"
                    onClick={() => openViewer(userStories)}
                    className="flex-shrink-0 w-[76px] text-center active:scale-95 transition-transform"
                  >
                    <div className="h-[68px] w-[68px] mx-auto rounded-full p-[3px] bg-mobile-header shadow-md">
                      <Avatar className="h-full w-full border-[3px] border-background">
                        <AvatarImage src={firstStory.profile.avatar_url || undefined} className="object-cover" />
                        <AvatarFallback className="bg-muted font-bold">{firstStory.profile.first_name?.[0]}</AvatarFallback>
                      </Avatar>
                    </div>
                    <span className="mt-2 block text-[12px] font-semibold truncate">
                      {userId === currentUserId ? 'Seu story' : firstStory.profile.first_name}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-3 gap-2">
            {stories.map((story, index) => (
              <motion.button
                key={story.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                type="button"
                onClick={() => openViewer(groupedStories[story.user_id], groupedStories[story.user_id].findIndex((item) => item.id === story.id))}
                className="relative aspect-[9/14] rounded-[22px] overflow-hidden bg-muted shadow-[var(--shadow-card)] border border-border/20 active:scale-95 transition-transform"
              >
                {story.media_type === 'video' ? (
                  <>
                    <video src={story.media_url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center"><Play className="h-8 w-8 text-mobile-header-foreground fill-mobile-header-foreground" /></div>
                  </>
                ) : story.media_type === 'image' ? (
                  <img src={story.media_url} alt="Story" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="h-full w-full bg-mobile-header text-mobile-header-foreground p-3 flex items-center justify-center text-sm font-semibold break-words">
                    {decodeURIComponent(story.media_url.replace('data:text/plain,', ''))}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-mobile-header/90 to-transparent text-left">
                  <p className="text-[11px] font-bold text-mobile-header-foreground truncate">{story.profile.first_name}</p>
                  {story.music_name && <p className="text-[10px] text-mobile-header-foreground/70 truncate">{story.music_name}</p>}
                </div>
              </motion.button>
            ))}
          </section>

          {stories.length === 0 && (
            <div className="py-20 text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <ImageIcon className="h-7 w-7 text-muted-foreground" />
              </div>
              <h2 className="font-bold text-lg mb-1">Sem stories agora</h2>
              <p className="text-sm text-muted-foreground">Publica o primeiro story do dia.</p>
            </div>
          )}
        </div>
      </main>

      <div className="fixed left-4 right-4 bottom-[88px] z-30 max-w-lg mx-auto grid grid-cols-3 gap-2 pointer-events-none">
        {[
          { icon: Type, label: 'Texto' },
          { icon: Music, label: 'Música' },
          { icon: Clock, label: '24h' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="pointer-events-auto h-10 rounded-2xl bg-card/80 backdrop-blur-2xl border border-border/30 flex items-center justify-center gap-1.5 text-xs font-semibold shadow-[var(--shadow-card)]">
            <Icon className="h-3.5 w-3.5 text-primary" />
            {label}
          </div>
        ))}
      </div>

      <BottomNav />
      <CreateStory open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) loadStories(); }} />
      {viewerOpen && selectedStories.length > 0 && (
        <StoryViewer stories={selectedStories} initialIndex={selectedIndex} onClose={() => setViewerOpen(false)} onDelete={loadStories} />
      )}
    </div>
  );
}