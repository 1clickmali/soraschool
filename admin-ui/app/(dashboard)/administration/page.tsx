"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdministrationRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/acces-autorises"); }, [router]);
  return null;
}
