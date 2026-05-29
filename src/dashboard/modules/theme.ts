// ─── Theme Module ──────────────────────────────────────────────────
// Studio theme management via CSS custom properties.

/**
 * Apply studio theme by swapping CSS custom properties on :root.
 */
export function applyStudioTheme(theme: string): void {
  const root = document.documentElement;

  const themes: Record<string, Record<string, string>> = {
    pro_dark: {
      "--bg": "#08090c",
      "--bg-surface": "#0c0d11",
      "--bg-elevated": "#101218",
      "--cyan": "#00f3ff",
      "--cyan-dim": "rgba(0, 243, 255, 0.15)",
      "--cyan-ghost": "rgba(0, 243, 255, 0.06)",
      "--border": "rgba(0, 243, 255, 0.1)",
      "--border-bright": "rgba(0, 243, 255, 0.3)",
    },
    midnight: {
      "--bg": "#080c14",
      "--bg-surface": "#0c1220",
      "--bg-elevated": "#10182c",
      "--cyan": "#5b9cf5",
      "--cyan-dim": "rgba(91, 156, 245, 0.15)",
      "--cyan-ghost": "rgba(91, 156, 245, 0.06)",
      "--border": "rgba(91, 156, 245, 0.12)",
      "--border-bright": "rgba(91, 156, 245, 0.3)",
    },
    hacker: {
      "--bg": "#060c06",
      "--bg-surface": "#0a120a",
      "--bg-elevated": "#0e180e",
      "--cyan": "#00ff41",
      "--cyan-dim": "rgba(0, 255, 65, 0.15)",
      "--cyan-ghost": "rgba(0, 255, 65, 0.06)",
      "--border": "rgba(0, 255, 65, 0.12)",
      "--border-bright": "rgba(0, 255, 65, 0.3)",
    },
  };

  const vars = themes[theme] ?? themes.pro_dark;
  Object.entries(vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
}
