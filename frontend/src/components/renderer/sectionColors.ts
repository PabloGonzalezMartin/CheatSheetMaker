export interface SectionColor {
  headerBg: string;
  badgeColor: string;
  numberBg: string;         // kept for any legacy use
  numberBgPdf: [string, string];
}

export const SECTION_COLORS: SectionColor[] = [
  {
    headerBg: "linear-gradient(135deg, rgba(37,99,235,0.10) 0%, rgba(59,130,246,0.10) 100%)",
    badgeColor: "#2563eb",
    numberBg: "#2563eb",
    numberBgPdf: ["#2563eb", "#3b82f6"],
  },
  {
    headerBg: "linear-gradient(135deg, rgba(5,150,105,0.10) 0%, rgba(16,185,129,0.10) 100%)",
    badgeColor: "#059669",
    numberBg: "#059669",
    numberBgPdf: ["#059669", "#10b981"],
  },
  {
    headerBg: "linear-gradient(135deg, rgba(225,29,72,0.10) 0%, rgba(244,63,94,0.10) 100%)",
    badgeColor: "#e11d48",
    numberBg: "#e11d48",
    numberBgPdf: ["#e11d48", "#f43f5e"],
  },
  {
    headerBg: "linear-gradient(135deg, rgba(79,70,229,0.10) 0%, rgba(99,102,241,0.10) 100%)",
    badgeColor: "#4f46e5",
    numberBg: "#4f46e5",
    numberBgPdf: ["#4f46e5", "#6366f1"],
  },
  {
    headerBg: "linear-gradient(135deg, rgba(217,119,6,0.10) 0%, rgba(245,158,11,0.10) 100%)",
    badgeColor: "#d97706",
    numberBg: "#d97706",
    numberBgPdf: ["#d97706", "#f59e0b"],
  },
  {
    headerBg: "linear-gradient(135deg, rgba(124,58,237,0.10) 0%, rgba(139,92,246,0.10) 100%)",
    badgeColor: "#7c3aed",
    numberBg: "#7c3aed",
    numberBgPdf: ["#7c3aed", "#8b5cf6"],
  },
];

export function getColorForIndex(i: number): SectionColor {
  return SECTION_COLORS[i % SECTION_COLORS.length];
}
