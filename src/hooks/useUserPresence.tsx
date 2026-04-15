import { useOnlineUsers } from './useOnlineUsers';

export const useUserPresence = (userId?: string) => {
  const onlineUsers = useOnlineUsers();
  const isOnline = userId ? onlineUsers.has(userId) : false;

  return { isOnline, onlineUsers };
};
