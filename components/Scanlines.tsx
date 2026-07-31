/**
 * Fixed CRT scanline overlay. Purely decorative: it sits above everything at
 * ~3% opacity and never intercepts pointer events.
 */
export default function Scanlines() {
  return (
    <div
      aria-hidden="true"
      className="ags-scanlines pointer-events-none fixed inset-0 z-50"
    />
  );
}
