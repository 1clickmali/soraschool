"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  AlertCircle,
  RefreshCw,
  Check,
} from "lucide-react";
import { schoolApi, type AppNotification } from "@/lib/school-api";
import { cn, formatDate } from "@/lib/utils";

const LEVEL_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  INFO: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  SUCCESS: { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  WARNING: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  DANGER: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

export default function NotificationsPage() {
  const params = useParams();
  const slug = params.slug as string;
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
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString() } : n)
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  return (
    <div className="min-h-screen bg-soraDark text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/15 relative">
              <Bell className="w-5 h-5 text-blue-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold font-heading">Notifications</h1>
              <p className="text-sm text-gray-400">{unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout lu"}</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={marking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-gray-300 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> Tout marquer lu
            </button>
          )}
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement…</span>
          </div>
        ) : notifications.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-700" />
            <p className="text-gray-400 font-medium">Aucune notification</p>
            <p className="text-gray-600 text-sm mt-1">Vous êtes à jour.</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif, i) => {
              const cfg = LEVEL_CONFIG[notif.level] ?? LEVEL_CONFIG.INFO;
              const Icon = cfg.icon;
              const isUnread = !notif.readAt;
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn(
                    "relative flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer",
                    isUnread ? `${cfg.bg} border-opacity-60` : "bg-white/[0.02] border-white/[0.06]",
                    "hover:bg-white/[0.04]"
                  )}
                  onClick={() => isUnread && markOne(notif.id)}
                >
                  <div className={cn("p-1.5 rounded-lg mt-0.5 shrink-0", isUnread ? "bg-white/10" : "bg-white/[0.04]")}>
                    <Icon className={cn("w-4 h-4", isUnread ? cfg.color : "text-gray-500")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-semibold", isUnread ? "text-white" : "text-gray-400")}>{notif.title}</p>
                    {notif.body && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{notif.body}</p>}
                    <p className="text-xs text-gray-600 mt-1">{formatDate(notif.createdAt)}</p>
                  </div>
                  {isUnread && (
                    <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
