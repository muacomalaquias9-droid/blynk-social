import { Link, useLocation } from "react-router-dom";
import { Bell, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Logo2026 } from "@/components/Logo2026";

interface Profile {
  avatar_url: string | null;
  username: string;
}

export const TopBar = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [, setFriendRequests] = useState(0);
  const [notifications, setNotifications] = useState(0);
  useLocation();

  useEffect(() => {
    loadProfile();
    loadCounts();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("avatar_url, username")
      .eq("id", user.id)
      .single();

    if (data) setProfile(data);
  };

  const loadCounts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count: msgCount } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("read", false);

    const { count: reqCount } = await supabase
      .from("friend_requests")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("status", "pending");

    const { count: notifCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setUnreadMessages(msgCount || 0);
    setFriendRequests(reqCount || 0);
    setNotifications(notifCount || 0);
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 safe-area-top"
      style={{
        background: 'linear-gradient(180deg, #1a1a3e 0%, #232352 100%)',
        boxShadow: '0 4px 16px rgba(26,26,62,0.25)',
      }}
    >
      <div className="flex items-center justify-between h-14 px-4 max-w-screen-2xl mx-auto">
        <Link to="/feed" className="flex items-center gap-2">
          <Logo2026 size="sm" />
          <span className="text-white font-bold text-xl tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Blynk
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-full text-white hover:bg-white/10 relative">
            <Link to="/notifications" aria-label="Notificações">
              <Bell className="h-5 w-5" />
              {notifications > 0 && (
                <Badge variant="destructive" className="absolute top-1 right-1 h-4 min-w-[16px] px-1 text-[10px] rounded-full">
                  {notifications > 9 ? '9+' : notifications}
                </Badge>
              )}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-full text-white hover:bg-white/10 relative">
            <Link to="/messages" aria-label="Mensagens">
              <MessageSquare className="h-5 w-5" />
              {unreadMessages > 0 && (
                <Badge variant="destructive" className="absolute top-1 right-1 h-4 min-w-[16px] px-1 text-[10px] rounded-full">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </Badge>
              )}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
};