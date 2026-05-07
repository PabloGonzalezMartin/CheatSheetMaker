export interface CodeLine {
  type: "code" | "text" | "image";
  command?: string;
  comment?: string;
  text?: string;
  // image type fields
  src?: string;
  widthPercent?: number;
}

export interface ImageData {
  src: string;
  widthPercent?: number;
}

export interface Subsection {
  _uiId?: string;
  title: string;
  images: ImageData[];
  lines: CodeLine[];
}

export interface Section {
  _uiId?: string;
  title: string;
  description?: string;
  images: ImageData[];
  lines: CodeLine[];
  subsections: Subsection[];
}

export interface CheatsheetData {
  id?: string;
  title: string;
  group: string;
  sections: Section[];
  created_at?: string;
  updated_at?: string;
}

export interface CheatsheetListItem {
  id: string;
  title: string;
  group: string;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  color: string;
}
