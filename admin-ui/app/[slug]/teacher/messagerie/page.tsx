"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Send, Plus, Users, User, Building2 } from "lucide-react";
import { schoolApi, schoolApiRequest, type Conversation } from "@/lib/school-api";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";

interface Message {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

interface ConversationWithMessages extends Conversation {
  localMessages?: Message[];
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

export default function MessageriePage() {
  const [conversations, setConversations] = useState<ConversationWithMessages[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newConvModal, setNewConvModal] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    setLoading(true);
    const { data } = await schoolApi.messages();
    if (data?.conversations) setConversations(data.conversations.map((c) => ({ ...c, localMessages: [] })));
    setLoading(false);
  };

  useEffect(() => {
    void loadConversations();
  }, []);

  const selectedConv = conversations.find((c) => c.id === selectedId);

  useEffect(() => {
    if (!selectedId) return;
    schoolApiRequest<{ messages: Array<{ id: string; body: string; createdAt: string; senderId?: string }> }>(
      `/api/messages/conversations/${selectedId}/messages`
    ).then(({ data }) => {
      if (!data?.messages) return;
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === selectedId
            ? {
                ...conversation,
                localMessages: data.messages.map((message) => ({
                  id: message.id,
                  body: message.body,
                  createdAt: message.createdAt,
                  mine: false,
                })),
              }
            : conversation
        )
      );
    });
  }, [selectedId]);

  const handleSend = async () => {
    if (!messageText.trim() || !selectedId || sending) return;
    const text = messageText.trim();
    setSending(true);
    setMessageText("");

    // Optimistic UI
    const tempMsg: Message = {
      id: String(Date.now()),
      body: text,
      createdAt: new Date().toISOString(),
      mine: true,
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? { ...c, localMessages: [...(c.localMessages || []), tempMsg] }
          : c
      )
    );
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    await schoolApiRequest(`/api/messages/conversations/${selectedId}/messages`, {
      method: "POST",
      body: { body: text },
    });

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConv = async () => {
    if (!newPhone.trim()) return;
    const { data } = await schoolApiRequest<{ conversation?: Conversation }>("/api/messages/conversations/private", {
      method: "POST",
      body: { phone: newPhone },
    });
    if (data?.conversation) {
      setConversations((prev) => [{ ...data.conversation!, localMessages: [] }, ...prev]);
      setSelectedId(data.conversation.id);
    }
    setNewPhone("");
    setNewConvModal(false);
  };

  const handleDirection = async () => {
    const { data } = await schoolApi.ensureDirectionConversation({
      title: "Lien direct professeur - direction",
      body: "Bonjour, je souhaite échanger avec la direction.",
    });
    if (data?.conversation) {
      setConversations((prev) => [{ ...data.conversation!, localMessages: [] }, ...prev.filter((item) => item.id !== data.conversation!.id)]);
      setSelectedId(data.conversation.id);
    }
  };

  const convMessages = (conv: ConversationWithMessages): Message[] => {
    if (conv.localMessages?.length) return conv.localMessages;
    const fromServer: Message[] = (conv.messages || []).map((m, i) => ({
      id: String(i),
      body: m.body,
      createdAt: m.createdAt,
      mine: false,
    }));
    return [...fromServer, ...(conv.localMessages || [])];
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold font-heading text-white">Messagerie</h1>
        <p className="text-gray-400 text-sm mt-1">Communiquez avec l&apos;équipe, les parents et la direction</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex h-[calc(100vh-220px)] min-h-[500px] bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden"
      >
        {/* Conversations list */}
        <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-semibold text-white">Conversations</span>
            </div>
            <button
              onClick={() => setNewConvModal(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="border-b border-white/[0.06] p-3">
            <button
              onClick={handleDirection}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20"
            >
              <Building2 className="h-4 w-4" />
              Contacter la direction
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 bg-white/[0.04] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 p-6 text-center">
                <MessageSquare className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-xs">Aucune conversation</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const msgs = convMessages(conv);
                const last = msgs[msgs.length - 1];
                const isSelected = selectedId === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left",
                      isSelected && "bg-violet-500/10"
                    )}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                      {conv.type === "GROUP" ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {conv.title || `Conversation ${conv.id.slice(0, 6)}`}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {last?.body || "Aucun message"}
                      </p>
                    </div>
                    <span className="text-[10px] text-gray-600 flex-shrink-0 mt-0.5">
                      {timeAgo(last?.createdAt || conv.updatedAt)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Message panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
              <MessageSquare className="w-14 h-14 mb-3 opacity-15" />
              <p className="text-sm">Sélectionnez une conversation</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center text-xs font-bold text-white">
                  {selectedConv.type === "GROUP" ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {selectedConv.title || `Conversation ${selectedConv.id.slice(0, 6)}`}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{selectedConv.type === "GROUP" ? "Groupe" : "Privée"}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {convMessages(selectedConv).length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-600">
                    <p className="text-sm">Aucun message — commencez la conversation</p>
                  </div>
                ) : (
                  convMessages(selectedConv).map((msg) => (
                    <div key={msg.id} className={cn("flex", msg.mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                          msg.mine
                            ? "bg-violet-600 text-white rounded-tr-sm"
                            : "bg-white/[0.07] text-gray-200 rounded-tl-sm border border-white/10"
                        )}
                      >
                        <p>{msg.body}</p>
                        <p className={cn("text-[10px] mt-1", msg.mine ? "text-violet-200/60" : "text-gray-600")}>
                          {timeAgo(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="flex items-end gap-2 p-4 border-t border-white/[0.06]">
                <textarea
                  rows={1}
                  placeholder="Écrire un message… (Entrée pour envoyer)"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 transition-all resize-none max-h-28 overflow-y-auto"
                />
                <button
                  onClick={handleSend}
                  disabled={!messageText.trim() || sending}
                  className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white transition-all flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* New conversation modal */}
      <Modal isOpen={newConvModal} onClose={() => setNewConvModal(false)} title="Nouvelle conversation" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">
              Numéro de téléphone ou ID participant
            </label>
            <input
              type="text"
              placeholder="Ex: 07 XX XX XX XX"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 transition-all"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setNewConvModal(false)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] text-gray-300 text-sm font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleNewConv}
              disabled={!newPhone.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-all"
            >
              Démarrer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
