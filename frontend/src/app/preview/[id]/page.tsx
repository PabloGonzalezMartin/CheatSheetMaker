import { redirect } from "next/navigation";

// Legacy /preview/{id} route — now handled by the Next.js export route (requires token in URL)
export default function PreviewPage({ params }: { params: { id: string } }) {
  // Can't redirect with token here (server component has no access to client token)
  // Show a message guiding users to open via the editor instead
  void params;
  redirect("/");
}
