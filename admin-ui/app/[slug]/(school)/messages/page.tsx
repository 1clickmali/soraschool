"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Plus, Search } from "lucide-react";
import { schoolApi, type Conversation } from "@/lib/school-api";

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    const { data } = await schoolApi.messages();
    setConversations(data?.conversations || []);
  };

  useEffect(() => { void load(); }, []);

  const ensureGroup = async () => {
    await schoolApi.ensureGeneralConversation();
    void load();
  };

  const filtered = conversations.filter((c) => (c.title || "Conversation privée").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Messagerie</h1>
          <p className="text-gray-400 text-sm mt-1">Messages privés, groupe général et signalements parents.</p>
        </div>
        <button onClick={ensureGroup} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500">
          <Plus className="w-4 h-4" /> Groupe général
        </button>
      </div>
      <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 max-w-md">
        <Search className="w-4 h-4 text-emerald-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une conversation..." className="bg-transparent text-sm text-white outline-none flex-1" />
      </div>
      <div className="space-y-3">
        {filtered.map((conversation) => (
          <div key={conversation.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <p className="text-white font-semibold">{conversation.title || "Conversation privée"}</p>
            <p className="text-sm text-gray-500 mt-1">{conversation.type}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
            <MessageSquare className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-white font-semibold">Aucune conversation</p>
            <p className="text-sm text-gray-500 mt-1">Créez le groupe général pour que tous les utilisateurs échangent.</p>
          </div>
        )}
      </div>
    </div>
  );
}
