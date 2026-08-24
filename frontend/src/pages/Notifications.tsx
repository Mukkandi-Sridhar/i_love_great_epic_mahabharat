import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Package, CheckCheck, CreditCard, LifeBuoy, Loader2 } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useFirebase } from "@/contexts/FirebaseContext";
import {
  NotificationItem,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "@/services/db";
import { cn } from "@/lib/utils";

const iconFor = (item: NotificationItem) => {
  const haystack = `${item.type || ""} ${item.title || ""}`.toLowerCase();
  if (haystack.includes("payment") || haystack.includes("refund")) return CreditCard;
  if (haystack.includes("order") || haystack.includes("shipped") || haystack.includes("delivered")) return Package;
  if (haystack.includes("ticket") || haystack.includes("support")) return LifeBuoy;
  return Bell;
};

const formatWhen = (createdAt: any) => {
  const date =
    createdAt?.toDate?.() ??
    (typeof createdAt === "number" ? new Date(createdAt) : createdAt ? new Date(createdAt) : null);
  if (!date || Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const Notifications = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useFirebase();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  usePageTitle("Notifications");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToNotifications(
      user.uid,
      (items) => {
        setNotifications(items);
        setError(false);
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user, authLoading]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const handleMarkAll = async () => {
    if (!user || unreadCount === 0) return;
    // Optimistic: the snapshot listener reconciles with the server result.
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    try {
      await markAllNotificationsRead(user.uid, notifications);
    } catch {
      // Listener will restore true state if the write failed.
    }
  };

  const handleOpen = async (item: NotificationItem) => {
    if (!user || !item.id || item.read) return;
    setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    try {
      await markNotificationRead(user.uid, item.id);
    } catch {
      // Listener will restore true state if the write failed.
    }
  };

  const renderBody = () => {
    if (authLoading || loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mb-3" />
          <p className="text-sm">Loading your notifications...</p>
        </div>
      );
    }

    if (!user) {
      return (
        <div className="text-center py-16">
          <Bell className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">Sign in to see notifications</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Order updates and support replies appear here once you're signed in.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Sign in
          </button>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-16">
          <Bell className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">Couldn't load notifications</h3>
          <p className="text-sm text-muted-foreground">Please check your connection and try again.</p>
        </div>
      );
    }

    if (notifications.length === 0) {
      return (
        <div className="text-center py-16">
          <Bell className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">No Notifications</h3>
          <p className="text-sm text-muted-foreground">You're all caught up!</p>
        </div>
      );
    }

    return (
      <ul className="space-y-3">
        {notifications.map((item, index) => {
          const Icon = iconFor(item);
          return (
            <li key={item.id ?? index}>
              <button
                type="button"
                onClick={() => handleOpen(item)}
                className={cn(
                  "w-full text-left flex gap-3 md:gap-4 p-4 md:p-5 rounded-2xl border transition-colors",
                  item.read
                    ? "bg-card/40 border-border hover:bg-card/60"
                    : "bg-primary/[0.06] border-primary/20 hover:bg-primary/[0.1]"
                )}
              >
                <span
                  className={cn(
                    "shrink-0 w-10 h-10 md:w-11 md:h-11 rounded-full grid place-items-center",
                    item.read ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </span>

                <span className="flex-1 min-w-0">
                  <span className="flex items-start justify-between gap-3">
                    <span className={cn("block text-sm md:text-base", item.read ? "font-medium" : "font-semibold")}>
                      {item.title || "Notification"}
                    </span>
                    <span className="shrink-0 text-[11px] md:text-xs text-muted-foreground whitespace-nowrap">
                      {formatWhen(item.createdAt)}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground break-words">{item.message}</span>
                </span>

                {!item.read && <span className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-primary" aria-label="Unread" />}
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 md:px-6 h-14 max-w-3xl mx-auto w-full">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-serif font-semibold flex-1">Notifications</h1>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              className="flex items-center gap-1.5 text-xs md:text-sm font-medium text-primary hover:opacity-80 transition-opacity"
            >
              <CheckCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Mark all read</span>
              <span className="sm:hidden">{unreadCount}</span>
            </button>
          )}
        </div>
      </header>

      <main className="px-4 md:px-6 pt-4 md:pt-6 animate-fade-in max-w-3xl mx-auto w-full">{renderBody()}</main>
    </div>
  );
};

export default Notifications;
