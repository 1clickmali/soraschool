"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => {
          // En développement, un ancien service worker ne doit jamais bloquer l'interface.
        });

      if ("caches" in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch(() => {
            // Le nettoyage de cache est opportuniste.
          });
      }
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== "localhost") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // L'app reste utilisable même si le navigateur refuse l'installation PWA.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
