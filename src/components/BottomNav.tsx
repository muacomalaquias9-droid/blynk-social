import { Link, useLocation } from "react-router-dom";
import { Home, Film, PlusSquare, Search } from "lucide-react";
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
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom px-5 pb-3">
      <nav
        className="rounded-[24px] mx-auto max-w-md overflow-hidden"
        style={{
          background: isDarkMode
            ? 'rgba(18, 18, 20, 0.65)'
            : 'rgba(252, 252, 253, 0.65)',
          backdropFilter: 'blur(50px) saturate(200%)',
          WebkitBackdropFilter: 'blur(50px) saturate(200%)',
          border: isDarkMode
            ? '0.5px solid rgba(255,255,255,0.1)'
            : '0.5px solid rgba(0,0,0,0.06)',
          boxShadow: isDarkMode
            ? '0 8px 32px rgba(0,0,0,0.5), inset 0 0.5px 0 rgba(255,255,255,0.06)'
            : '0 8px 32px rgba(0,0,0,0.08), inset 0 0.5px 0 rgba(255,255,255,0.8)',
        }}
      >
        <div className="flex items-center justify-around h-[54px] px-2">
          {navItems.map(({ to, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link key={to} to={to}
                className={cn(
                  "flex items-center justify-center h-10 w-10 rounded-2xl transition-all duration-200 active:scale-90",
                  active ? "bg-foreground/8" : ""
                )}>
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.5}
                  fill={active && to !== "/create" ? "currentColor" : "none"}
                  style={{ color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground) / 0.5)' }} />
              </Link>
            );
          })}
          <Link to="/profile" className="flex items-center justify-center h-10 w-10 active:scale-90 transition-transform">
            <Avatar className={cn("h-[26px] w-[26px] transition-all",
              isActive("/profile") && "ring-[1.5px] ring-foreground ring-offset-1 ring-offset-background")}>
              <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
              <AvatarFallback className="bg-muted text-[10px] font-semibold">U</AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </nav>
    </div>
  );
}
