/** The score as already formatted for the page language (digits follow the language), with a spoken label. */
export function ScoreTile({ text, label }: { text: string; label: string }) {
  return (
    <span aria-label={label} className="inline-flex min-w-12 items-center justify-center rounded-xl bg-tint px-2.5 py-1.5 text-base font-bold text-verified">
      {text}
    </span>
  );
}
