import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { LogOut, Camera, ChevronRight, Lock, User, Smartphone, Eye, Key, FileText, CreditCard, ArrowLeft, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import VerificationBadge from '@/components/VerificationBadge';
import BottomNav from '@/components/BottomNav';
import { useSettings } from '@/contexts/SettingsContext';

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

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();
  const [showLangs, setShowLangs] = useState(false);
  const [profile, setProfile] = useState({
    first_name: '', username: '', avatar_url: '', verified: false, badge_type: null as string | null,
  });

  useEffect(() => { if (user) loadProfile(); }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('first_name, username, avatar_url, verified, badge_type').eq('id', user.id).single();
    if (data) setProfile({ first_name: data.first_name || '', username: data.username || '', avatar_url: data.avatar_url || '', verified: data.verified || false, badge_type: data.badge_type });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !user) return;
    const file = e.target.files[0];
    if (file.size > 52428800) { toast.error('Máximo 50MB'); return; }
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return; }
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;
    try {
      toast('Enviando foto...', { duration: 2000 });
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success('Foto atualizada!');
    } catch { toast.error('Erro ao atualizar foto'); }
  };

  const handleLogout = async () => {
    if (!user) return;
    try {
      const { data: profileData } = await supabase.from('profiles').select('first_name, username, avatar_url, email').eq('id', user.id).single();
      if (profileData) {
        const accounts = JSON.parse(localStorage.getItem('blynk_saved_accounts') || '[]');
        const idx = accounts.findIndex((a: any) => a.userId === user.id);
        const acc = { userId: user.id, email: profileData.email || user.email || '', firstName: profileData.first_name, username: profileData.username, avatarUrl: profileData.avatar_url };
        if (idx >= 0) accounts[idx] = acc; else accounts.push(acc);
        localStorage.setItem('blynk_saved_accounts', JSON.stringify(accounts));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) localStorage.setItem(`blynk_session_${user.id}`, JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }));
      }
    } catch {}
    await supabase.auth.signOut();
    navigate('/');
  };

  const currentLang = allLanguages.find(l => l.code === settings.language) || allLanguages[0];

  const settingsGroups = [
    {
      title: 'Conta',
      items: [
        { label: 'Editar perfil', icon: User, path: '/settings/edit-profile' },
        { label: 'Palavra-passe e segurança', icon: Lock, path: '/settings/change-password' },
        { label: 'Dispositivos', icon: Smartphone, path: '/settings/devices' },
        { label: 'Dados pessoais', icon: FileText, path: '/settings/contact-info' },
        { label: 'Privacidade', icon: Eye, path: '/settings/security' },
      ]
    },
    {
      title: 'Subscrições',
      items: [
        { label: 'Verificação', icon: Key, path: '/verification' },
        { label: 'Blynk Pay', icon: CreditCard, path: '#' },
      ]
    },
  ];

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border/30"
        style={{
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          backgroundColor: 'hsl(var(--background) / 0.8)',
        }}>
        <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold flex-1">Definições</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-lg mx-auto">
          {/* Profile Card */}
          <button onClick={() => navigate('/profile')} className="w-full p-5 flex items-center gap-4 border-b border-border/20 hover:bg-muted/30 transition-colors">
            <div className="relative">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{profile.first_name[0] || 'U'}</AvatarFallback>
              </Avatar>
              <label htmlFor="avatar-upload-settings"
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-lg"
                onClick={(e) => e.stopPropagation()}>
                <Camera className="h-3.5 w-3.5" />
                <Input id="avatar-upload-settings" type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg">{profile.first_name}</span>
                {profile.verified && <VerificationBadge verified={profile.verified} badgeType={profile.badge_type} size="sm" />}
              </div>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground/40" />
          </button>

          {/* Language */}
          <div className="px-4 pt-5 pb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Idioma</p>
            <button onClick={() => setShowLangs(!showLangs)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-muted/20 border border-border/20 hover:bg-muted/40 transition-all">
              <Globe className="h-5 w-5 text-primary" />
              <span className="flex-1 text-left font-medium">{currentLang.flag} {currentLang.name}</span>
              <ChevronRight className={`h-4 w-4 text-muted-foreground/40 transition-transform ${showLangs ? 'rotate-90' : ''}`} />
            </button>
            {showLangs && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl bg-muted/10 border border-border/20 p-1">
                {allLanguages.map(lang => (
                  <button key={lang.code}
                    onClick={() => { updateSettings({ language: lang.code }); setShowLangs(false); toast.success('Idioma alterado'); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
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

          {/* Settings Groups */}
          {settingsGroups.map(group => (
            <div key={group.title} className="px-4 pt-5 pb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.title}</p>
              <div className="rounded-2xl overflow-hidden border border-border/20 bg-muted/10">
                {group.items.map((item, idx) => (
                  <button key={idx} onClick={() => navigate(item.path)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors border-b border-border/10 last:border-b-0">
                    <item.icon className="h-5 w-5 text-muted-foreground/70" />
                    <span className="flex-1 text-left text-[15px] font-medium">{item.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Logout */}
          <div className="px-4 pt-6 pb-4">
            <Button variant="ghost" onClick={handleLogout}
              className="w-full h-12 rounded-2xl text-destructive hover:bg-destructive/10 font-semibold text-base">
              <LogOut className="mr-2 h-5 w-5" /> Terminar sessão
            </Button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground/40 pb-4">Blynk © 2026 · Privacidade · Termos</p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
