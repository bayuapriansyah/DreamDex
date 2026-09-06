import type { MarketState } from "./temporal";

export type NotificationType =
  | "probability-shift"
  | "regime-change"
  | "risk-change"
  | "confidence-change";

export interface SignalNotification {
  id: string;
  followId: string;
  asset: string;
  type: NotificationType;
  title: string;
  detail: string;
  read: boolean;
  timestamp: string;
}

const STORAGE_PREFIX = "dreamdex-notifications";

function walletKey(wallet: string): string {
  return `${STORAGE_PREFIX}:${wallet.slice(0, 10).toLowerCase()}`;
}

function readNotifications(wallet: string): SignalNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(walletKey(wallet));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SignalNotification[];
  } catch {
    return [];
  }
}

function writeNotifications(
  wallet: string,
  notifications: SignalNotification[]
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(walletKey(wallet), JSON.stringify(notifications));
  } catch {
    // storage full or unavailable
  }
}

const DEDUP_WINDOW_MS = 60_000;

function isDuplicate(
  existing: SignalNotification[],
  followId: string,
  type: NotificationType
): boolean {
  const cutoff = Date.now() - DEDUP_WINDOW_MS;
  return existing.some(
    (n) =>
      n.followId === followId &&
      n.type === type &&
      new Date(n.timestamp).getTime() > cutoff
  );
}

export function createNotifications(
  wallet: string,
  followId: string,
  asset: string,
  changes: {
    field: string;
    previous: number | string;
    current: number | string;
    delta: number | null;
    material: boolean;
  }[]
): SignalNotification[] {
  const existing = readNotifications(wallet);
  const newNotifications: SignalNotification[] = [];

  for (const change of changes.filter((c) => c.material)) {
    let type: NotificationType;
    let title: string;
    let detail: string;

    switch (change.field) {
      case "probability": {
        type = "probability-shift";
        const ppDelta = Math.round((change.delta ?? 0) * 100);
        title = `${asset} conviction ${ppDelta > 0 ? "increased" : "decreased"}`;
        detail = `Probability ${ppDelta > 0 ? "+" : ""}${ppDelta}pp`;
        break;
      }
      case "regime":
        type = "regime-change";
        title = `${asset} regime changed`;
        detail = `${change.previous} → ${change.current}`;
        break;
      case "reversalRisk": {
        type = "risk-change";
        const riskDelta = Math.round((change.delta ?? 0) * 100);
        title = `${asset} reversal risk ${riskDelta > 0 ? "increased" : "decreased"}`;
        detail = `Reversal risk ${Math.round((change.previous as number) * 100)}% → ${Math.round((change.current as number) * 100)}%`;
        break;
      }
      case "confidence": {
        type = "confidence-change";
        const confDelta = Math.round((change.delta ?? 0) * 100);
        title = `${asset} confidence ${confDelta > 0 ? "increased" : "decreased"}`;
        detail = `Confidence ${Math.round((change.previous as number) * 100)}% → ${Math.round((change.current as number) * 100)}%`;
        break;
      }
      default:
        continue;
    }

    if (isDuplicate(existing, followId, type)) continue;
    if (isDuplicate(newNotifications, followId, type)) continue;

    const notification: SignalNotification = {
      id: `${followId}-${type}-${Date.now()}`,
      followId,
      asset,
      type,
      title,
      detail,
      read: false,
      timestamp: new Date().toISOString(),
    };

    newNotifications.push(notification);
  }

  if (newNotifications.length > 0) {
    const updated = [...newNotifications, ...existing].slice(0, 100);
    writeNotifications(wallet, updated);
  }

  return newNotifications;
}

export function getNotifications(wallet: string): SignalNotification[] {
  return readNotifications(wallet);
}

export function getUnreadCount(wallet: string): number {
  return readNotifications(wallet).filter((n) => !n.read).length;
}

export function markRead(wallet: string, id: string): void {
  const notifications = readNotifications(wallet);
  const n = notifications.find((n) => n.id === id);
  if (n) {
    n.read = true;
    writeNotifications(wallet, notifications);
  }
}

export function markAllRead(wallet: string): void {
  const notifications = readNotifications(wallet);
  for (const n of notifications) {
    n.read = true;
  }
  writeNotifications(wallet, notifications);
}

export function clearNotifications(wallet: string): void {
  writeNotifications(wallet, []);
}
