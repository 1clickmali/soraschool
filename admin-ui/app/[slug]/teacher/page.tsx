import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function TeacherRootPage({ params }: Props) {
  const { slug } = await params;
  redirect(`/${slug}/teacher/dashboard`);
}
