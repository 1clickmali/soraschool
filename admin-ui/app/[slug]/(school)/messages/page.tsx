"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, MessageSquare, Plus, Send, Shield, Users, User, RefreshCw } from "lucide-react";
import { schoolApi, schoolApiRequest, schoolAuthApi, type Conversation, type SchoolUser } from "@/lib/school-api";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";

interface Message {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  senderName?: string;
  senderRole?: string;
}

interface ConvWithMessages extends Conversation {
  localMessages?: Message[];
}

const TYPE_LABELS: Record<string, string> = {
  GROUP:   "Groupe",
  PRIVATE: "Privée",
  SUPPORT: "Signalement parent",
};

const TYPE_COLORS: Record<string, string> = {
  GROUP:   "bg-blue-500/15 text-blue-300 border-blue-500/25",
  PRIVATE: "bg-gray-500/15 text-gray-400 border-gray-500/25",
  SUPPORT: "bg-orange-500/15 text-orange-300 border-orange-500/25",
};

function timeAgo(v?: string) {
  if (!v) return "";
  const m = Math.floor((Date.now() - new Date(v).getTime()) / 60000);
  if (m < 1)  return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

function roleLabel(role?: string) {
  const labels: Record<string, string> = {
    DIRECTOR: "Directeur",
    ADMINISTRATION: "Administration",
    SECRETARIAT: "Secrétariat",
    TEACHER: "Professeur",
    PARENT: "Parent",
    ACCOUNTANT: "Comptable",
  };
  return role ? (labels[role] ?? role) : "";
}

export default function MessagesPage() {
  const [me, setMe]           = useState<SchoolUser | null>(null);
  const [convs, setConvs]     = useState<ConvWithMessages[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText]       = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const [meRes, convsRes] = await Promise.all([
      schoolAuthApi.me(),
      schoolApi.messages(),
    ]);
    if (meRes.data) setMe(meRes.data);
    if (convsRes.data?.conversations)
      setConvs(convsRes.data.conversations.map((c) => ({ ...c, localMessages: [] })));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const selectedConv = convs.find((c) => c.id === selectedId);

  useEffect(() => {
    if (!selectedId) return;
    schoolApiRequest<{ messages: Array<{ id: string; body: string; createdAt: string; senderId?: string; sender?: { id: string; firstName?: string; lastName?: string; role?: string } }> }>(
      `/api/messages/conversations/${selectedId}/messages`
    ).then(({ data }) => {
      if (!data?.messages) return;
      setConvs((prev) =>
        prev.map((c) =>
          c.id !== selectedId ? c : {
            ...c,
            localMessages: data.messages.map((m) => ({
              id:         m.id,
              body:       m.body,
              createdAt:  m.createdAt,
              mine:       m.senderId === me?.id || m.sender?.id === me?.id,
              senderName: m.sender ? `${m.sender.firstName ?? ""} ${m.sender.lastName ?? ""}`.trim() : undefined,
              senderRole: m.sender?.role,
            })),
          }
        )
      );
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
  }, [selectedId, me?.id]);

  const msgs = (c?: ConvWithMessages): Message[] => {
    if (!c) return [];
    if (c.localMessages?.length) return c.localMessages;
    return (c.messages || []).map((m, i) => ({
      id:        String(i),
      body:      m.body,
      createdAt: m.createdAt,
      mine:      false,
    }));
  };

  const handleSend = async () => {
    if (!text.trim() || !selectedId || sending) return;
    const body = text.trim();
    setSending(true);
    setText("");

    const temp: Message = { id: String(Date.now()), body, createdAt: new Date().toISOString(), mine: true };
    setConvs((prev) =>
      prev.map((c) => c.id === selectedId ? { ...c, localMessages: [...(c.localMessages || []), temp] } : c)
    );
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    await schoolApiRequest(`/api/messages/conversations/${selectedId}/messages`, {
      method: "POST",
      body:   { body },
    });
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const createGeneral = async () => {
    const { data } = await schoolApi.ensureGeneralConversation();
    if (data?.conversation) {
      setConvs((prev) => [{ ...data.conversation!, localMessages: [] }, ...prev.filter((c) => c.id !== data.conversation!.id)]);
      setSelectedId(data.conversation.id);
    }
  };

  const startPrivate = async () => {
    if (!newPhone.trim()) return;
    const { data } = await schoolApiRequest<{ conversation?: Conversation }>("/api/messages/conversations/private", {
      method: "POST",
      body:   { phone: newPhone.trim() },
    });
    if (data?.conversation) {
      setConvs((prev) => [{ ...data.conversation!, localMessages: [] }, ...prev]);
      setSelectedId(data.conversation.id);
    }
    setNewPhone("");
    setModal(false);
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex flex-wrap items-start justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Messagerie</h1>
          <p className="text-gray-400 text-sm mt-1">
            Messages internes, groupe général et signalements parents.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={createGeneral}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-all"
          >
            <Users className="w-4 h-4" />
            Groupe général
          </button>
          <button
            onClick={() => setModal(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nouveau message
          </button>
          <button
            onClick={load}
            className="p-2 rounded-xl border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white transition-all"
            title="Actualiser"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex h-[calc(100vh-230px)] min-h-[520px] bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden"
      >
        {/* ── Liste conversations ── */}
        <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">Conversations</span>
            <span className="ml-auto text-xs text-gray-600">{convs.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 bg-white/[0.04] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : convs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 p-6 text-center">
                <MessageSquare className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-xs">Aucune conversation</p>
                <p className="text-xs mt-1">Créez le groupe général ou démarrez un message privé.</p>
              </div>
            ) : (
              convs.map((c) => {
                const list   = msgs(c);
                const last   = list[list.length - 1];
                const active = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left border-b border-white/[0.03]",
                      active && "bg-emerald-500/10"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white",
                      c.type === "GROUP"   && "bg-gradient-to-br from-blue-600 to-blue-800",
                      c.type === "PRIVATE" && "bg-gradient-to-br from-gray-600 to-gray-800",
                      c.type === "SUPPORT" && "bg-gradient-to-br from-orange-600 to-red-700",
                    )}>
                      {c.type === "GROUP"   && <Users className="w-4 h-4" />}
                      {c.type === "PRIVATE" && <User  className="w-4 h-4" />}
                      {c.type === "SUPPORT" && <AlertTriangle className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {c.title || `Conversation ${c.id.slice(0, 6)}`}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {last?.body || "Aucun message"}
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-600 flex-shrink-0 mt-0.5">
                      {timeAgo(last?.createdAt || c.updatedAt)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Panneau messages ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
              <Shield className="w-14 h-14 mb-3 opacity-15" />
              <p className="text-sm">Sélectionnez une conversation</p>
              <p className="text-xs mt-1 text-gray-700">Les signalements parents apparaissent automatiquement.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06]">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                  selectedConv.type === "GROUP"   && "bg-gradient-to-br from-blue-600 to-blue-800",
                  selectedConv.type === "PRIVATE" && "bg-gradient-to-br from-gray-600 to-gray-800",
                  selectedConv.type === "SUPPORT" && "bg-gradient-to-br from-orange-600 to-red-700",
                )}>
                  {selectedConv.type === "GROUP"   && <Users         className="w-4 h-4" />}
                  {selectedConv.type === "PRIVATE" && <User          className="w-4 h-4" />}
                  {selectedConv.type === "SUPPORT" && <AlertTriangle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {selectedConv.title || `Conversation ${selectedConv.id.slice(0, 6)}`}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {TYPE_LABELS[selectedConv.type] ?? selectedConv.type}
                  </p>
                </div>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full border font-medium",
                  TYPE_COLORS[selectedConv.type] ?? "bg-gray-500/15 text-gray-400 border-gray-500/25"
                )}>
                  {TYPE_LABELS[selectedConv.type] ?? selectedConv.type}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {msgs(selectedConv).length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-600">
                    <p className="text-sm">Aucun message — commencez la conversation</p>
                  </div>
                ) : (
                  msgs(selectedConv).map((m) => (
                    <div key={m.id} className={cn("flex flex-col", m.mine ? "items-end" : "items-start")}>
                      {!m.mine && m.senderName && (
                        <p className="text-[10px] text-gray-600 mb-1 px-1">
                          {m.senderName}
                          {m.senderRole && <span className="ml-1 text-gray-700">· {roleLabel(m.senderRole)}</span>}
                        </p>
                      )}
                      <div className={cn(
                        "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                        m.mine
                          ? "bg-emerald-600 text-white rounded-tr-sm"
                          : "bg-white/[0.07] text-gray-200 rounded-tl-sm border border-white/10"
                      )}>
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className={cn("text-[10px] mt-1", m.mine ? "text-emerald-200/60" : "text-gray-600")}>
                          {timeAgo(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={endRef} />
              </div>

              {/* Input */}
              <div className="flex items-end gap-2 p-4 border-t border-white/[0.06]">
                <textarea
                  rows={1}
                  placeholder="Écrire un message… (Entrée pour envoyer)"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 transition-all resize-none max-h-28 overflow-y-auto"
                />
                <button
                  onClick={handleSend}
                  disabled={!text.trim() || sending}
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-all flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Modal nouveau message */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Nouveau message privé" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">
              Numéro de téléphone du destinataire
            </label>
            <input
              type="tel"
              placeholder="+225 07 00 00 00 00"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startPrivate()}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setModal(false)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] text-gray-300 text-sm font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={startPrivate}
              disabled={!newPhone.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold transition-all"
            >
              Démarrer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
