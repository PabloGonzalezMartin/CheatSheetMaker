import { EditorPage } from "@/components/editor/EditorPage";

interface Props {
  params: { id: string };
}

export default function EditCheatsheetPage({ params }: Props) {
  return <EditorPage cheatsheetId={params.id} />;
}
