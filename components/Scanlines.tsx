/**
 * Fixed CRT scanline overlay. Purely decorative: it sits above everything at
 * ~3% opacity and never intercepts pointer events.
 *
 * It starts 3px above the viewport because the lines roll slowly downwards —
 * one 3px gradient period every 9 seconds — and the offset keeps the top edge
 * covered for the whole cycle. The roll is a composited transform, so it does
 * not repaint the layer.
 */
export default function Scanlines() {
  return (
    <div
      aria-hidden="true"
      className="ags-scanlines pointer-events-none fixed inset-x-0 -top-[3px] bottom-0 z-50"
    />
  );
}
