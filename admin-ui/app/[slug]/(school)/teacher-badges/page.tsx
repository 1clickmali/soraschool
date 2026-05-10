import { redirect } from "next/navigation";

export default async function TeacherBadgesRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/${slug}/pointage-personnel`);
}
