"use client";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function StudentRoot() {
  const router = useRouter();
  const { slug } = useParams() as { slug: string };
  useEffect(() => { router.replace(`/${slug}/student/dashboard`); }, [router, slug]);
  return null;
}
