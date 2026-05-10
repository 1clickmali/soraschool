"use client";

import { useEffect, useState } from "react";

export type UiLanguage = "fr" | "en";

const STORAGE_KEY = "sora-ui-language";
const CHANGE_EVENT = "sora-ui-language-change";

export function getStoredUiLanguage(): UiLanguage {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "en" ? "en" : "fr";
}

export function setStoredUiLanguage(language: UiLanguage) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, language);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: language }));
}

export function useUiLanguage() {
  const [language, setLanguageState] = useState<UiLanguage>("fr");

  useEffect(() => {
    setLanguageState(getStoredUiLanguage());
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<UiLanguage>).detail;
      setLanguageState(detail === "en" ? "en" : "fr");
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const setLanguage = (nextLanguage: UiLanguage) => {
    setLanguageState(nextLanguage);
    setStoredUiLanguage(nextLanguage);
  };

  return { language, setLanguage };
}

export function uiText(language: UiLanguage, fr: string, en: string) {
  return language === "en" ? en : fr;
}
