/**
 * CoordinateProjector — The single source of truth for all spatial transformations.
 *
 * Handles conversions between:
 * - OCR Physical (px returned by engine)
 * - CSS Logical (px used in browser DOM)
 * - Screen Viewport (coordinates relative to window)
 */
export class CoordinateProjector {
  /**
   * Get current DPR dynamically to support zoom changes & screen swaps
   */
  getDPR(): number {
    return window.devicePixelRatio || 1;
  }

  /**
   * Convert physical OCR pixels to CSS pixels.
   * Logic: css = physical / dpr
   */
  physicalToCss(physicalPx: number): number {
    return physicalPx / this.getDPR();
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
    const dpr = this.getDPR();
    return {
      x: physicalX / dpr + offsetX,
      y: physicalY / dpr + offsetY,
    };
  }

  /**
   * Project a full dimension (width/height) from physical to CSS.
   */
  projectDimension(physicalSize: number): number {
    return physicalSize / this.getDPR();
  }
}

export const projector = new CoordinateProjector();
