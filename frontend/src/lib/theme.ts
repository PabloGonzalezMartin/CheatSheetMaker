/** Central theme constants — single source of truth for all colors used across the app. */

export const SYNTAX_COLORS = {
  method: "#e74c3c",
  param: "#e67e22",
  str:   "#27ae60",
} as const;

export const APP_COLORS = {
  headerDark:  "#1e3c72",
  headerLight: "#2a5298",
  headerGradient: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
  textLineAccent: "#667eea",
  commandText: "#2c3e50",
  commentText: "#6c757d",
  bodyBg: "#f8f9fa",
  cardBg: "#ffffff",
  border: "#e0e0e0",
  mutedText: "#555",
} as const;
