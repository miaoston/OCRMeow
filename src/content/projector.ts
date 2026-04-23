/**
 * CoordinateProjector — The single source of truth for all spatial transformations.
 *
 * Handles conversions between:
 * - OCR Physical (px returned by engine)
 * - CSS Logical (px used in browser DOM)
 * - Screen Viewport (coordinates relative to window)
 */
export class CoordinateProjector {
  private dpr: number;

  constructor() {
    this.dpr = window.devicePixelRatio || 1;
  }

  /**
   * Convert physical OCR pixels to CSS pixels.
   * Logic: css = physical / dpr
   */
  physicalToCss(physicalPx: number): number {
    return physicalPx / this.dpr;
  }

  /**
   * Project an OCR block result onto the screen given a selection offset.
   *
   * @param physicalX X coordinate from OCR engine
   * @param physicalY Y coordinate from OCR engine
   * @param offsetX Starting X of the selection crop (CSS px)
   * @param offsetY Starting Y of the selection crop (CSS px)
   */
  projectPoint(physicalX: number, physicalY: number, offsetX: number, offsetY: number) {
    return {
      x: physicalX / this.dpr + offsetX,
      y: physicalY / this.dpr + offsetY,
    };
  }

  /**
   * Project a full dimension (width/height) from physical to CSS.
   */
  projectDimension(physicalSize: number): number {
    return physicalSize / this.dpr;
  }

  /**
   * Get current DPR for external use (e.g., Canvas scaling)
   */
  getDPR(): number {
    return this.dpr;
  }
}

export const projector = new CoordinateProjector();
