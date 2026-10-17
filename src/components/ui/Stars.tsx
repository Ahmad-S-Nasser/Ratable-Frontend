/** Amber is for stars only. The accessible text is the number, so the stars themselves are decorative. */
export function Stars({ value, label }: { value: number; label: string }) {
  const full = Math.round(Math.min(5, Math.max(0, value)));
  return (
    <span role="img" aria-label={label} className="inline-flex gap-0.5 text-star">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill={i < full ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8L12 3Z" />
        </svg>
      ))}
    </span>
  );
}
