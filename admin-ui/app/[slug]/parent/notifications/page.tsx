"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Check, CheckCircle, ExternalLink, Info, RefreshCw, AlertTriangle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { schoolApi, type AppNotification } from "@/lib/school-api";
import { cn, formatDate } from "@/lib/utils";

const LEVEL_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  INFO: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  SUCCESS: { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  WARNING: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  DANGER: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

function documentUrlFrom(notification: AppNotification) {
  const value = notification.data?.documentUrl;
  return typeof value === "string" ? value : null;
}

export default function ParentNotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await schoolApi.notifications();
    if (data) {
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    setMarking(true);
    await schoolApi.markNotificationsRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setMarking(false);
  };

  const markOne = async (id: string) => {
    await schoolApi.markNotificationsRead([id]);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative rounded-2xl bg-emerald-500/15 p-3">
            <Bell className="h-5 w-5 text-emerald-300" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-white">Notifications</h1>
            <p className="text-sm text-gray-400">{unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout est lu"}</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-gray-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          >
            {marking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Tout lire
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-white/10 bg-white/[0.03] py-16 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Chargement…
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] py-16 text-center">
          <Bell className="mx-auto mb-3 h-12 w-12 text-gray-700" />
          <p className="font-semibold text-gray-300">Aucune notification</p>
          <p className="mt-1 text-sm text-gray-500">Les factures, reçus et bulletins envoyés par l'école apparaîtront ici.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification, index) => {
            const config = LEVEL_CONFIG[notification.level] ?? LEVEL_CONFIG.INFO;
            const Icon = config.icon;
            const unread = !notification.readAt;
            const documentUrl = documentUrlFrom(notification);
            return (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => unread && void markOne(notification.id)}
                className={cn("rounded-3xl border p-4 transition", unread ? config.bg : "border-white/10 bg-white/[0.03]")}
              >
                <div className="flex gap-3">
                  <div className={cn("mt-0.5 rounded-xl p-2", unread ? "bg-white/10" : "bg-white/[0.05]")}>
                    <Icon className={cn("h-4 w-4", unread ? config.color : "text-gray-500")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={cn("text-sm font-semibold", unread ? "text-white" : "text-gray-300")}>{notification.title}</p>
                        {notification.body && <p className="mt-1 text-sm text-gray-400">{notification.body}</p>}
                      </div>
                      {unread && <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-500">{formatDate(notification.createdAt)}</span>
                      {documentUrl && (
                        <a
                          href={documentUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Ouvrir le document
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
