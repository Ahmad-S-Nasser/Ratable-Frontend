"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PinIcon } from "@/components/ui/Icons";
import type { Locale } from "@/i18n/config";
import { fmt, formatNumber } from "@/i18n/format";
import type { NearbyList, PlaceCard } from "@/lib/api/types";
import { PlaceCardView, type CardLabels } from "./PlaceCardView";

type Dict = {
  chooseArea: string; areaPicker: string; areaSearch: string; areaNone: string; close: string; radius: string; km: string; category: string; allCategories: string;
  useLocation: string; permissionHeading: string; permissionText: string; permissionAllow: string; permissionDenied: string; loading: string; empty: string;
  results: string; from: string; fromDevice: string; view: string; viewList: string; viewMap: string; mapNote: string; mapLabel: string; errors: Record<string, string>;
};

const RADII = [1, 3, 5, 10, 25] as const;

type Source = { kind: "area"; id: string; name: string } | { kind: "device"; lat: number; lng: number } | null;
type Result = { phase: "idle" } | { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; data: NearbyList };

const normalize = (s: string) => s.toLowerCase().replace(/[ً-ٟـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");

/**
 * The nearby screen. Nothing is asked up front: the visitor either chooses an area or, on pressing "Allow location", shares the device location, which is
 * held in memory for this page only and sent in a header with each search (never in the address, never saved). Results are inside the chosen distance
 * and ranked by verified score first and then distance.
 */
export function NearbyView({
  lang, areas, categories, labels, dict, initialArea,
}: { lang: Locale; areas: { id: string; name: string }[]; categories: { id: string; name: string }[]; labels: CardLabels; dict: Dict; initialArea?: string }) {
  const start = areas.find((a) => a.id === initialArea);
  const [source, setSource] = useState<Source>(start ? { kind: "area", id: start.id, name: start.name } : null);
  const [radius, setRadius] = useState<number>(5);
  const [category, setCategory] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [denied, setDenied] = useState(false);
  const [result, setResult] = useState<Result>({ phase: "idle" });
  const pickerInput = useRef<HTMLInputElement>(null);

  const fetchNearby = useCallback(
    async (s: NonNullable<Source>, km: number, cat: string): Promise<Result> => {
      const q = new URLSearchParams({ radiusKm: String(km), lang });
      if (cat) q.set("category", cat);
      if (s.kind === "area") q.set("area", s.id);
      try {
        // The device location goes in a header: it is used to answer this request and is never part of an address.
        const response = await fetch(`/api/places?${q}`, { headers: s.kind === "device" ? { "X-Visitor-Location": `${s.lat.toFixed(5)},${s.lng.toFixed(5)}` } : undefined, credentials: "omit" });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          return { phase: "error", message: dict.errors[body?.error ?? "unknown"] ?? dict.errors.unknown };
        }
        return { phase: "ready", data: (await response.json()) as NearbyList };
      } catch {
        return { phase: "error", message: dict.errors.network };
      }
    },
    [lang, dict.errors],
  );

  /** A choice was made (an area, the device, a distance or a category): search again with it. */
  async function run(next: { source?: Source; radius?: number; category?: string }) {
    const s = next.source === undefined ? source : next.source;
    const km = next.radius ?? radius;
    const cat = next.category ?? category;
    if (next.source !== undefined) setSource(next.source);
    if (next.radius !== undefined) setRadius(km);
    if (next.category !== undefined) setCategory(cat);
    if (!s) return;
    setResult({ phase: "loading" });
    setResult(await fetchNearby(s, km, cat));
  }

  useEffect(() => {
    // An area in the address starts the first search.
    if (!start) return;
    let cancelled = false;
    void (async () => {
      const first = await fetchNearby({ kind: "area", id: start.id, name: start.name }, 5, "");
      if (!cancelled) setResult(first);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only for the first screen
  }, []);

  useEffect(() => {
    if (picker) pickerInput.current?.focus();
  }, [picker]);

  function allowLocation() {
    setDenied(false);
    if (!navigator.geolocation) return setDenied(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => void run({ source: { kind: "device", lat: pos.coords.latitude, lng: pos.coords.longitude } }),
      () => setDenied(true),
      { maximumAge: 0, timeout: 15_000 },
    );
  }

  const filtered = areas.filter((a) => normalize(a.name).includes(normalize(query)) || normalize(a.id).includes(normalize(query)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => setPicker(true)} aria-haspopup="dialog">
          <PinIcon width={18} height={18} />
          {source?.kind === "area" ? fmt(dict.from, { area: source.name }) : source?.kind === "device" ? dict.fromDevice : dict.chooseArea}
        </Button>
        {source ? (
          <Button type="button" variant="ghost" onClick={allowLocation}>
            {dict.useLocation}
          </Button>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{dict.category}</span>
          <select value={category} onChange={(e) => void run({ category: e.target.value })} className="min-h-11 rounded-full border border-border bg-surface px-3">
            <option value="">{dict.allCategories}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div role="group" aria-label={dict.radius} className="flex flex-wrap gap-2">
        {RADII.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={radius === r}
            onClick={() => void run({ radius: r })}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${radius === r ? "border-verified bg-tint text-verified" : "border-border bg-surface hover:bg-surface-2"}`}
          >
            {fmt(dict.km, { n: formatNumber(lang, r) })}
          </button>
        ))}
      </div>

      {!source ? (
        <Card className="space-y-4" data-testid="permission-screen">
          <h2 className="font-heading text-xl font-semibold">{dict.permissionHeading}</h2>
          <p className="leading-7 text-muted">{dict.permissionText}</p>
          {denied ? (
            <p role="status" className="text-sm text-negative">
              {dict.permissionDenied}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="primary" onClick={allowLocation}>
              {dict.permissionAllow}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPicker(true)}>
              {dict.chooseArea}
            </Button>
          </div>
        </Card>
      ) : (
        <section aria-live="polite" className="space-y-4">
          {denied ? (
            <p role="status" className="text-sm text-negative">
              {dict.permissionDenied}
            </p>
          ) : null}
          {result.phase === "loading" || result.phase === "idle" ? <p className="text-muted">{dict.loading}</p> : null}
          {result.phase === "error" ? (
            <p role="alert" className="text-negative">
              {result.message}
            </p>
          ) : null}
          {result.phase === "ready" ? (
            result.data.places.length === 0 ? (
              <Card data-testid="nearby-empty" className="space-y-1">
                <p>{fmt(dict.empty, { km: formatNumber(lang, result.data.radiusKm) })}</p>
              </Card>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted" data-testid="nearby-count">
                    {fmt(dict.results, { count: formatNumber(lang, result.data.total), km: formatNumber(lang, result.data.radiusKm) })}
                  </p>
                  <div role="group" aria-label={dict.view} className="inline-flex rounded-full border border-border bg-surface p-0.5">
                    {(["list", "map"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={view === v}
                        onClick={() => setView(v)}
                        className={`min-h-9 rounded-full px-4 text-sm font-medium ${view === v ? "bg-tint text-verified" : "text-muted"}`}
                      >
                        {v === "list" ? dict.viewList : dict.viewMap}
                      </button>
                    ))}
                  </div>
                </div>
                {view === "map" ? <NearbyMap places={result.data.places} radiusKm={result.data.radiusKm} label={dict.mapLabel} note={dict.mapNote} kmLabel={dict.km} lang={lang} /> : null}
                <ol className="grid gap-4 md:grid-cols-2">
                  {result.data.places.map((p) => (
                    <li key={p.id}>
                      <PlaceCardView place={p} lang={lang} categoryId={p.categoryId ?? ""} labels={labels} />
                    </li>
                  ))}
                </ol>
              </>
            )
          ) : null}
        </section>
      )}

      {picker ? (
        <div role="dialog" aria-modal="true" aria-label={dict.areaPicker} className="fixed inset-0 z-50 grid items-end bg-scrim sm:place-items-center">
          <div className="max-h-[80dvh] w-full space-y-3 overflow-y-auto rounded-t-[24px] bg-surface p-5 sm:max-w-md sm:rounded-[24px]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-semibold">{dict.areaPicker}</h2>
              <button type="button" onClick={() => setPicker(false)} className="min-h-11 rounded-full px-3 text-sm font-medium hover:bg-surface-2">
                {dict.close}
              </button>
            </div>
            <input
              ref={pickerInput}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.areaSearch}
              aria-label={dict.areaSearch}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3"
            />
            {filtered.length === 0 ? (
              <p className="text-muted">{dict.areaNone}</p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setDenied(false);
                        setPicker(false);
                        void run({ source: { kind: "area", id: a.id, name: a.name } });
                      }}
                      className="flex min-h-11 w-full items-center rounded-xl px-3 text-start hover:bg-surface-2"
                    >
                      {a.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A simple stand-in for a map: the rings are the distances (one for each chosen radius step) and each dot is a place at its real distance. The direction
 * is not shown, since the diagram only knows distances. A Google map replaces it later behind the same screen.
 */
function NearbyMap({ places, radiusKm, label, note, kmLabel, lang }: { places: PlaceCard[]; radiusKm: number; label: string; note: string; kmLabel: string; lang: Locale }) {
  const size = 320;
  const c = size / 2;
  const max = radiusKm * 1000;
  const golden = Math.PI * (3 - Math.sqrt(5));
  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="mx-auto w-full max-w-sm rounded-card border border-border bg-surface">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <circle key={f} cx={c} cy={c} r={(c - 14) * f} fill="none" stroke="var(--border)" strokeDasharray={f === 1 ? undefined : "3 4"} />
        ))}
        <circle cx={c} cy={c} r={5} fill="var(--verified)" />
        <text x={c + 8} y={size - 6} fontSize="11" fill="var(--muted)">
          {fmt(kmLabel, { n: formatNumber(lang, radiusKm) })}
        </text>
        {places.map((p, i) => {
          const r = Math.min(1, (p.distanceMeters ?? 0) / max) * (c - 14);
          const angle = i * golden;
          return <circle key={p.id} data-testid="map-dot" cx={c + r * Math.cos(angle)} cy={c + r * Math.sin(angle)} r={6} fill="var(--accent)" stroke="var(--foreground)" strokeWidth="1" />;
        })}
      </svg>
      <figcaption className="text-center text-xs text-muted">{note}</figcaption>
    </figure>
  );
}
