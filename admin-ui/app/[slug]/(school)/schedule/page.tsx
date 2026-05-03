"use client";

import { useEffect, useState } from "react";
import { Calendar, Plus, Search, Trash2 } from "lucide-react";
import { schoolApi, type Classroom, type Subject, type Teacher, type ScheduleSlot } from "@/lib/school-api";

const days = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default function SchedulePage() {
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [search, setSearch] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    classroomId: "",
    teacherId: "",
    subjectId: "",
    room: "",
    dayOfWeek: 1,
    startsAt: "08:00",
    endsAt: "09:00",
  });

  const load = async () => {
    const [scheduleRes, classRes, teacherRes, subjectRes] = await Promise.all([
      schoolApi.schedule({ search, classroomId }),
      schoolApi.classes(),
      schoolApi.teachers(),
      schoolApi.subjects(),
    ]);
    setSlots(scheduleRes.data?.slots || []);
    setClasses(classRes.data?.classes || []);
    setTeachers(teacherRes.data?.teachers || []);
    setSubjects(subjectRes.data?.subjects || []);
  };

  useEffect(() => { void load(); }, [search, classroomId]);

  const create = async () => {
    if (!form.classroomId) { setMessage("Sélectionnez une classe"); return; }
    setSaving(true);
    const { error } = await schoolApi.createScheduleSlot({
      ...form,
      teacherId: form.teacherId || undefined,
      subjectId: form.subjectId || undefined,
      room: form.room || undefined,
    });
    setSaving(false);
    setMessage(error || "Créneau créé");
    if (!error) void load();
  };

  const remove = async (id: string) => {
    await schoolApi.deleteScheduleSlot(id);
    void load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-white">Emploi du temps</h1>
        <p className="text-gray-400 text-sm mt-1">Créneaux par classe, professeur, matière, salle et jour.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
        <div className="lg:col-span-2 flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5">
          <Search className="w-4 h-4 text-emerald-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Recherche..." className="bg-transparent text-white text-sm outline-none flex-1" />
        </div>
        <select value={classroomId} onChange={(e) => setClassroomId(e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-soraCard">
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <select value={form.classroomId} onChange={(e) => setForm({ ...form, classroomId: e.target.value })} className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
            <option value="">Classe</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
            <option value="">Professeur</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
          </select>
          <select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
            <option value="">Matière</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Salle" className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
          <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })} className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
            {days.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
          </select>
          <input type="time" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
          <input type="time" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
          <button onClick={create} disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        </div>
        {message && <p className="text-sm text-gray-300 mt-3">{message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {slots.map((slot) => (
          <div key={slot.id} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white font-semibold">{days[slot.dayOfWeek]} · {slot.startsAt}-{slot.endsAt}</p>
                <p className="text-sm text-emerald-400 mt-1">{slot.classroom?.name || "Classe"}</p>
                <p className="text-sm text-gray-400">{slot.subject?.name || "Matière"} · {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : "Professeur"}</p>
                {slot.room && <p className="text-xs text-gray-500 mt-1">Salle : {slot.room}</p>}
              </div>
              <button onClick={() => remove(slot.id)} className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {slots.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-white/10 p-10 text-center">
            <Calendar className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-white font-semibold">Aucun créneau pour le moment</p>
            <p className="text-sm text-gray-500 mt-1">Ajoutez le premier créneau ci-dessus.</p>
          </div>
        )}
      </div>
    </div>
  );
}
