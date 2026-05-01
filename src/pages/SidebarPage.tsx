import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import VerificationBadge from "@/components/VerificationBadge";
import { Logo2026 } from "@/components/Logo2026";
import {
  Home, Search, Film, MessageCircle, Bell, PlusSquare,
  LogOut, Settings, Bookmark, Shield, Users, Sun, Moon,
  Target, Video, DollarSign, BadgeCheck, CreditCard,
  HelpCircle, FileText, Lock, ChevronRight, Megaphone,
  TrendingUp, Globe, Webhook, BookOpen, Activity
} from "lucide-react";

interface Profile {
  username: string;
  avatar_url: string;
  first_name?: string;
  full_name?: string;
  verified?: boolean;
  badge_type?: string;
}

const allLanguages = [
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
];

export default function SidebarPage() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showLang, setShowLang] = useState(false);

  const isDarkMode = settings.theme === 'dark';
  const currentLang = allLanguages.find(l => l.code === settings.language) || allLanguages[0];

  useEffect(() => {
    loadProfile();
    checkAdminStatus();
    loadUnreadCounts();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("profiles").select("username, avatar_url, first_name, full_name, verified, badge_type").eq("id", user.id).single();
    if (data) setProfile(data);
  };

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    setIsAdmin(!!data);
  };

  const loadUnreadCounts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [notif, msg] = await Promise.all([
      supabase.from("notifications").select("*", { count: 'exact', head: true }).eq("user_id", user.id).eq("is_read", false),
      supabase.from("messages").select("*", { count: 'exact', head: true }).eq("receiver_id", user.id).eq("read", false),
    ]);
    setUnreadNotifications(notif.count || 0);
    setUnreadMessages(msg.count || 0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão terminada");
    navigate("/auth");
  };

  const MenuItem = ({ icon: Icon, label, path, badge, accent }: { icon: any; label: string; path: string; badge?: number; accent?: boolean }) => (
    <Link to={path} className="flex items-center gap-3.5 px-4 py-3 rounded-2xl hover:bg-muted/40 active:scale-[0.98] transition-all">
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", accent ? "bg-primary/10" : "bg-muted/60")}>
        <Icon className={cn("h-[18px] w-[18px]", accent ? "text-primary" : "text-foreground/70")} strokeWidth={1.8} />
      </div>
      <span className="flex-1 text-[14px] font-medium text-foreground/90">{label}</span>
      {badge && badge > 0 ? (
        <span className="min-w-[22px] h-[22px] px-1.5 bg-destructive text-destructive-foreground text-[11px] font-bold rounded-full flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
      )}
    </Link>
  );

  const SectionTitle = ({ title }: { title: string }) => (
    <p className="px-5 pt-5 pb-1.5 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">{title}</p>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 safe-area-top"
        style={{
          background: 'hsl(var(--background) / 0.8)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderBottom: '0.5px solid hsl(var(--border) / 0.15)',
        }}>
        <div className="flex items-center justify-between h-12 px-4">
          <Logo2026 size="md" />
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={() => updateSettings({ theme: isDarkMode ? 'light' : 'dark' })}
              className="h-9 w-9 rounded-xl bg-muted/40">
              {isDarkMode ? <Sun className="h-[18px] w-[18px] text-amber-400" /> : <Moon className="h-[18px] w-[18px]" />}
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-3rem)]">
        <div className="pb-8">
          {/* Profile Card */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-3 mt-3">
            <Link to="/profile" className="flex items-center gap-3.5 p-4 rounded-2xl bg-muted/20 border border-border/10 hover:bg-muted/30 transition-colors">
              <Avatar className="h-14 w-14 ring-2 ring-primary/10">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                  {profile?.first_name?.[0] || profile?.username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[15px] truncate">{profile?.full_name || profile?.first_name || 'Utilizador'}</span>
                  {profile?.verified && <VerificationBadge badgeType={profile.badge_type} />}
                </div>
                <p className="text-[12px] text-muted-foreground">@{profile?.username}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
            </Link>
          </motion.div>

          {/* Main */}
          <SectionTitle title="Principal" />
          <div className="mx-2">
            <MenuItem icon={Home} label="Início" path="/feed" />
            <MenuItem icon={Search} label="Explorar" path="/friends" />
            <MenuItem icon={MessageCircle} label="Mensagens" path="/messages" badge={unreadMessages} />
            <MenuItem icon={Bell} label="Notificações" path="/notifications" badge={unreadNotifications} />
            <MenuItem icon={Film} label="Reels" path="/videos" />
            <MenuItem icon={Bookmark} label="Guardados" path="/saved" />
          </div>

          {/* Social */}
          <SectionTitle title="Social" />
          <div className="mx-2">
            <MenuItem icon={Users} label="Amigos" path="/friends" />
            <MenuItem icon={Users} label="Grupos" path="/groups" />
            <MenuItem icon={Target} label="CTF Hacking" path="/ctf" />
          </div>

          {/* Criar */}
          <SectionTitle title="Criar" />
          <div className="mx-2">
            <MenuItem icon={PlusSquare} label="Nova Publicação" path="/create" accent />
            <MenuItem icon={Megaphone} label="Criar Anúncio" path="/create-ad" />
            <MenuItem icon={Video} label="Editor de Vídeo" path="/video-editor" />
          </div>

          {/* Premium */}
          <SectionTitle title="Premium" />
          <div className="mx-2">
            <MenuItem icon={DollarSign} label="Monetização" path="/monetization" />
            <MenuItem icon={BadgeCheck} label="Verificação" path="/verification-checkout" accent />
            <MenuItem icon={TrendingUp} label="Profissional" path="/professional" />
          </div>

          {/* Admin */}
          {isAdmin && (
            <>
              <SectionTitle title="Administração" />
              <div className="mx-2">
                <MenuItem icon={Shield} label="Painel Admin" path="/admin" accent />
                <MenuItem icon={CreditCard} label="Pagamentos" path="/admin/verification" />
                <MenuItem icon={Webhook} label="API & Webhooks" path="/api-keys" accent />
                <MenuItem icon={BookOpen} label="Documentação API" path="/docs" />
                <MenuItem icon={Activity} label="API Status" path="/api-status" />
              </div>
            </>
          )}

          {/* Language */}
          <SectionTitle title="Idioma" />
          <div className="mx-2">
            <button onClick={() => setShowLang(!showLang)} className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl hover:bg-muted/40 transition-colors">
              <div className="h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center">
                <Globe className="h-[18px] w-[18px] text-foreground/70" strokeWidth={1.8} />
              </div>
              <span className="flex-1 text-[14px] font-medium text-foreground/90 text-left">{currentLang.flag} {currentLang.name}</span>
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground/30 transition-transform", showLang && "rotate-90")} />
            </button>
            {showLang && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                className="mx-4 mt-1 max-h-48 overflow-y-auto rounded-xl bg-muted/20 border border-border/10 p-1">
                {allLanguages.map(lang => (
                  <button key={lang.code}
                    onClick={() => { updateSettings({ language: lang.code }); setShowLang(false); toast.success("Idioma alterado"); }}
                    className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      settings.language === lang.code ? 'bg-primary/10 text-primary' : 'hover:bg-muted/30')}>
                    <span className="text-base">{lang.flag}</span>
                    <span className="text-[13px] flex-1">{lang.name}</span>
                    {settings.language === lang.code && <span className="text-primary text-xs font-bold">✓</span>}
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Settings */}
          <SectionTitle title="Definições" />
          <div className="mx-2">
            <MenuItem icon={Settings} label="Configurações" path="/app-settings" />
            <MenuItem icon={Lock} label="Privacidade" path="/settings/security" />
            <MenuItem icon={HelpCircle} label="Ajuda" path="/help" />
            <MenuItem icon={FileText} label="Termos" path="/terms" />
          </div>

          {/* Logout */}
          <div className="mx-5 mt-5">
            <Button variant="outline" onClick={handleLogout}
              className="w-full h-12 rounded-2xl border-destructive/20 text-destructive hover:bg-destructive/5 font-semibold">
              <LogOut className="h-[18px] w-[18px] mr-2" strokeWidth={1.8} />
              Terminar Sessão
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground/30 text-center mt-6 pb-4">© 2026/2027 Blynk · Privacidade · Termos</p>
        </div>
      </ScrollArea>
    </div>
  );
}
