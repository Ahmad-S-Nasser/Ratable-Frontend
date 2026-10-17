"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Locale } from "@/i18n/config";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";

type Dict = {
  intro: string; category: string; nameAr: string; nameEn: string; nameHint: string; city: string; address: string; location: string;
  locationHint: string; useLocation: string; latitude: string; longitude: string; submit: string; saving: string; doneHeading: string;
  doneText: string; signInNeeded: string; signIn: string; loading: string; errors: Record<string, string>;
};

type State = "loading" | "signedOut" | "ready" | "saving" | "done";

const field = "min-h-11 w-full rounded-xl border border-border bg-background px-3";

/** Suggest a place that is not on the site yet. A person checks it (and for duplicates) before it appears. */
export function AddPlaceForm({ lang, categories, initialCategory, dict }: { lang: Locale; categories: { id: string; name: string }[]; initialCategory: string; dict: Dict }) {
  const [state, setState] = useState<State>("loading");
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await unwrap(api.GET("/api/me"));
      if (!cancelled) setState(me.ok ? "ready" : "signedOut");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** The device location is used for this request only; it is put in the form and never stored against the account. */
  function useMyLocation() {
    setError(null);
    if (!navigator.geolocation) return setError(dict.errors.geolocation);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLon(pos.coords.longitude.toFixed(6));
      },
      () => setError(dict.errors.geolocation),
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setState("saving");
    const result = await unwrap(
      api.POST("/api/entities", {
        body: {
          nameAr: nameAr.trim() || null,
          nameEn: nameEn.trim() || null,
          categoryId: categoryId || null,
          longitude: lon.trim() === "" ? null : Number(lon),
          latitude: lat.trim() === "" ? null : Number(lat),
          address: address.trim() || null,
          city: city.trim() || null,
          country: null,
          alternateNames: null,
          fields: null,
        },
      }),
    );
    if (result.ok) return setState("done");
    setError(dict.errors[result.error] ?? dict.errors.unknown);
    setState("ready");
  }

  if (state === "loading") return <p className="text-muted">{dict.loading}</p>;
  if (state === "signedOut")
    return (
      <Card className="space-y-4">
        <p>{dict.signInNeeded}</p>
        <Link href={`/${lang}/sign-in?next=${encodeURIComponent(`/${lang}/add`)}`} className={buttonClass("primary")}>
          {dict.signIn}
        </Link>
      </Card>
    );
  if (state === "done")
    return (
      <Card className="space-y-2">
        <h2 role="status" className="font-heading text-xl font-semibold">
          {dict.doneHeading}
        </h2>
        <p className="text-muted">{dict.doneText}</p>
      </Card>
    );

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <p className="text-muted">{dict.intro}</p>
      <Card className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="add-category" className="font-medium">
            {dict.category}
          </label>
          <select id="add-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
            <option value="" />
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="add-name-ar" className="font-medium">
            {dict.nameAr}
          </label>
          <input id="add-name-ar" value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" maxLength={120} className={field} aria-describedby="add-name-hint" />
        </div>
        <div className="space-y-1">
          <label htmlFor="add-name-en" className="font-medium">
            {dict.nameEn}
          </label>
          <input id="add-name-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" maxLength={120} className={field} aria-describedby="add-name-hint" />
          <p id="add-name-hint" className="text-sm text-muted">
            {dict.nameHint}
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor="add-city" className="font-medium">
            {dict.city}
          </label>
          <input id="add-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} className={field} />
        </div>
        <div className="space-y-1">
          <label htmlFor="add-address" className="font-medium">
            {dict.address}
          </label>
          <input id="add-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} className={field} />
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">{dict.location}</h2>
        <p className="text-sm text-muted">{dict.locationHint}</p>
        <Button type="button" variant="secondary" onClick={useMyLocation}>
          {dict.useLocation}
        </Button>
        <div className="grid grid-cols-2 gap-3" dir="ltr">
          <div className="space-y-1">
            <label htmlFor="add-lat" className="text-sm font-medium">
              {dict.latitude}
            </label>
            <input id="add-lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} className={field} />
          </div>
          <div className="space-y-1">
            <label htmlFor="add-lon" className="text-sm font-medium">
              {dict.longitude}
            </label>
            <input id="add-lon" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} className={field} />
          </div>
        </div>
      </Card>

      {error ? (
        <p role="alert" className="rounded-xl bg-negative-bg p-3 text-sm text-negative">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={state === "saving"} className="w-full">
        {state === "saving" ? dict.saving : dict.submit}
      </Button>
    </form>
  );
}
