"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, MapPin, Search } from "lucide-react";
import { schoolApi, type ScheduleSlot } from "@/lib/school-api";
import { cn } from "@/lib/utils";

const days = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default function TeacherSchedulePage() {
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [day, setDay] = useState("");

  useEffect(() => {
    setLoading(true);
    schoolApi.schedule({
      search,
      dayOfWeek: day ? Number(day) : undefined,
    }).then(({ data }) => {
      setSlots(data?.slots || []);
      setLoading(false);
    });
  }, [search, day]);

  const grouped = useMemo(() => {
    return days.slice(1).map((label, index) => ({
      dayOfWeek: index + 1,
      label,
      slots: slots.filter((slot) => slot.dayOfWeek === index + 1),
    })).filter((group) => !day || group.dayOfWeek === Number(day));
  }, [slots, day]);

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold font-heading text-white">Mon emploi du temps</h1>
        <p className="text-gray-400 text-sm mt-1">
          {loading ? "Chargement..." : `${slots.length} créneau${slots.length !== 1 ? "x" : ""} assigné${slots.length !== 1 ? "s" : ""}`}
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher classe, matière, salle..."
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500/50 transition-all"
          />
        </div>
        <select value={day} onChange={(e) => setDay(e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-soraCard focus:border-emerald-500/50 transition-all min-w-[170px]">
          <option value="">Toute la semaine</option>
          {days.slice(1).map((label, index) => (
            <option key={label} value={index + 1}>{label}</option>
          ))}
        </select>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-32 rounded-2xl bg-white/[0.04] border border-white/[0.07] animate-pulse" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Calendar className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-white font-semibold">Aucun créneau assigné</p>
          <p className="text-sm text-gray-500 mt-1">Votre administration pourra compléter votre planning.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <section key={group.dayOfWeek} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-300">{group.label}</h2>
                <span className="text-xs text-gray-500">{group.slots.length} cours</span>
              </div>
              {group.slots.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-500">Aucun cours ce jour.</p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {group.slots.map((slot) => (
                    <div key={slot.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-5 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-2 text-white font-semibold min-w-[130px]">
                        <Clock className="w-4 h-4 text-emerald-500" />
                        {slot.startsAt} - {slot.endsAt}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{slot.subject?.name || "Matière non définie"}</p>
                        <p className="text-xs text-gray-500 truncate">{slot.classroom?.name || "Classe non définie"}</p>
                      </div>
                      <div className={cn("inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border", slot.room ? "text-amber-300 bg-amber-500/10 border-amber-500/20" : "text-gray-500 bg-white/[0.03] border-white/10")}>
                        <MapPin className="w-3.5 h-3.5" />
                        {slot.room || "Salle à confirmer"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
