"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, Building2, CheckCircle, Clock, Info, RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { superAdminApi, type AuditLog, type Institution, type SystemService } from "@/lib/api";

const levelStyle: Record<string, string> = {
  INFO: "text-soraBlue bg-soraBlue/10",
  WARN: "text-orange-400 bg-orange-400/10",
  ERROR: "text-red-400 bg-red-400/10",
};
const levelIcon: Record<string, typeof Info> = { INFO: Info, WARN: AlertTriangle, ERROR: AlertTriangle };

function logLevel(log: AuditLog) {
  if (log.action.includes("DELETE") || log.action.includes("REVOKE")) return "WARN";
  return "INFO";
}

function actorName(log: AuditLog) {
  const name = [log.actor?.firstName, log.actor?.lastName].filter(Boolean).join(" ").trim();
  return name || log.actor?.phone || "Système";
}

export default function SystemePage() {
  const [services, setServices] = useState<SystemService[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [healthRes, logsRes, institutionsRes] = await Promise.all([
      superAdminApi.systemHealth(),
      superAdminApi.auditLogs(selectedInstitutionId || undefined),
      superAdminApi.institutions(),
    ]);
    setServices(healthRes.data?.services || []);
    setLogs(logsRes.data?.logs || []);
    setInstitutions(institutionsRes.data?.institutions || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedInstitutionId]);

  return (
    <div className="space-y-6 max-w-[1600px]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Système</h1>
          <p className="text-gray-400 text-sm mt-0.5">Santé globale et audit trail trié par école.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <select
              value={selectedInstitutionId}
              onChange={(event) => setSelectedInstitutionId(event.target.value)}
              className="min-w-[240px] rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white [&>option]:bg-soraCard"
            >
              <option value="">Toutes les écoles</option>
              {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
            </select>
          </div>
          <Button variant="secondary" size="sm" icon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />} onClick={load}>
            Actualiser
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {services.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-soraCard border border-white/8 rounded-2xl p-4 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-20 mb-4" />
              <div className="h-3 bg-white/10 rounded w-28" />
            </div>
          ))
        ) : services.map((s, i) => (
          <motion.div key={s.name} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="bg-soraCard border border-white/8 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Server className="w-4 h-4 text-gray-500" />
              <span className={`w-2 h-2 rounded-full ${s.status === "ok" || s.status === "configured" ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            </div>
            <p className="text-sm font-semibold text-white">{s.name}</p>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              {s.status === "ok" || s.status === "configured" ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <AlertTriangle className="w-3 h-3 text-red-400" />}
              {s.status === "ok" || s.status === "configured" ? `Opérationnel — ${s.latency}` : `Erreur — ${s.latency}`}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-soraCard border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex items-center gap-2">
          <Activity className="w-4 h-4 text-soraBlue" />
          <h2 className="text-sm font-semibold text-white">Audit Trail — dernières actions</h2>
        </div>
        <div className="divide-y divide-white/5">
          {logs.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Activity className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Aucune action auditée pour le moment</p>
            </div>
          ) : logs.map((log, i) => {
            const level = logLevel(log);
            const Icon = levelIcon[level];
            return (
              <motion.div key={log.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }}
                className="flex items-start gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold mt-0.5 ${levelStyle[level]}`}>
                  <Icon className="w-3 h-3" />{level}
                </span>
                <span className="text-xs text-gray-500 font-mono mt-0.5 w-20 shrink-0">
                  <Clock className="w-3 h-3 inline mr-1" />{new Date(log.createdAt).toLocaleTimeString("fr-CI", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-gray-300">{log.action} {log.entity}</span>
                  <span className="text-xs text-gray-500"> · {log.institution?.name || "Plateforme"}</span>
                </div>
                <span className="text-xs text-gray-600 shrink-0">{actorName(log)}</span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
