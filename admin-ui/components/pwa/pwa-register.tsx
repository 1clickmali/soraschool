"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
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
