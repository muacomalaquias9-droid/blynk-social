import { Link, useLocation } from "react-router-dom";
import { Home, Film, PlusSquare, Search, Sun, Moon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";

export default function BottomNav() {
  const location = useLocation();
  const { settings, updateSettings } = useSettings();
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

  const toggleTheme = () => {
    updateSettings({ theme: isDarkMode ? 'light' : 'dark' });
  };

  const navItems = [
    { to: "/feed", icon: Home, label: "Início" },
    { to: "/videos", icon: Film, label: "Reels" },
    { to: "/create", icon: PlusSquare, label: "Criar" },
    { to: "/friends", icon: Search, label: "Explorar" },
  ];

  const hiddenPaths = ["/auth", "/", "/signup", "/reset-password", "/two-factor-verification", "/blocked"];
  if (hiddenPaths.some(p => location.pathname === p)) return null;
  if (location.pathname.startsWith("/chat/")) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom px-3 pb-2">
      <nav
        className="rounded-[22px] mx-auto max-w-lg overflow-hidden"
        style={{
          background: isDarkMode
            ? 'rgba(28, 28, 30, 0.65)'
            : 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(50px) saturate(200%) brightness(1.05)',
          WebkitBackdropFilter: 'blur(50px) saturate(200%) brightness(1.05)',
          border: isDarkMode
            ? '0.5px solid rgba(255,255,255,0.12)'
            : '0.5px solid rgba(0,0,0,0.06)',
          boxShadow: isDarkMode
            ? '0 8px 32px rgba(0,0,0,0.4), inset 0 0.5px 0 rgba(255,255,255,0.06)'
            : '0 8px 32px rgba(0,0,0,0.08), inset 0 0.5px 0 rgba(255,255,255,0.7)',
        }}
      >
        <div className="flex items-center justify-around h-[54px] px-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center justify-center h-[46px] w-14 rounded-2xl transition-all duration-200 active:scale-90",
                isActive(to) ? "text-foreground" : "text-muted-foreground/70"
              )}
            >
              <Icon
                className="h-[22px] w-[22px]"
                strokeWidth={isActive(to) ? 2.5 : 1.5}
                fill={isActive(to) && to !== "/create" ? "currentColor" : "none"}
              />
              {isActive(to) && (
                <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />
              )}
            </Link>
          ))}

          {/* Theme Toggle - Liquid Glass Pill */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center h-8 w-8 rounded-full transition-all duration-300 active:scale-90"
            style={{
              background: isDarkMode
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.05)',
              border: isDarkMode
                ? '0.5px solid rgba(255,255,255,0.15)'
                : '0.5px solid rgba(0,0,0,0.08)',
            }}
          >
            {isDarkMode ? (
              <Sun className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <Moon className="h-3.5 w-3.5 text-foreground/60" />
            )}
          </button>

          {/* Profile */}
          <Link
            to="/profile"
            className="flex items-center justify-center h-[46px] w-14 active:scale-90 transition-transform"
          >
            <Avatar className={cn(
              "h-[26px] w-[26px] transition-all",
              isActive("/profile") && "ring-[1.5px] ring-foreground ring-offset-1 ring-offset-background"
            )}>
              <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
              <AvatarFallback className="bg-muted text-[10px] font-semibold">U</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </nav>
    </div>
  );
}
