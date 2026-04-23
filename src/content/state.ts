/**
 * Centralized state management for OCRMeow content script.
 * Single source of truth — all UI rendering is driven from this state.
 */

export interface OcrItem {
  text: string;
  score: number;
  box: number[][];
  index: number;
  selected: boolean;
}

export interface AppState {
  items: OcrItem[];
  activeTab: "edit" | "filter";
}

/**
 * Normalize raw OCR result items into typed OcrItem[].
 * Handles field name variations: `box`, `poly`, `points`.
 * Returns only items with valid 4-point coordinate arrays.
 */
export function normalizeOcrItems(rawItems: any[]): OcrItem[] {
  const normalized: OcrItem[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    const coords = raw.box || raw.poly || raw.points;

    if (!coords || !Array.isArray(coords) || coords.length < 4) {
      console.warn(
        `OCRMeow: Block ${i} skipped — invalid coordinates.`,
        "Fields present:",
        Object.keys(raw),
        "Coords value:",
        coords,
      );
      continue;
    }

    // Normalize each point to [x, y] format
    const box: number[][] = coords.map((p: any) => {
      if (Array.isArray(p)) return [p[0], p[1]];
      if (typeof p === "object" && "x" in p && "y" in p) return [p.x, p.y];
      return [0, 0];
    });

    normalized.push({
      text: raw.text ?? "",
      score: raw.score ?? 0,
      box,
      index: i,
      selected: true,
    });
  }

  console.log(`OCRMeow: Normalized ${normalized.length}/${rawItems.length} blocks.`);
  return normalized;
}

export function createState(rawItems: any[]): AppState {
  return {
    items: normalizeOcrItems(rawItems),
    activeTab: "edit",
  };
}
