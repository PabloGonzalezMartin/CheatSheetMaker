import { redirect } from "next/navigation";

export default function SharedPage({ params }: { params: { id: string } }) {
  redirect(`/api/export/html/shared/${params.id}`);
}
