import { redirect } from "next/navigation";

export default async function ParentIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/${slug}/parent/dashboard`);
}
