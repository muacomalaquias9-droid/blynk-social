// Notification sound management
let notificationAudio: HTMLAudioElement | null = null;

const getNotificationSound = () => {
  if (!notificationAudio) {
    notificationAudio = new Audio('/sounds/notification.mp3');
    notificationAudio.volume = 0.5;
  }
  return notificationAudio;
};

export const playNotificationSound = () => {
  try {
    const audio = getNotificationSound();
    audio.currentTime = 0;
    audio.play().catch(console.error);
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
};

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

interface NotificationData {
  url?: string;
  avatar?: string;
  senderId?: string;
  messageId?: string;
  type?: string;
  storyId?: string;
  callId?: string;
  callType?: string;
  [key: string]: unknown;
}

interface NotificationActionType {
  action: string;
  title: string;
}

interface ExtendedNotificationOptions extends NotificationOptions {
  icon?: string;
  data?: NotificationData;
  actions?: NotificationActionType[];
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  tag?: string;
}

export const showNotification = (title: string, options?: ExtendedNotificationOptions) => {
  if (Notification.permission !== 'granted') return;

  // Play sound first
  playNotificationSound();

  const notificationOptions: ExtendedNotificationOptions = {
    icon: options?.icon || '/logo-192.png',
    badge: '/favicon.png',
    tag: options?.tag || 'blynk-notification',
    requireInteraction: false,
    silent: true, // We handle sound ourselves
    vibrate: [200, 100, 200, 100, 200],
    // WhatsApp-style actions
    actions: options?.actions || [
      { action: 'reply', title: 'Responder' },
      { action: 'view', title: 'Ver' },
    ],
    ...options,
  };

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, notificationOptions);
    });
  } else {
    new Notification(title, notificationOptions);
  }
};

export const showMessageNotification = async (
  senderName: string,
  messageContent: string,
  senderAvatar?: string,
  senderId?: string,
  messageId?: string
) => {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  const preview = messageContent.length > 80 
    ? messageContent.substring(0, 77) + '...' 
    : messageContent;

  showNotification(senderName, {
    body: preview,
    icon: senderAvatar || '/logo-192.png',
    tag: `message-${messageId || Date.now()}`,
    data: {
      url: senderId ? `/chat/${senderId}` : '/messages',
      avatar: senderAvatar,
      senderId,
      messageId,
    },
    actions: [
      { action: 'reply', title: '💬 Responder' },
      { action: 'mark-read', title: '✓ Marcar como lido' },
    ],
  });
};

export const showIncomingCallNotification = async (
  callerName: string,
  callType: 'voice' | 'video',
  callerAvatar?: string,
  callerId?: string,
  callId?: string
) => {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  const query = new URLSearchParams({
    callId: callId || '',
    callType,
    accept: '1',
  }).toString();

  showNotification(callType === 'video' ? 'Chamada de vídeo' : 'Chamada de voz', {
    body: `${callerName} está a ligar para você`,
    icon: callerAvatar || '/logo-192.png',
    tag: `call-${callId || callerId || Date.now()}`,
    requireInteraction: true,
    data: {
      url: callerId ? `/chat/${callerId}?${query}` : '/messages',
      avatar: callerAvatar,
      senderId: callerId,
      callId,
      callType,
      type: 'incoming-call',
    },
    actions: [
      { action: 'accept-call', title: 'Atender' },
      { action: 'view', title: 'Abrir' },
    ],
  });
};

// Setup message listener for quick reply from notification
export const setupNotificationReplyHandler = (callback: (senderId: string, message: string) => void) => {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NOTIFICATION_REPLY') {
      callback(event.data.senderId, event.data.reply);
    }
  });
};
