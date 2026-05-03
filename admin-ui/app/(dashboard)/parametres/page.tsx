"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ParametresRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/configuration"); }, [router]);
  return null;
}
