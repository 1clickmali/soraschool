import { redirect } from "next/navigation";

export default async function StudentHomeworkRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/${slug}/student/dashboard`);
}
