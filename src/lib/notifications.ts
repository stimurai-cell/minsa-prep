import { supabase } from './supabase';

export type AppNotificationRecord = {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  type: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
};

export type HydratedNotification = AppNotificationRecord & {
  is_global: boolean;
  can_delete: boolean;
};

const notificationSelect = 'id, user_id, title, body, type, link, is_read, created_at';
const buildLocalReadKey = (userId: string) => `minsa-prep-notification-reads:${userId}`;

const readLocalReadIds = (userId: string) => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(buildLocalReadKey(userId)) || '[]'));
  } catch {
    return new Set<string>();
  }
};

const persistLocalReadIds = (userId: string, readIds: Set<string>) => {
  localStorage.setItem(buildLocalReadKey(userId), JSON.stringify(Array.from(readIds)));
};

const normalizeNotificationRows = (rows: AppNotificationRecord[], readIds: Set<string>, userId: string) =>
  rows.map((notification) => {
    const hasReceipt = readIds.has(notification.id);
    const isOwnNotification = notification.user_id === userId;
    const isRead = isOwnNotification ? Boolean(notification.is_read || hasReceipt) : hasReceipt;

    return {
      ...notification,
      is_read: isRead,
      is_global: notification.user_id === null,
      can_delete: isOwnNotification,
    };
  });

async function loadRemoteReadIds(userId: string, notificationIds: string[]) {
  if (!notificationIds.length) {
    return new Set<string>();
  }

  try {
    const { data, error } = await supabase
      .from('notification_reads')
      .select('notification_id')
      .eq('user_id', userId)
      .in('notification_id', notificationIds);

    if (error) {
      throw error;
    }

    return new Set((data || []).map((row: any) => String(row.notification_id)));
  } catch (error: any) {
    const code = String(error?.code || '');
    const message = String(error?.message || '').toLowerCase();
    if (code === 'PGRST205' || code === '42P01' || message.includes('notification_reads')) {
      return new Set<string>();
    }
    throw error;
  }
}

export async function fetchHydratedNotifications(userId: string, limit = 100): Promise<HydratedNotification[]> {
  const { data: notifications, error } = await supabase
    .from('user_notifications')
    .select(notificationSelect)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows = (notifications || []) as AppNotificationRecord[];
  const notificationIds = rows.map((item) => item.id);
  const readIds = readLocalReadIds(userId);
  const remoteReadIds = await loadRemoteReadIds(userId, notificationIds);

  remoteReadIds.forEach((id) => readIds.add(id));
  persistLocalReadIds(userId, readIds);

  return normalizeNotificationRows(rows, readIds, userId);
}

export async function markNotificationsAsRead(userId: string, notifications: Array<Pick<HydratedNotification, 'id' | 'user_id' | 'is_read'>>) {
  const unreadItems = notifications.filter((notification) => !notification.is_read);
  if (!unreadItems.length) {
    return;
  }

  const localReadIds = readLocalReadIds(userId);
  unreadItems.forEach((notification) => localReadIds.add(notification.id));
  persistLocalReadIds(userId, localReadIds);

  try {
    const readPayload = unreadItems.map((notification) => ({
      user_id: userId,
      notification_id: notification.id,
      read_at: new Date().toISOString(),
    }));

    const { error: readError } = await supabase
      .from('notification_reads')
      .upsert(readPayload, { onConflict: 'user_id,notification_id' });

    if (readError) {
      throw readError;
    }
  } catch (error: any) {
    const code = String(error?.code || '');
    const message = String(error?.message || '').toLowerCase();
    if (!(code === 'PGRST205' || code === '42P01' || message.includes('notification_reads'))) {
      throw error;
    }
  }

  const ownUnreadIds = unreadItems
    .filter((notification) => notification.user_id === userId)
    .map((notification) => notification.id);

  if (!ownUnreadIds.length) {
    return;
  }

  const { error: ownError } = await supabase
    .from('user_notifications')
    .update({ is_read: true })
    .in('id', ownUnreadIds);

  if (ownError) {
    throw ownError;
  }
}

export async function markNotificationAsRead(userId: string, notification: Pick<HydratedNotification, 'id' | 'user_id' | 'is_read'>) {
  return markNotificationsAsRead(userId, [notification]);
}

export async function getUnreadNotificationCount(userId: string) {
  const notifications = await fetchHydratedNotifications(userId, 100);
  return notifications.filter((notification) => !notification.is_read).length;
}

export async function deleteOwnNotification(userId: string, notificationId: string) {
  const { error } = await supabase
    .from('user_notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}
