import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  ArrowLeft, Users, FileWarning, Shield, Ban, CheckCircle2, Search,
  Trash2, Eye, AlertTriangle, UserCheck, Clock, Unlock, RefreshCw,
  Heart, UserPlus, Zap
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import VerificationBadge from "@/components/VerificationBadge";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface User {
  id: string;
  username: string;
  full_name: string;
  first_name: string;
  avatar_url: string;
  verified: boolean;
  badge_type: string | null;
  created_at: string;
  email?: string;
}

interface Report {
  id: string;
  reporter_id: string;
  reported_content_id: string;
  content_type: string;
  reason: string;
  status: string;
  created_at: string;
  reporter?: {
    username: string;
    avatar_url: string;
  };
}

interface Suspension {
  id: string;
  user_id: string;
  suspension_type: string;
  reason: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

const PROTECTED_EMAIL = "isaacmuaco582@gmail.com";

export default function Admin() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [suspensions, setSuspensions] = useState<Suspension[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; userId: string; username: string; permanent: boolean }>({ 
    open: false, 
    userId: "", 
    username: "",
    permanent: false
  });
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; userId: string; username: string; type: 'temporary' | 'permanent' }>({
    open: false,
    userId: "",
    username: "",
    type: 'temporary'
  });
  const [stats, setStats] = useState({
    totalUsers: 0,
    verifiedUsers: 0,
    pendingReports: 0,
    blockedAccounts: 0,
    suspendedAccounts: 0
  });

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      toast.error("Acesso negado");
      navigate("/feed");
      return;
    }

    setIsAdmin(true);
    await loadData();
    setLoading(false);
  };

  const loadData = async () => {
    await Promise.all([loadUsers(), loadReports(), loadStats(), loadSuspensions(), loadBlockedUsers()]);
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    
    setUsers(data || []);
  };

  const loadReports = async () => {
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    
    setReports(data || []);
  };

  const loadSuspensions = async () => {
    const { data } = await supabase
      .from("user_suspensions")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    
    setSuspensions(data || []);
  };

  const loadBlockedUsers = async () => {
    const { data } = await supabase
      .from("blocked_accounts")
      .select("*, profiles:user_id(username, avatar_url, first_name)")
      .order("created_at", { ascending: false });
    
    setBlockedUsers(data || []);
  };

  const loadStats = async () => {
    const [usersCount, verifiedCount, reportsCount, blockedCount, suspendedCount] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("verified", true),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("blocked_accounts").select("*", { count: "exact", head: true }),
      supabase.from("user_suspensions").select("*", { count: "exact", head: true }).eq("is_active", true)
    ]);

    setStats({
      totalUsers: usersCount.count || 0,
      verifiedUsers: verifiedCount.count || 0,
      pendingReports: reportsCount.count || 0,
      blockedAccounts: blockedCount.count || 0,
      suspendedAccounts: suspendedCount.count || 0
    });
  };

  const isProtectedUser = async (userId: string) => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    return profileData?.email === PROTECTED_EMAIL;
  };

  const handleVerifyUser = async (userId: string, verify: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ verified: verify, badge_type: verify ? "blue" : null })
      .eq("id", userId);

    if (error) {
      toast.error("Erro ao atualizar verificação");
      return;
    }

    toast.success(verify ? "Usuário verificado!" : "Verificação removida");
    loadUsers();
    loadStats();
  };

  const handleBlockUser = async (userId: string) => {
    if (await isProtectedUser(userId)) {
      toast.error("Esta conta não pode ser bloqueada");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("blocked_accounts")
      .insert({ user_id: userId, blocked_by: user.id, reason: "Bloqueado pelo admin" });

    if (error) {
      toast.error("Erro ao bloquear usuário");
      return;
    }

    toast.success("Usuário bloqueado permanentemente");
    loadData();
  };

  const handleUnblockUser = async (userId: string) => {
    const { error } = await supabase
      .from("blocked_accounts")
      .delete()
      .eq("user_id", userId);

    if (error) {
      toast.error("Erro ao desbloquear usuário");
      return;
    }

    toast.success("Usuário desbloqueado");
    loadData();
  };

  const handleSuspendUser = async (userId: string, type: 'temporary' | 'permanent') => {
    if (await isProtectedUser(userId)) {
      toast.error("Esta conta não pode ser suspensa");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const expiresAt = type === 'temporary' 
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      : null; // Permanent

    const { error } = await supabase
      .from("user_suspensions")
      .insert({
        user_id: userId,
        suspension_type: type,
        reason: type === 'temporary' ? 'Suspensão temporária (24h)' : 'Suspensão permanente',
        expires_at: expiresAt,
        suspended_by: user.id
      });

    if (error) {
      toast.error("Erro ao suspender usuário");
      return;
    }

    toast.success(type === 'temporary' ? "Usuário suspenso por 24h" : "Usuário suspenso permanentemente");
    setSuspendDialog({ open: false, userId: "", username: "", type: 'temporary' });
    loadData();
  };

  const handleUnsuspendUser = async (suspensionId: string) => {
    const { error } = await supabase
      .from("user_suspensions")
      .update({ is_active: false })
      .eq("id", suspensionId);

    if (error) {
      toast.error("Erro ao remover suspensão");
      return;
    }

    toast.success("Suspensão removida");
    loadData();
  };

  const handleDeleteUser = async (userId: string, permanent: boolean) => {
    if (await isProtectedUser(userId)) {
      toast.error("Esta conta não pode ser excluída");
      setDeleteDialog({ open: false, userId: "", username: "", permanent: false });
      return;
    }

    // Delete all related data
    await supabase.from("posts").delete().eq("user_id", userId);
    await supabase.from("stories").delete().eq("user_id", userId);
    await supabase.from("verification_videos").delete().eq("user_id", userId);
    await supabase.from("messages").delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    await supabase.from("comments").delete().eq("user_id", userId);
    await supabase.from("user_suspensions").delete().eq("user_id", userId);
    await supabase.from("blocked_accounts").delete().eq("user_id", userId);
    
    const { error } = await supabase.from("profiles").delete().eq("id", userId);

    if (error) {
      toast.error("Erro ao excluir usuário");
      return;
    }

    toast.success(permanent ? "Usuário excluído permanentemente" : "Usuário excluído");
    setDeleteDialog({ open: false, userId: "", username: "", permanent: false });
    loadData();
  };

  const handleResolveReport = async (reportId: string, action: "resolved" | "dismissed") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("reports")
      .update({ 
        status: action, 
        resolved_by: user.id, 
        resolved_at: new Date().toISOString() 
      })
      .eq("id", reportId);

    if (error) {
      toast.error("Erro ao resolver denúncia");
      return;
    }

    toast.success(action === "resolved" ? "Denúncia resolvida" : "Denúncia ignorada");
    loadReports();
    loadStats();
  };

  const filteredUsers = users.filter(user => 
    user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!isAdmin) return null;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Modern Header */}
        <div className="sticky top-0 z-50 bg-gradient-to-r from-primary via-primary/90 to-accent text-white">
          <div className="flex items-center justify-between px-4 h-16">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-bold text-lg">Painel Admin</h1>
                  <p className="text-xs text-white/70">Gerir plataforma</p>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => loadData()}>
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="pb-20">
          {/* Stats Grid */}
          <div className="px-4 py-6">
            <div className="grid grid-cols-2 gap-3">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{stats.totalUsers}</p>
                      <p className="text-xs text-muted-foreground font-medium">Usuários</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
              
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/25">
                      <UserCheck className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{stats.verifiedUsers}</p>
                      <p className="text-xs text-muted-foreground font-medium">Verificados</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
              
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{stats.suspendedAccounts}</p>
                      <p className="text-xs text-muted-foreground font-medium">Suspensos</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
              
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/25">
                      <Ban className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{stats.blockedAccounts}</p>
                      <p className="text-xs text-muted-foreground font-medium">Bloqueados</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="users" className="w-full px-4">
            <TabsList className="w-full grid grid-cols-5 mb-4 h-12 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="users" className="rounded-lg text-xs data-[state=active]:bg-background">
                <Users className="h-4 w-4 mr-1" />
                Usuários
              </TabsTrigger>
              <TabsTrigger value="boost" className="rounded-lg text-xs data-[state=active]:bg-background">
                <Zap className="h-4 w-4 mr-1" />
                Boost
              </TabsTrigger>
              <TabsTrigger value="reports" className="rounded-lg text-xs data-[state=active]:bg-background relative">
                <FileWarning className="h-4 w-4 mr-1" />
                Denúncias
                {stats.pendingReports > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {stats.pendingReports}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="suspended" className="rounded-lg text-xs data-[state=active]:bg-background">
                <Clock className="h-4 w-4 mr-1" />
                Suspensos
              </TabsTrigger>
              <TabsTrigger value="blocked" className="rounded-lg text-xs data-[state=active]:bg-background">
                <Ban className="h-4 w-4 mr-1" />
                Bloq.
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-3 mt-0">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar usuários..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 rounded-xl bg-muted/50 border-0"
                />
              </div>

              <div className="space-y-2">
                {filteredUsers.map((user, index) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                  >
                    <Card className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar 
                          className="h-12 w-12 cursor-pointer ring-2 ring-border"
                          onClick={() => navigate(`/profile/${user.id}`)}
                        >
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 font-bold">
                            {user.first_name?.[0] || user.username?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold truncate text-sm">
                              {user.full_name || user.first_name || user.username}
                            </span>
                            {user.verified && (
                              <VerificationBadge 
                                verified={user.verified} 
                                badgeType={user.badge_type} 
                                className="h-4 w-4" 
                              />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => navigate(`/profile/${user.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant={user.verified ? "outline" : "default"}
                            size="sm"
                            className="h-8 rounded-full text-xs px-2"
                            onClick={() => handleVerifyUser(user.id, !user.verified)}
                          >
                            {user.verified ? "✗" : "✓"}
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-orange-500 hover:bg-orange-500/10"
                            onClick={() => setSuspendDialog({ open: true, userId: user.id, username: user.username, type: 'temporary' })}
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-red-500 hover:bg-red-500/10"
                            onClick={() => handleBlockUser(user.id)}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteDialog({ open: true, userId: user.id, username: user.username, permanent: true })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="reports" className="space-y-3 mt-0">
              {reports.length === 0 ? (
                <Card className="p-12 text-center">
                  <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                  </div>
                  <p className="text-xl font-bold mb-2">Tudo limpo!</p>
                  <p className="text-muted-foreground">Nenhuma denúncia pendente</p>
                </Card>
              ) : (
                reports.map((report, index) => (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            </div>
                            <Badge variant="outline" className="rounded-full">{report.content_type}</Badge>
                          </div>
                          <p className="text-sm mb-2 font-medium">{report.reason}</p>
                          <p className="text-xs text-muted-foreground">ID: {report.reported_content_id}</p>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => handleResolveReport(report.id, "dismissed")}
                          >
                            Ignorar
                          </Button>
                          <Button
                            size="sm"
                            className="rounded-full"
                            onClick={() => handleResolveReport(report.id, "resolved")}
                          >
                            Resolver
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))
              )}
            </TabsContent>

            <TabsContent value="suspended" className="space-y-3 mt-0">
              {suspensions.length === 0 ? (
                <Card className="p-12 text-center">
                  <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                  </div>
                  <p className="text-xl font-bold mb-2">Nenhuma suspensão ativa</p>
                </Card>
              ) : (
                suspensions.map((suspension, index) => (
                  <motion.div
                    key={suspension.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">ID: {suspension.user_id.slice(0, 8)}...</p>
                          <p className="text-xs text-muted-foreground">{suspension.reason}</p>
                          {suspension.expires_at && (
                            <p className="text-xs text-orange-500">
                              Expira: {new Date(suspension.expires_at).toLocaleString('pt-BR')}
                            </p>
                          )}
                          {!suspension.expires_at && (
                            <Badge variant="destructive" className="mt-1">Permanente</Badge>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => handleUnsuspendUser(suspension.id)}
                        >
                          <Unlock className="h-4 w-4 mr-1" />
                          Remover
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))
              )}
            </TabsContent>

            <TabsContent value="blocked" className="space-y-3 mt-0">
              {blockedUsers.length === 0 ? (
                <Card className="p-12 text-center">
                  <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                  </div>
                  <p className="text-xl font-bold mb-2">Nenhum usuário bloqueado</p>
                </Card>
              ) : (
                blockedUsers.map((blocked, index) => (
                  <motion.div
                    key={blocked.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={blocked.profiles?.avatar_url} />
                            <AvatarFallback>
                              {blocked.profiles?.first_name?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">@{blocked.profiles?.username || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">{blocked.reason}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => handleUnblockUser(blocked.user_id)}
                        >
                          <Unlock className="h-4 w-4 mr-1" />
                          Desbloquear
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir usuário permanentemente</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir @{deleteDialog.username}? 
                Todos os dados serão removidos permanentemente. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => handleDeleteUser(deleteDialog.userId, true)}
                className="bg-destructive hover:bg-destructive/90 rounded-full"
              >
                Excluir Permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Suspend Dialog */}
        <AlertDialog open={suspendDialog.open} onOpenChange={(open) => setSuspendDialog({ ...suspendDialog, open })}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Suspender @{suspendDialog.username}</AlertDialogTitle>
              <AlertDialogDescription>
                Escolha o tipo de suspensão para este usuário.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Select 
                value={suspendDialog.type} 
                onValueChange={(value: 'temporary' | 'permanent') => 
                  setSuspendDialog({ ...suspendDialog, type: value })
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temporary">Temporária (24 horas)</SelectItem>
                  <SelectItem value="permanent">Permanente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => handleSuspendUser(suspendDialog.userId, suspendDialog.type)}
                className="bg-orange-500 hover:bg-orange-600 rounded-full"
              >
                Suspender
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedRoute>
  );
}
