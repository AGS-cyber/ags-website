const BANDS = [
  // Scores never exceed 0, so this band matches exactly one value: the zero.
  { min: 0, label: "DOESN'T SUCK", warn: false, highlight: true },
  { min: -20, label: "SUCKS THE LEAST", warn: false, highlight: false },
  { min: -50, label: "SUCKS RESPECTABLY", warn: false, highlight: false },
  { min: -80, label: "SUCKS LOUDLY", warn: false, highlight: false },
  { min: -100, label: "SUCKS INFINITELY", warn: true, highlight: false },
  // Below -100 the number stops being a measurement and becomes a statement.
  { min: -Infinity, label: "OFF THE SCALE", warn: true, highlight: false },
];

function bandFor(score: number) {
  return BANDS.find((band) => score >= band.min) ?? BANDS[BANDS.length - 1];
}

type ScoreBadgeProps = {
  score: number;
  size?: "sm" | "lg";
};

/**
 * Type scale for the number itself, stepped down by digit count. Scores are
 * normally 1-4 characters, but nothing stops a review from going absurdly far
 * below -100, and a 16-character score at text-4xl blows out the card on
 * mobile. Shrinking beats truncating: the digits are the joke.
 */
const NUMBER_SIZES = {
  sm: ["text-3xl sm:text-4xl", "text-xl sm:text-2xl", "text-sm sm:text-base"],
  lg: ["text-5xl sm:text-7xl", "text-3xl sm:text-5xl", "text-lg sm:text-2xl"],
} as const;

function sizeStep(length: number): 0 | 1 | 2 {
  if (length > 8) {
    return 2;
  }
  return length > 4 ? 1 : 0;
}

/**
 * The whole joke, rendered. 0 is the best score a game can get; -100 is the
 * nominal worst, and anything below that is off the scale on purpose. Only the
 * bottom bands get --warn, everything else is --acid.
 */
export default function ScoreBadge({ score, size = "sm" }: ScoreBadgeProps) {
  const band = bandFor(score);
  const color = band.warn ? "var(--warn)" : "var(--acid)";
  const display = score.toLocaleString("en-US");

  return (
    <div className="shrink-0 text-right">
      <div
        className={`mono leading-none tracking-[0.01em] tabular-nums ${
          NUMBER_SIZES[size][sizeStep(display.length)]
        }`}
        style={{ color }}
      >
        {display}
      </div>
      <div
        className={`mono mt-3 tracking-[0.2em] uppercase ${
          size === "lg" ? "text-[10px] sm:text-[11px]" : "text-[9px] sm:text-[10px]"
        } ${band.highlight ? "inline-block px-2.5 py-1.5" : ""}`}
        style={
          band.highlight
            ? { background: "var(--acid)", color: "var(--bg)" }
            : { color }
        }
      >
        {band.label}
      </div>
    </div>
  );
}
