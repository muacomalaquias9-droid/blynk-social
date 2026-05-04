import { Link, useLocation } from "react-router-dom";
import { Home, Compass, Plus, MessageCircle, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";

export default function BottomNav() {
  const location = useLocation();
  const { settings } = useSettings();
  const [profile, setProfile] = useState<{ avatar_url: string | null; id: string } | null>(null);
  const isDarkMode = settings.theme === 'dark';

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("avatar_url, id").eq("id", user.id).single();
      if (data) setProfile(data);
    };
    loadProfile();
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const leftItems = [
    { to: "/feed", icon: Home, label: "Início" },
    { to: "/videos", icon: Compass, label: "Explorar" },
  ];
  const rightItems = [
    { to: "/messages", icon: MessageCircle, label: "Mensagens" },
    { to: "/profile", icon: User, label: "Perfil" },
  ];

  const hiddenPaths = ["/auth", "/", "/signup", "/reset-password", "/two-factor-verification", "/blocked"];
  if (hiddenPaths.some(p => location.pathname === p)) return null;
  if (location.pathname.startsWith("/chat/")) return null;

  const renderItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
    const active = isActive(to);
    return (
      <Link
        key={to}
        to={to}
        aria-label={label}
        className="flex flex-col items-center justify-center h-12 w-12 rounded-2xl active:scale-90 transition-transform"
      >
        <Icon
          className="h-[24px] w-[24px]"
          strokeWidth={active ? 2.4 : 1.8}
          style={{ color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground) / 0.55)' }}
        />
      </Link>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom px-5 pb-3 pointer-events-none">
      <div className="relative mx-auto max-w-md pointer-events-auto">
        <nav
          className="rounded-[28px] overflow-visible"
          style={{
            background: isDarkMode
              ? 'rgba(18, 18, 20, 0.72)'
              : 'rgba(252, 252, 253, 0.78)',
            backdropFilter: 'blur(50px) saturate(200%)',
            WebkitBackdropFilter: 'blur(50px) saturate(200%)',
            border: isDarkMode
              ? '0.5px solid rgba(255,255,255,0.1)'
              : '0.5px solid rgba(0,0,0,0.06)',
            boxShadow: isDarkMode
              ? '0 8px 32px rgba(0,0,0,0.5), inset 0 0.5px 0 rgba(255,255,255,0.06)'
              : '0 8px 32px rgba(0,0,0,0.10), inset 0 0.5px 0 rgba(255,255,255,0.85)',
          }}
        >
          <div className="flex items-center justify-between h-[60px] px-4">
            <div className="flex items-center gap-2">{leftItems.map(renderItem)}</div>
            {/* Spacer for the floating center button */}
            <div className="w-14" aria-hidden />
            <div className="flex items-center gap-2">
              {rightItems.slice(0, 1).map(renderItem)}
              <Link to="/profile" aria-label="Perfil"
                className="flex items-center justify-center h-12 w-12 active:scale-90 transition-transform">
                <Avatar className={cn("h-[28px] w-[28px] transition-all",
                  isActive("/profile") && "ring-[1.5px] ring-foreground ring-offset-1 ring-offset-background")}>
                  <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
                  <AvatarFallback className="bg-muted text-[10px] font-semibold">U</AvatarFallback>
                </Avatar>
              </Link>
            </div>
          </div>
        </nav>

        {/* Floating central Create button */}
        <Link
          to="/create"
          aria-label="Criar"
          className="absolute left-1/2 -translate-x-1/2 -top-5 h-14 w-14 rounded-full flex items-center justify-center active:scale-90 transition-transform"
          style={{
            background: 'linear-gradient(180deg, #2d2d6e 0%, #1a1a3e 100%)',
            boxShadow: '0 8px 24px rgba(26,26,62,0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
            border: '3px solid hsl(var(--background))',
          }}
        >
          <Plus className="h-6 w-6 text-white" strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  );
}
