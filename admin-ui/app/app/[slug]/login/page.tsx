import { redirect } from "next/navigation";

export default function AppSchoolLoginRedirect({ params }: { params: { slug: string } }) {
  redirect(`/${params.slug}/login`);
}
