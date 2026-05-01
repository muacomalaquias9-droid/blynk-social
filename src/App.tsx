import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ActiveProfileProvider } from "@/contexts/ActiveProfileContext";
import { useStoryReactions } from "@/hooks/useStoryReactions";
import { useGlobalUserPresence } from "@/hooks/useGlobalUserPresence";
import { MessageNotification } from "@/components/MessageNotification";
// FreeDataBanner removed - no longer showing "Sistema Grátis"
import Auth from "./pages/Auth";
import SavedAccounts from "./pages/SavedAccounts";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import TwoFactorVerification from "./pages/TwoFactorVerification";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import ChatSettings from "./pages/ChatSettings";
import GroupChat from "./pages/GroupChat";
import Groups from "./pages/Groups";
import GroupSettings from "./pages/GroupSettings";
import Channels from "./pages/Channels";
import ChannelView from "./pages/ChannelView";
import CreateChannel from "./pages/CreateChannel";
import CreatePageProfile from "./pages/CreatePageProfile";
import ChannelInvites from "./pages/ChannelInvites";
import Stories from "./pages/Stories";
import Friends from "./pages/Friends";
import Settings from "./pages/Settings";
import ChangePassword from "./pages/settings/ChangePassword";
import ContactInfo from "./pages/settings/ContactInfo";
import Security from "./pages/settings/Security";
import DeviceSecurity from "./pages/settings/DeviceSecurity";
import EditProfile from "./pages/settings/EditProfile";
import Profile from "./pages/Profile";
import Feed from "./pages/Feed";
import Create from "./pages/Create";
import Comments from "./pages/Comments";
// CommentsVideo removed - using unified Comments page
import Videos from "./pages/Videos";
import RequestVerification from "./pages/RequestVerification";
import Report from './pages/Report';
import SavedPosts from './pages/SavedPosts';
import PostDetail from './pages/PostDetail';
import Notifications from './pages/Notifications';
import InstallPWA from './pages/InstallPWA';
import Hashtag from './pages/Hashtag';
import CreateAd from "./pages/CreateAd";
import AppSettings from "./pages/AppSettings";
import ProfessionalPanel from "./pages/ProfessionalPanel";
import NotFound from "./pages/NotFound";
import Blocked from "./pages/Blocked";
import Help from "./pages/Help";
import Terms from "./pages/Terms";
import Admin from "./pages/Admin";
import PostLikes from "./pages/PostLikes";
import OnlineFriends from "./pages/OnlineFriends";
import VideoEditor from "./pages/VideoEditor";
import CTF from "./pages/CTF";
import SidebarPage from "./pages/SidebarPage";
import VerificationCheckout from "./pages/VerificationCheckout";
import AdminVerification from "./pages/AdminVerification";
import Monetization from "./pages/Monetization";
import ApiKeys from "./pages/ApiKeys";
import ApiDocs from "./pages/ApiDocs";
import ApiStatus from "./pages/ApiStatus";
import { requestNotificationPermission } from "./utils/pushNotifications";
import IncomingCallNotification from "@/components/call/IncomingCallNotification";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, session } = useAuth();
  
  // CRITICAL: Wait for auth to fully initialize before checking user/session
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl font-bold animate-pulse">Blynk</div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }
  
  // Only redirect if auth is loaded and there's no valid session
  if (!loading && (!user || !session)) {
    return <Navigate to="/auth" replace />;
  }

  // Request notification permission for logged in users
  if (user) {
    requestNotificationPermission();
  }
  
  return <>{children}</>;
};

const AppContent = () => {
  useStoryReactions();
  useGlobalUserPresence();
  return (
    <>
      {/* FreeDataBanner removed */}
      <IncomingCallNotification />
      <MessageNotification />
      <Routes>
        <Route path="/" element={<SavedAccounts />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/two-factor-verification" element={<TwoFactorVerification />} />
        <Route path="/blocked" element={<Blocked />} />
        
        <Route
          path="/feed"
          element={
            <ProtectedRoute>
              <Feed />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create"
          element={
            <ProtectedRoute>
              <Create />
            </ProtectedRoute>
          }
        />
        <Route
          path="/videos"
          element={
            <ProtectedRoute>
              <Videos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/videos/:shareCode"
          element={
            <ProtectedRoute>
              <Videos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/comments/:postId"
          element={
            <ProtectedRoute>
              <Comments />
            </ProtectedRoute>
          }
        />
        {/* CommentsVideo route redirects to unified Comments page */}
        <Route
          path="/comments-video/:videoId"
          element={
            <ProtectedRoute>
              <Comments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/verification"
          element={
            <ProtectedRoute>
              <RequestVerification />
            </ProtectedRoute>
          }
        />
        
        {/* Messages Routes */}
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:friendId"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:friendId/settings"
          element={
            <ProtectedRoute>
              <ChatSettings />
            </ProtectedRoute>
          }
        />
        
        {/* Groups Routes */}
        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <Groups />
            </ProtectedRoute>
          }
        />
        <Route
          path="/group/:groupId"
          element={
            <ProtectedRoute>
              <GroupChat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/group/:groupId/settings"
          element={
            <ProtectedRoute>
              <GroupSettings />
            </ProtectedRoute>
          }
        />
        
        {/* Channels Routes */}
        <Route
          path="/channels"
          element={
            <ProtectedRoute>
              <Channels />
            </ProtectedRoute>
          }
        />
        <Route
          path="/channels/:channelId"
          element={
            <ProtectedRoute>
              <ChannelView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/channels/:channelId/invites"
          element={
            <ProtectedRoute>
              <ChannelInvites />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-channel"
          element={
            <ProtectedRoute>
              <CreateChannel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-page-profile"
          element={
            <ProtectedRoute>
              <CreatePageProfile />
            </ProtectedRoute>
          }
        />
        
        {/* Stories Routes */}
        <Route
          path="/stories"
          element={
            <ProtectedRoute>
              <Stories />
            </ProtectedRoute>
          }
        />
        
        {/* Friends Routes */}
        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <Friends />
            </ProtectedRoute>
          }
        />
        
        {/* Profile Routes */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/perfil/:username"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        
        {/* Settings Routes */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/contact-info"
          element={
            <ProtectedRoute>
              <ContactInfo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/security"
          element={
            <ProtectedRoute>
              <Security />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/devices"
          element={
            <ProtectedRoute>
              <DeviceSecurity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/edit-profile"
          element={
            <ProtectedRoute>
              <EditProfile />
            </ProtectedRoute>
          }
        />
        
        {/* Report Route */}
        <Route
          path="/report"
          element={
            <ProtectedRoute>
              <Report />
            </ProtectedRoute>
          }
        />
        <Route
          path="/denunciar/:type/:id"
          element={
            <ProtectedRoute>
              <Report />
            </ProtectedRoute>
          }
        />
        
        {/* Saved Posts Route */}
        <Route
          path="/saved"
          element={
            <ProtectedRoute>
              <SavedPosts />
            </ProtectedRoute>
          }
        />
        
        {/* Post Detail Route */}
        <Route
          path="/post/:postId"
          element={
            <ProtectedRoute>
              <PostDetail />
            </ProtectedRoute>
          }
        />
        
        {/* Notifications Route */}
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        
        {/* Install PWA Route */}
        <Route path="/install" element={<InstallPWA />} />
        
        {/* Hashtag Route */}
        <Route
          path="/hashtag/:name"
          element={
            <ProtectedRoute>
              <Hashtag />
            </ProtectedRoute>
          }
        />
        
        {/* Create Ad Route */}
        <Route
          path="/create-ad"
          element={
            <ProtectedRoute>
              <CreateAd />
            </ProtectedRoute>
          }
        />
        
        {/* App Settings Route */}
        <Route
          path="/app-settings"
          element={
            <ProtectedRoute>
              <AppSettings />
            </ProtectedRoute>
          }
        />
        
        {/* Professional Panel Route */}
        <Route
          path="/professional-panel"
          element={
            <ProtectedRoute>
              <ProfessionalPanel />
            </ProtectedRoute>
          }
        />
        
        {/* Help Route */}
        <Route
          path="/help"
          element={
            <ProtectedRoute>
              <Help />
            </ProtectedRoute>
          }
        />
        
        {/* Terms Route */}
        <Route
          path="/terms"
          element={
            <ProtectedRoute>
              <Terms />
            </ProtectedRoute>
          }
        />
        
        {/* Admin Route */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />
        
        {/* Post Likes Route */}
        <Route
          path="/post/:postId/likes"
          element={
            <ProtectedRoute>
              <PostLikes />
            </ProtectedRoute>
          }
        />
        
        {/* Online Friends Route */}
        <Route
          path="/online-friends"
          element={
            <ProtectedRoute>
              <OnlineFriends />
            </ProtectedRoute>
          }
        />
        
        {/* Video Editor Route */}
        <Route
          path="/video-editor"
          element={
            <ProtectedRoute>
              <VideoEditor />
            </ProtectedRoute>
          }
        />
        
        {/* CTF Hacking Route */}
        <Route
          path="/ctf-hacking"
          element={
            <ProtectedRoute>
              <CTF />
            </ProtectedRoute>
          }
        />
        
        {/* Sidebar Page Route */}
        <Route
          path="/sidebar"
          element={
            <ProtectedRoute>
              <SidebarPage />
            </ProtectedRoute>
          }
        />
        
        {/* Verification Checkout */}
        <Route
          path="/verification-checkout"
          element={
            <ProtectedRoute>
              <VerificationCheckout />
            </ProtectedRoute>
          }
        />
        
        {/* Admin Verification Payments */}
        <Route
          path="/admin/verification"
          element={
            <ProtectedRoute>
              <AdminVerification />
            </ProtectedRoute>
          }
        />
        
        {/* Monetization */}
        <Route
          path="/monetization"
          element={
            <ProtectedRoute>
              <Monetization />
            </ProtectedRoute>
          }
        />

        {/* API Keys (admin only) */}
        <Route
          path="/api-keys"
          element={
            <ProtectedRoute>
              <ApiKeys />
            </ProtectedRoute>
          }
        />

        {/* API Documentation (public) */}
        <Route path="/docs" element={<ApiDocs />} />
        <Route path="/api-docs" element={<ApiDocs />} />
        <Route
          path="/api-status"
          element={
            <ProtectedRoute>
              <ApiStatus />
            </ProtectedRoute>
          }
        />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ActiveProfileProvider>
            <SettingsProvider>
              <AppContent />
            </SettingsProvider>
          </ActiveProfileProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
