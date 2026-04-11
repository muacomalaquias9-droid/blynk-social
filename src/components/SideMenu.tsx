import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { 
  Menu, Users, MessageCircle, Video, Bookmark,
  Settings as SettingsIcon, HelpCircle, LogOut, Shield, BadgeCheck,
  ChevronRight, Home, Bell, CircleDot, Globe, Wallet, Flag, Megaphone, BarChart3
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useActiveProfile } from "@/contexts/ActiveProfileContext";
import VerificationBadge from "@/components/VerificationBadge";
import { useOnlineFriendsCount } from "@/hooks/useOnlineFriendsCount";
import { useSettings } from "@/contexts/SettingsContext";

interface Profile {
  username: string; full_name: string; first_name: string; avatar_url: string; verified: boolean; badge_type: string | null;
}

const allLanguages = [
  { code: 'pt', name: 'Português', flag: '🇵🇹' }, { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' }, { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' }, { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' }, { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' }, { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' }, { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' }, { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' }, { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' }, { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' }, { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
];

export default function SideMenu() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const { activeProfile } = useActiveProfile();
  const onlineFriendsCount = useOnlineFriendsCount();
  const { settings, updateSettings } = useSettings();

  useEffect(() => { loadProfile(); checkAdmin(); }, [activeProfile]);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (activeProfile?.type === 'page') {
      const { data } = await supabase.from("page_profiles").select("name, avatar_url").eq("id", activeProfile.id).single();
      if (data) setProfile({ username: data.name, full_name: data.name, first_name: data.name, avatar_url: data.avatar_url, verified: false, badge_type: null });
    } else {
      const { data } = await supabase.from("profiles").select("username, full_name, first_name, avatar_url, verified, badge_type").eq("id", user.id).single();
      if (data) setProfile(data);
    }
  };

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setIsAdmin(["isaacmuaco582@gmail.com", "isaacmilagre9@gmail.com"].includes(user.email || ""));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão terminada");
    navigate("/auth");
  };

  const profilePath = activeProfile?.type === 'page' ? `/profile/${activeProfile.id}` : "/profile";
  const currentLang = allLanguages.find(l => l.code === settings.language) || allLanguages[0];

  const menuItems = [
    { icon: Home, label: 'Feed', path: '/' },
    { icon: CircleDot, label: `Online (${onlineFriendsCount})`, path: '/online-friends', dot: onlineFriendsCount > 0 },
    { icon: Users, label: 'Amigos', path: '/friends' },
    { icon: MessageCircle, label: 'Mensagens', path: '/messages' },
    { icon: Bell, label: 'Notificações', path: '/notifications' },
    { icon: Video, label: 'Reels', path: '/videos' },
    { icon: Bookmark, label: 'Guardados', path: '/saved' },
    { icon: Users, label: 'Grupos', path: '/groups' },
    { icon: Flag, label: 'Canais', path: '/channels' },
    { icon: BadgeCheck, label: 'Verificação', path: '/verification' },
    { icon: Wallet, label: 'Monetização', path: '/monetization' },
    { icon: Megaphone, label: 'Criar Anúncio', path: '/create-ad' },
    { icon: BarChart3, label: 'Profissional', path: '/professional' },
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="hover:bg-muted/50 rounded-full"><Menu className="h-6 w-6" /></Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85%] sm:max-w-sm p-0 border-0"
        style={{ backdropFilter: 'blur(60px) saturate(220%)', WebkitBackdropFilter: 'blur(60px) saturate(220%)', backgroundColor: 'hsl(var(--background) / 0.85)' }}>
        <ScrollArea className="h-full">
          <div className="p-4 pt-8">
            {/* Profile */}
            <Link to={profilePath} className="flex items-center gap-3 p-4 rounded-2xl mb-5 bg-muted/15 border border-border/15">
              <Avatar className="h-12 w-12 ring-2 ring-primary/15">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground font-bold">{profile?.first_name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="font-bold text-[15px] truncate">{profile?.full_name || profile?.first_name}</p>
                  {profile?.verified && <VerificationBadge verified={profile.verified} badgeType={profile.badge_type} size="sm" />}
                </div>
                <p className="text-xs text-muted-foreground">@{profile?.username}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
            </Link>

            {/* Menu Items */}
            <div className="space-y-0.5">
              {menuItems.map((item, idx) => (
                <Link key={idx} to={item.path} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                  <div className="relative">
                    <item.icon className="h-[20px] w-[20px] text-muted-foreground/80" />
                    {item.dot && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-green-500 rounded-full" />}
                  </div>
                  <span className="text-[14px] font-medium">{item.label}</span>
                </Link>
              ))}
            </div>

            {isAdmin && (
              <div className="mt-4 pt-3 border-t border-border/10">
                <Link to="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                  <Shield className="h-5 w-5 text-red-500" />
                  <span className="text-[14px] font-medium">Painel Admin</span>
                </Link>
              </div>
            )}

            {/* Language */}
            <div className="mt-4 pt-3 border-t border-border/10">
              <button onClick={() => setShowLanguages(!showLanguages)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                <Globe className="h-5 w-5 text-primary/70" />
                <span className="text-[14px] font-medium flex-1 text-left">{currentLang.flag} {currentLang.name}</span>
              </button>
              {showLanguages && (
                <div className="mt-1 max-h-48 overflow-y-auto rounded-xl bg-muted/15 border border-border/10 p-1">
                  {allLanguages.map(lang => (
                    <button key={lang.code}
                      onClick={() => { updateSettings({ language: lang.code }); setShowLanguages(false); toast.success("Idioma alterado"); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        settings.language === lang.code ? 'bg-primary/10 text-primary' : 'hover:bg-muted/30'
                      }`}>
                      <span>{lang.flag}</span>
                      <span className="text-sm">{lang.name}</span>
                      {settings.language === lang.code && <span className="ml-auto text-primary text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom */}
            <div className="mt-4 pt-3 border-t border-border/10 space-y-0.5">
              <button onClick={() => navigate("/settings")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                <SettingsIcon className="h-5 w-5 text-muted-foreground/70" /><span className="text-[14px] font-medium">Definições</span>
              </button>
              <button onClick={() => navigate("/help")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                <HelpCircle className="h-5 w-5 text-muted-foreground/70" /><span className="text-[14px] font-medium">Ajuda</span>
              </button>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-destructive/10 transition-colors text-destructive">
                <LogOut className="h-5 w-5" /><span className="text-[14px] font-medium">Terminar sessão</span>
              </button>
            </div>

            <p className="text-[10px] text-muted-foreground/30 text-center mt-6 pb-4">© Blynk 2026 · Privacidade · Termos</p>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
