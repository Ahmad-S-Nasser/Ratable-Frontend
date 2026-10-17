export function ScoreTile({ score, label }: { score: number; label: string }) {
  return (
    <span aria-label={label} className="inline-flex min-w-12 items-center justify-center rounded-xl bg-tint px-2.5 py-1.5 text-base font-bold text-verified">
      {score.toFixed(1)}
    </span>
  );
}
