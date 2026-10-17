"use client";

import { useId } from "react";

/** Tap to rate 1 to 5. Real radio buttons, so it works with a keyboard and a screen reader; the stars are only the picture. */
export function TapRating({
  legend,
  value,
  onChange,
  starLabel,
}: {
  legend: string;
  value: number | null;
  onChange: (value: number) => void;
  /** For example "{n} out of 5", already filled in per star by the caller. */
  starLabel: (n: number) => string;
}) {
  const name = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="font-medium">{legend}</legend>
      <div className="flex gap-1" dir="ltr">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="relative cursor-pointer">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              aria-label={starLabel(n)}
              className="peer sr-only"
            />
            <svg
              viewBox="0 0 24 24"
              width="36"
              height="36"
              aria-hidden="true"
              strokeWidth="1.5"
              strokeLinejoin="round"
              className={`rounded-md peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-verified ${
                value !== null && n <= value ? "fill-star stroke-star" : "fill-none stroke-muted"
              }`}
            >
              <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8L12 3Z" />
            </svg>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
