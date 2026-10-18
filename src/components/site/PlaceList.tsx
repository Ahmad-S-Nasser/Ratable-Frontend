"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Locale } from "@/i18n/config";
import type { PlaceCard } from "@/lib/api/types";
import { PlaceCardView, type CardLabels } from "./PlaceCardView";

type Props = {
  places: PlaceCard[];
  lang: Locale;
  categoryId: string;
  labels: CardLabels;
  /** Where to ask for the same places with distances: the visitor's location is sent in a header, only for this one request. */
  distanceUrl: string;
  near: { button: string; hint: string; denied: string; failed: string };
};

/**
 * A list of place cards that is fully rendered on the server. The "distance from me" button asks for the device location only when it is pressed
 * (a permission asked in context), sends it with one request in a header, shows the distances, and keeps nothing: not in storage, not in the address.
 */
export function PlaceList({ places, lang, categoryId, labels, distanceUrl, near }: Props) {
  const [distances, setDistances] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function share() {
    setMessage(null);
    if (!navigator.geolocation) return setMessage(near.denied);
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const response = await fetch(distanceUrl, { headers: { "X-Visitor-Location": `${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}` }, credentials: "omit" });
          if (!response.ok) throw new Error("failed");
          const body = (await response.json()) as { places: PlaceCard[] } | PlaceCard[];
          const list = Array.isArray(body) ? body : body.places;
          setDistances(Object.fromEntries(list.filter((p) => p.distanceMeters != null).map((p) => [p.id, p.distanceMeters as number])));
        } catch {
          setMessage(near.failed);
        } finally {
          setBusy(false);
        }
      },
      () => {
        setBusy(false);
        setMessage(near.denied);
      },
      { maximumAge: 0, timeout: 15_000 },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" disabled={busy} onClick={share}>
          {near.button}
        </Button>
        <span className="text-sm text-muted">{near.hint}</span>
        {message ? (
          <span role="status" className="text-sm text-muted">
            {message}
          </span>
        ) : null}
      </div>
      <ol className="grid gap-4 md:grid-cols-2">
        {places.map((p) => (
          <li key={p.id}>
            <PlaceCardView place={p} lang={lang} categoryId={categoryId} labels={labels} distanceMeters={distances[p.id]} />
          </li>
        ))}
      </ol>
    </div>
  );
}
