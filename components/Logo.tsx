/**
 * The Shotty mark: two identical rounded squares, the lower one offset down
 * and right so only a sliver shows — the product in one glyph, a screenshot
 * with a shadow under it.
 *
 * The geometry is fixed by legibility at 16px rather than by taste. On the
 * 32-unit grid the offset is 4, which is the smallest value that lands both
 * squares on whole pixels when the mark is halved to 16px; at offset 2 or 3
 * the sliver falls on a half-pixel and smears into the black edge's
 * antialiasing. Keep these numbers in step with app/icon.svg.
 */
export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="6" y="6" width="24" height="24" rx="6" fill="#b4b4b4" />
      <rect x="2" y="2" width="24" height="24" rx="6" fill="#000000" />
    </svg>
  );
}
