"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Sun,
  Moon,
  ChevronRight,
  Search,
  Settings,
  LogOut,
  User,
} from "lucide-react";
import { superAdminApi, type SuperAdminNotification } from "@/lib/api";
import { useBranding } from "@/lib/branding";
import { cn, formatRelativeDate, getInitials } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

const breadcrumbMap: Record<string, string> = {
  "/dashboard": "Vue d'ensemble",
  "/analytics": "Analytique",
  "/institutions": "Écoles clientes",
  "/plans": "Plans & abonnements",
  "/payments": "Facturation SaaS",
  "/factures": "Factures SaaS",
  "/configuration": "Configuration",
  "/acces-autorises": "Utilisateurs & accès",
  "/access": "Utilisateurs & accès",
  "/documents": "Documents",
  "/systeme": "Système",
  "/system": "Système",
  "/administration": "Gestion admins",
  "/admin": "Gestion admins",
  "/parametres": "Paramètres",
  "/settings": "Paramètres",
};

export function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [darkMode, setDarkMode] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<SuperAdminNotification[]>([]);
  const { branding } = useBranding();

  const pathSegments = pathname.split("/").filter(Boolean);
  const currentPage = breadcrumbMap[pathname] || "Page";
  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    superAdminApi.notifications().then(({ data }) => {
      setNotifications(data?.notifications || []);
    });
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center h-16 px-6 border-b border-white/[0.06] bg-soraDark/80 backdrop-blur-xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm flex-1">
        <span className="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
          {branding.appName}
        </span>
        {pathSegments.map((segment, index) => {
          const isLast = index === pathSegments.length - 1;
          const segmentPath = "/" + pathSegments.slice(0, index + 1).join("/");
          const label = breadcrumbMap[segmentPath] || segment;
          return (
            <span key={segment} className="flex items-center gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
              <span
                className={cn(
                  "font-medium transition-colors",
                  isLast ? "text-white" : "text-gray-500 hover:text-gray-300 cursor-pointer"
                )}
              >
                {label}
              </span>
            </span>
          );
        })}
      </div>

      {/* Search bar */}
      <div className="hidden md:flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 mr-4 w-56 group hover:border-white/15 transition-colors">
        <Search className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher..."
          className="bg-transparent text-sm text-gray-400 placeholder:text-gray-600 outline-none flex-1 w-full"
        />
        <kbd className="text-xs text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">⌘K</kbd>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/8 transition-all"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="relative p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/8 transition-all"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-soraBlue rounded-full">
                <span className="absolute inset-0 bg-soraBlue rounded-full animate-ping opacity-75" />
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 bg-soraCard border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  <span className="text-xs text-soraBlue bg-soraBlue/10 px-2 py-0.5 rounded-full">
                    {unreadCount} nouvelles
                  </span>
                </div>
                <div className="divide-y divide-white/5">
                  {notifications.length === 0 && (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-gray-500">Aucune notification</p>
                    </div>
                  )}
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        "px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer",
                        notif.unread && "bg-soraBlue/[0.03]"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {notif.unread && (
                          <div className="w-1.5 h-1.5 bg-soraBlue rounded-full mt-2 flex-shrink-0" />
                        )}
                        {!notif.unread && <div className="w-1.5 flex-shrink-0" />}
                        <div>
                          <p className="text-sm font-medium text-white">{notif.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{notif.desc}</p>
                          <p className="text-xs text-gray-600 mt-1">{formatRelativeDate(notif.time)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-white/8 text-center">
                  <button className="text-xs text-soraBlue hover:text-blue-400 transition-colors">
                    Voir tout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-xl hover:bg-white/8 transition-all group"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-soraBlue to-purple-600 flex items-center justify-center text-xs font-bold text-white">
              {user?.name ? getInitials(user.name) : "SA"}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-white leading-none">
                {user?.name || "Super Admin"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Super Admin</p>
            </div>
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-52 bg-soraCard border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-white/8">
                  <p className="text-sm font-medium text-white">{user?.name || "Super Admin"}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{user?.phone}</p>
                </div>
                <div className="p-1.5">
                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                    <User className="w-4 h-4" />
                    Mon profil
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition-colors">
                    <Settings className="w-4 h-4" />
                    Paramètres
                  </button>
                  <div className="h-px bg-white/8 my-1.5" />
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Déconnexion
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Click outside to close */}
      {(showNotifications || showUserMenu) && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => {
            setShowNotifications(false);
            setShowUserMenu(false);
          }}
        />
      )}
    </header>
  );
}
