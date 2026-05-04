"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn, LogOut, Clock, CheckCircle, AlertTriangle, Calendar, RefreshCw } from "lucide-react";
import { schoolApi, type TeacherBadge } from "@/lib/school-api";
import { cn, formatDate } from "@/lib/utils";

function formatTime(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function TeacherPointagePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [badges, setBadges] = useState<TeacherBadge[]>([]);
  const [today, setToday] = useState<TeacherBadge | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [myRes, monthRes] = await Promise.all([
      schoolApi.teacherBadges({ date: new Date().toISOString().split("T")[0] }),
      schoolApi.myBadges(),
    ]);
    if (myRes.data?.badges) setToday(myRes.data.badges[0] ?? null);
    if (monthRes.data?.badges) setBadges(monthRes.data.badges);
    setLoading(false);
  };

  useEffect(() => { load(); }, [slug]);

  const showMsg = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleCheckIn = async () => {
    setActionLoading(true);
    const { data, error } = await schoolApi.teacherCheckIn();
    if (error) showMsg("err", error);
    else if (data) { setToday(data.badge); showMsg("ok", "Pointage d'entrée enregistré !"); }
    setActionLoading(false);
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    const { data, error } = await schoolApi.teacherCheckOut();
    if (error) showMsg("err", error);
    else if (data) { setToday(data.badge); showMsg("ok", "Pointage de sortie enregistré !"); }
    setActionLoading(false);
  };

  const now = new Date();
  const todayLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const timeLabel = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-soraDark text-white pb-24">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-blue-500/15">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-xl font-bold font-heading">Mon pointage</h1>
          </div>
          <p className="text-sm text-gray-400 capitalize ml-12">{todayLabel} · {timeLabel}</p>
        </motion.div>

        {msg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className={cn("flex items-center gap-2 p-3 rounded-xl text-sm",
              msg.type === "ok" ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-300" : "bg-red-500/15 border border-red-500/25 text-red-300"
            )}>
            {msg.type === "ok" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {msg.text}
          </motion.div>
        )}

        {/* Today card */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
          <p className="text-sm text-gray-400 font-medium uppercase tracking-wide mb-4">Aujourd'hui</p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <LogIn className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-emerald-400">{formatTime(today?.checkInAt)}</p>
              <p className="text-xs text-gray-500 mt-1">Entrée</p>
              {(today?.lateMinutes ?? 0) > 0 && (
                <p className="text-xs text-amber-400 mt-1">{today!.lateMinutes} min retard</p>
              )}
            </div>
            <div className="text-center p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <LogOut className="w-5 h-5 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-400">{formatTime(today?.checkOutAt)}</p>
              <p className="text-xs text-gray-500 mt-1">Sortie</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCheckIn}
              disabled={actionLoading || !!today?.checkInAt}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all",
                today?.checkInAt
                  ? "bg-gray-700/40 text-gray-500 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              )}
            >
              {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {today?.checkInAt ? "Déjà pointé" : "Pointer l'entrée"}
            </button>
            <button
              onClick={handleCheckOut}
              disabled={actionLoading || !today?.checkInAt || !!today?.checkOutAt}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all",
                !today?.checkInAt || today?.checkOutAt
                  ? "bg-gray-700/40 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              )}
            >
              {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              {today?.checkOutAt ? "Sorti" : "Pointer la sortie"}
            </button>
          </div>
        </motion.div>

        {/* Monthly history */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.07] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-300">Ce mois</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" /><span className="text-sm">Chargement…</span>
            </div>
          ) : badges.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">Aucun pointage ce mois.</div>
          ) : (
            <div className="divide-y divide-white/[0.05] max-h-64 overflow-y-auto">
              {badges.map((badge) => (
                <div key={badge.id} className="flex items-center justify-between px-5 py-2.5">
                  <p className="text-sm text-gray-300">{formatDate(badge.date)}</p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className={cn(badge.checkInAt ? "text-emerald-400" : "text-gray-600")}>
                      ▸ {formatTime(badge.checkInAt)}
                    </span>
                    <span className={cn(badge.checkOutAt ? "text-blue-400" : "text-gray-600")}>
                      ◂ {formatTime(badge.checkOutAt)}
                    </span>
                    {(badge.lateMinutes ?? 0) > 0 && (
                      <span className="text-amber-400">{badge.lateMinutes}min</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}
