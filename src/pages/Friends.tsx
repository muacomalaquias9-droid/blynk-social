import { useEffect, useState, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, Users, X, TrendingUp, Hash, Play, Grid3X3, Film, MoreHorizontal, UserPlus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';
import { OnlineIndicator } from '@/components/OnlineIndicator';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import VerificationBadge from '@/components/VerificationBadge';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  username: string;
  first_name: string;
  full_name: string | null;
  avatar_url: string | null;
  verified?: boolean;
  badge_type?: string | null;
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  sender: Profile;
}

interface TrendingHashtag {
  id: string;
  name: string;
  post_count: number;
}

interface Video {
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

interface Post {
  id: string;
  content: string;
  media_urls: string[] | null;
  user_id: string;
  created_at: string;
  profiles?: {
    username: string;
    first_name: string;
    avatar_url: string | null;
    verified?: boolean;
  };
}

export default function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const onlineUsers = useOnlineUsers();
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('discover');
  const [trendingHashtags, setTrendingHashtags] = useState<TrendingHashtag[]>([]);
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [searchResults, setSearchResults] = useState<{ users: Profile[]; videos: Video[]; posts: Post[] }>({ users: [], videos: [], posts: [] });
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [fullscreenSheet, setFullscreenSheet] = useState(false);

  const onlineFriendsCount = friendProfiles.filter(u => onlineUsers.has(u.id)).length;

  useEffect(() => {
    if (user) {
      loadUsers();
      loadFriendRequests();
      loadFriends();
      loadTrendingHashtags();
      loadTrendingVideos();
    }

    const channel = supabase
      .channel('friendships-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => loadFriends())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => loadFriendRequests())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim()) handleSearch();
    else setSearchResults({ users: [], videos: [], posts: [] });
  }, [searchQuery]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, first_name, full_name, avatar_url, verified, badge_type')
      .neq('id', user?.id);
    if (data) setAllUsers(data);
  };

  const loadFriendRequests = async () => {
    if (!user) return;
    const { data: received } = await supabase
      .from('friend_requests')
      .select(`*, sender:profiles!friend_requests_sender_id_fkey(id, username, first_name, full_name, avatar_url, verified, badge_type)`)
      .eq('receiver_id', user.id)
      .eq('status', 'pending');
    if (received) setFriendRequests(received as any);

    const { data: sent } = await supabase
      .from('friend_requests')
      .select('receiver_id')
      .eq('sender_id', user.id)
      .eq('status', 'pending');
    if (sent) setSentRequests(sent.map(r => r.receiver_id));
  };

  const loadFriends = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('friendships')
      .select('user_id_1, user_id_2')
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);
    if (data) {
      const friendIds = data.map(f => f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1);
      setFriends(friendIds);
      if (friendIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, first_name, full_name, avatar_url, verified, badge_type')
          .in('id', friendIds);
        if (profiles) setFriendProfiles(profiles);
      }
    }
  };

  const loadTrendingHashtags = async () => {
    const { data } = await supabase.from('hashtags').select('id, name, post_count').order('post_count', { ascending: false }).limit(10);
    if (data) setTrendingHashtags(data);
  };

  const loadTrendingVideos = async () => {
    const { data } = await supabase
      .from('verification_videos')
      .select(`id, video_url, caption, user_id, created_at, profile:profiles!verification_videos_user_id_fkey(username, first_name, avatar_url, verified)`)
      .order('created_at', { ascending: false })
      .limit(12);
    if (data) setTrendingVideos(data as any);
  };

  const handleSearch = async () => {
    const query = searchQuery.toLowerCase();
    const { data: users } = await supabase.from('profiles')
      .select('id, username, first_name, full_name, avatar_url, verified, badge_type')
      .or(`username.ilike.%${query}%,first_name.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(10);
    const { data: videos } = await supabase.from('verification_videos')
      .select(`id, video_url, caption, user_id, created_at, profile:profiles!verification_videos_user_id_fkey(username, first_name, avatar_url, verified)`)
      .ilike('caption', `%${query}%`).limit(10);
    const { data: posts } = await supabase.from('posts')
      .select(`id, content, media_urls, user_id, created_at, profiles(username, first_name, avatar_url, verified)`)
      .ilike('content', `%${query}%`).limit(10);
    setSearchResults({ users: users || [], videos: videos as any || [], posts: posts as any || [] });
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!user) return;
    const { error } = await supabase.from('friend_requests').insert({ sender_id: user.id, receiver_id: receiverId });
    if (error) toast.error('Erro ao enviar pedido');
    else { toast.success('Pedido de amizade enviado!'); setSentRequests([...sentRequests, receiverId]); }
  };

  const acceptFriendRequest = async (requestId: string, senderId: string) => {
    if (!user) return;
    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', requestId);
    const [userId1, userId2] = [user.id, senderId].sort();
    await supabase.from('friendships').insert({ user_id_1: userId1, user_id_2: userId2 });
    toast.success('Pedido aceito!');
    loadFriendRequests();
    loadFriends();
  };

  const rejectFriendRequest = async (requestId: string) => {
    await supabase.from('friend_requests').update({ status: 'rejected' }).eq('id', requestId);
    toast.success('Pedido rejeitado');
    loadFriendRequests();
  };

  const navigateToProfile = (userId: string) => navigate(`/profile/${userId}`);

  const filteredFriends = friendProfiles.filter(profile =>
    profile.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const suggestedUsers = allUsers
    .filter(u => !friends.includes(u.id) && !sentRequests.includes(u.id) && u.id !== user?.id)
    .slice(0, 15);

  return (
    <MainLayout>
      <div className="h-full max-w-2xl mx-auto pb-24 bg-mobile-surface overflow-y-auto overscroll-contain native-scroll">
        {/* Liquid Glass Header */}
        <div className="sticky top-0 z-20 bg-mobile-header text-mobile-header-foreground safe-area-top shadow-lg shadow-mobile-header/20">
          <div className="px-4 pt-3 pb-1 flex items-center justify-between">
            <h1 className="font-display text-[22px] font-extrabold tracking-normal">Explorar</h1>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-mobile-header-foreground/10">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-semibold">{onlineFriendsCount} online</span>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-mobile-header-foreground/65 pointer-events-none" />
              <Input
                type="text"
                placeholder="Pesquisar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 bg-mobile-header-foreground/12 border-0 rounded-2xl h-11 text-[16px] text-mobile-header-foreground focus-visible:ring-1 focus-visible:ring-mobile-header-foreground/35 placeholder:text-mobile-header-foreground/55"
              />
              {searchQuery && (
                <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full text-mobile-header-foreground hover:bg-mobile-header-foreground/10" onClick={() => setSearchQuery('')}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Threads-style pill stats */}
          <div className="flex items-center gap-2 px-4 pb-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-mobile-header-foreground/10 rounded-full">
              <Users className="h-3.5 w-3.5 text-mobile-header-foreground/75" />
              <span className="text-xs font-semibold text-mobile-header-foreground/80">{friends.length} amigos</span>
            </div>
          </div>
        </div>

        {/* Search Results */}
        {searchQuery && (searchResults.users.length > 0 || searchResults.videos.length > 0 || searchResults.posts.length > 0) ? (
          <div className="p-4 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {searchResults.users.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Pessoas</h3>
                <div className="space-y-1">
                  {searchResults.users.map((profile, i) => (
                    <motion.div
                      key={profile.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer hover:bg-muted/40 transition-all active:scale-[0.98]"
                      onClick={() => navigateToProfile(profile.id)}
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={profile.avatar_url || undefined} className="object-cover" />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 font-bold">
                          {profile.first_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-sm">{profile.first_name}</span>
                          {profile.verified && <VerificationBadge verified badgeType={profile.badge_type} size="sm" />}
                        </div>
                        <span className="text-xs text-muted-foreground">@{profile.username}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {searchResults.videos.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Vídeos</h3>
                <div className="grid grid-cols-3 gap-0.5 rounded-2xl overflow-hidden">
                  {searchResults.videos.map(video => (
                    <div key={video.id} className="relative aspect-[9/16] bg-black cursor-pointer" onClick={() => navigate(`/videos?id=${video.id}`)}>
                      <video src={video.video_url} className="w-full h-full object-cover" muted preload="metadata" />
                      <div className="absolute inset-0 flex items-center justify-center"><Play className="h-6 w-6 text-white/70 fill-white/70" /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchResults.posts.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Publicações</h3>
                <div className="grid grid-cols-3 gap-0.5 rounded-2xl overflow-hidden">
                  {searchResults.posts.map(post => (
                    <div key={post.id} className="relative aspect-square bg-muted cursor-pointer" onClick={() => { setSelectedPost(post); setFullscreenSheet(true); }}>
                      {post.media_urls?.[0] ? (
                        <img src={post.media_urls[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-2">
                          <p className="text-[10px] text-muted-foreground line-clamp-4">{post.content}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : !searchQuery ? (
          /* Main Tabs Content */
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-transparent border-b border-border/20 rounded-none h-auto p-0">
              {[
                { value: 'discover', icon: TrendingUp, label: 'Descobrir' },
                { value: 'friends', icon: Users, label: 'Amigos' },
                { value: 'requests', icon: UserPlus, label: 'Pedidos' },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent h-11 text-xs font-bold gap-1.5 relative"
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                  {tab.value === 'requests' && friendRequests.length > 0 && (
                    <span className="absolute top-1 right-3 h-5 w-5 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground rounded-full">
                      {friendRequests.length}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Discover */}
            <TabsContent value="discover" className="mt-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
              {/* Hashtags */}
              <div className="p-4">
                <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                  <Hash className="h-4 w-4 text-primary" /> Hashtags em alta
                </h3>
                <div className="flex flex-wrap gap-2">
                  {trendingHashtags.map(tag => (
                    <button key={tag.id} onClick={() => navigate(`/hashtag/${tag.name}`)}
                      className="px-3.5 py-2 bg-muted/40 hover:bg-muted/70 rounded-full text-sm font-medium transition-colors active:scale-95">
                      #{tag.name}
                      <span className="ml-1.5 text-muted-foreground/60 text-xs">{tag.post_count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Suggested Users - Threads style */}
              <div className="p-4">
                <h3 className="font-bold text-base mb-3">Sugerido para ti</h3>
                <div className="space-y-1">
                  {suggestedUsers.map((profile, i) => (
                    <motion.div
                      key={profile.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/30 transition-all active:scale-[0.98]"
                    >
                      <div className="relative cursor-pointer" onClick={() => navigateToProfile(profile.id)}>
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={profile.avatar_url || undefined} className="object-cover" />
                          <AvatarFallback className="bg-gradient-to-br from-primary/10 to-accent/10 font-bold">
                            {profile.first_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <OnlineIndicator userId={profile.id} size="sm" />
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigateToProfile(profile.id)}>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-sm">{profile.first_name}</span>
                          {profile.verified && <VerificationBadge verified badgeType={profile.badge_type} size="sm" />}
                        </div>
                        <span className="text-xs text-muted-foreground">@{profile.username}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl h-8 text-xs font-bold px-4"
                        onClick={() => sendFriendRequest(profile.id)}
                      >
                        Adicionar
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Trending Videos */}
              {trendingVideos.length > 0 && (
                <div className="p-4">
                  <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                    <Play className="h-4 w-4 text-primary" /> Vídeos em destaque
                  </h3>
                  <div className="grid grid-cols-3 gap-0.5 rounded-2xl overflow-hidden">
                    {trendingVideos.map(video => (
                      <div key={video.id} className="relative aspect-[9/16] bg-black cursor-pointer group" onClick={() => navigate(`/videos?id=${video.id}`)}>
                        <video src={video.video_url} className="w-full h-full object-cover" muted loop playsInline preload="metadata" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-2 left-2 right-2">
                          <span className="text-white text-[10px] font-medium">{video.profile?.username}</span>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="h-8 w-8 text-white fill-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Friends */}
            <TabsContent value="friends" className="mt-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
              {filteredFriends.length === 0 ? (
                <div className="text-center py-20 px-4">
                  <Users className="h-14 w-14 mx-auto mb-3 text-muted-foreground/20" />
                  <h3 className="text-lg font-bold mb-1">Nenhum amigo ainda</h3>
                  <p className="text-muted-foreground text-sm">Adicione amigos para vê-los aqui</p>
                </div>
              ) : (
                <div className="divide-y divide-border/10">
                  {filteredFriends.map((profile, index) => (
                    <motion.div
                      key={profile.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer active:scale-[0.99]"
                      onClick={() => navigateToProfile(profile.id)}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={profile.avatar_url || undefined} className="object-cover" />
                          <AvatarFallback className="bg-gradient-to-br from-primary/10 to-accent/10 font-bold">
                            {profile.first_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <OnlineIndicator userId={profile.id} size="sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="font-bold text-sm">{profile.full_name || profile.first_name}</p>
                          {profile.verified && <VerificationBadge verified={profile.verified} badgeType={profile.badge_type} size="sm" />}
                        </div>
                        <p className="text-xs text-muted-foreground">@{profile.username}</p>
                        {onlineUsers.has(profile.id) && <span className="text-[11px] text-green-500 font-medium">Online</span>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Requests */}
            <TabsContent value="requests" className="mt-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
              {friendRequests.length === 0 ? (
                <div className="text-center py-20 px-4">
                  <UserPlus className="h-14 w-14 mx-auto mb-3 text-muted-foreground/20" />
                  <h3 className="text-lg font-bold mb-1">Nenhum pedido</h3>
                  <p className="text-muted-foreground text-sm">Pedidos de amizade aparecerão aqui.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/10">
                  {friendRequests.map((request, index) => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative cursor-pointer" onClick={() => navigateToProfile(request.sender.id)}>
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={request.sender.avatar_url || undefined} className="object-cover" />
                            <AvatarFallback className="bg-gradient-to-br from-primary/10 to-accent/10 font-bold">
                              {request.sender.first_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="font-bold text-sm">{request.sender.full_name || request.sender.first_name}</p>
                            {request.sender.verified && <VerificationBadge verified={request.sender.verified} badgeType={request.sender.badge_type} size="sm" />}
                          </div>
                          <p className="text-xs text-muted-foreground">@{request.sender.username}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-8 rounded-xl text-xs font-bold px-3" onClick={() => acceptFriendRequest(request.id, request.sender_id)}>
                            <Check className="h-3 w-3 mr-1" />Aceitar
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs font-bold px-3" onClick={() => rejectFriendRequest(request.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : null}

        {/* Fullscreen Post Sheet */}
        <Sheet open={fullscreenSheet} onOpenChange={setFullscreenSheet}>
          <SheetContent side="bottom" className="h-full p-0 rounded-none">
            {selectedPost && (
              <div className="h-full flex flex-col bg-black">
                <div className="flex items-center justify-between p-4 bg-background">
                  <Button variant="ghost" size="icon" onClick={() => setFullscreenSheet(false)}><X className="h-5 w-5" /></Button>
                  <span className="font-bold text-sm">Publicação</span>
                  <Button variant="ghost" size="icon" onClick={() => navigate(`/post/${selectedPost.id}`)}><MoreHorizontal className="h-5 w-5" /></Button>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  {selectedPost.media_urls?.[0] ? (
                    selectedPost.media_urls[0].includes('.mp4') || selectedPost.media_urls[0].includes('.webm') ? (
                      <video src={selectedPost.media_urls[0]} className="max-w-full max-h-full object-contain" controls autoPlay />
                    ) : (
                      <img src={selectedPost.media_urls[0]} alt="" className="max-w-full max-h-full object-contain" />
                    )
                  ) : (
                    <div className="p-8 text-center"><p className="text-lg text-white">{selectedPost.content}</p></div>
                  )}
                </div>
                <div className="p-4 bg-background">
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={selectedPost.profiles?.avatar_url || undefined} />
                      <AvatarFallback>{selectedPost.profiles?.first_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-sm">{selectedPost.profiles?.username}</span>
                  </div>
                  {selectedPost.content && <p className="text-sm">{selectedPost.content}</p>}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </MainLayout>
  );
}
