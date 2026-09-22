"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Zap,
  Clock,
  X,
} from "lucide-react";

interface Notification {
  id: string;
  userId: string;
  organizationId: string | null;
  type: string;
  priority: string;
  title: string;
  message: string | null;
  resourceType: string | null;
  resourceId: string | null;
  resourceName: string | null;
  actionUrl: string | null;
  status: string;
  readAt: string | null;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  success: { icon: Check, color: "var(--status-active)", bg: "var(--status-active-bg)" },
  error: { icon: AlertTriangle, color: "var(--status-error)", bg: "var(--status-error-bg)" },
  warning: { icon: AlertCircle, color: "var(--status-idle)", bg: "var(--status-idle-bg)" },
  info: { icon: Info, color: "var(--status-info)", bg: "var(--status-info-bg)" },
  activity: { icon: Zap, color: "var(--accent)", bg: "var(--accent-soft)" },
  system: { icon: Clock, color: "var(--text-secondary)", bg: "var(--bg-inset)" },
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async (showLoading = false) => {
    if (fetching) return;
    setFetching(true);
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=50");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [fetching]);

  // Fetch unread count only (lightweight)
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch when panel opens
  useEffect(() => {
    if (open) {
      fetchNotifications(true);
    }
  }, [open]);

  // Poll for unread count every 30 seconds when panel is closed
  useEffect(() => {
    const interval = setInterval(() => {
      if (!open) {
        fetchUnreadCount();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [open, fetchUnreadCount]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  // Mark notification as read and optionally navigate
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (notification.status === "unread") {
      try {
        await fetch(`/api/notifications/${notification.id}/read`, { method: "PATCH" });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, status: "read", readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // ignore
      }
    }

    // Navigate if there's an action URL
    if (notification.actionUrl) {
      onClose();
      router.push(notification.actionUrl);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications/mark-all-read", { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.status === "unread" ? { ...n, status: "read", readAt: new Date().toISOString() } : n))
      );
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-[380px] max-h-[520px] rounded-xl z-50 overflow-hidden animate-dropdown-enter flex flex-col"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Notifications
          </h3>
          {unreadCount > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--accent)" }}
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border-default)", borderTopColor: "var(--accent)" }} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Bell className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
              You&apos;re all caught up
            </p>
            <p className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>
              No new notifications
            </p>
          </div>
        ) : (
          notifications.map((notification) => {
            const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info;
            const Icon = config.icon;
            const isUnread = notification.status === "unread";

            return (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className="w-full text-left px-4 py-3 border-b transition-colors hover:bg-[var(--bg-hover)]"
                style={{
                  borderColor: "var(--border-default)",
                  backgroundColor: isUnread ? "var(--bg-inset)" : "transparent",
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: config.bg }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: "var(--accent)" }}
                        />
                      )}
                      <p
                        className="text-[13px] truncate"
                        style={{
                          color: "var(--text-primary)",
                          fontWeight: isUnread ? 600 : 400,
                        }}
                      >
                        {notification.title}
                      </p>
                    </div>
                    {notification.message && (
                      <p
                        className="text-[12px] truncate mt-0.5"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {notification.message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {notification.resourceName && (
                        <span
                          className="text-[11px] font-mono truncate"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {notification.resourceName}
                        </span>
                      )}
                      <span
                        className="text-[11px] flex-shrink-0"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {timeAgo(notification.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * NotificationBell — the bell icon with unread badge for the Topbar.
 * Polls for unread count and manages the panel open state.
 */
export function NotificationBell() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const bellRef = useRef<HTMLDivElement>(null);

  // Fetch unread count on mount and every 30 seconds
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Also refresh unread count when panel closes (in case user marked some as read)
  const handlePanelClose = useCallback(() => {
    setPanelOpen(false);
    // Small delay to let state settle
    setTimeout(fetchUnreadCount, 500);
  }, [fetchUnreadCount]);

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="relative p-2 rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
        style={{ color: "var(--text-secondary)" }}
        data-tooltip="Notifications"
      >
        <Bell className="w-[16px] h-[16px]" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold px-1"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-foreground)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      <NotificationPanel open={panelOpen} onClose={handlePanelClose} />
    </div>
  );
}
