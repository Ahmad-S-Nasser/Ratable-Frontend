"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fmt } from "@/i18n/format";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { OwnMedia } from "@/lib/api/types";
import { uploadFile } from "@/lib/upload";

type Dict = {
  intro: string; pick: string; pickHint: string; anonymousNote: string; keepOpen: string; uploading: string; retry: string; delete: string;
  kind: Record<string, string>; status: Record<string, string>; reasons: Record<string, string>; errors: Record<string, string>;
  cover: { heading: string; auto: string; first: string; choose: string; frame: string; hint: string };
};

type Local = { key: string; file: File; progress: number; error?: string; done: boolean };

const WAITING = new Set(["Uploading", "Uploaded", "Processing"]);

/**
 * Photos and video of a review: pick files, watch them upload in pieces (they continue while the person does something else on the page),
 * see what happens to each one, choose the cover of a video, delete. Files are never shown to anyone until a person approves them.
 */
export function MediaManager({ reviewId, anonymous, initialFiles = [], dict }: { reviewId: string; anonymous: boolean; initialFiles?: File[]; dict: Dict }) {
  const [locals, setLocals] = useState<Local[]>([]);
  const [items, setItems] = useState<OwnMedia[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef(new AbortController()); // never aborted: see the effect below
  const started = useRef(new Set<string>());
  const initialStarted = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const result = await unwrap<OwnMedia[]>(api.GET("/api/me/media", { params: { query: { reviewId } } }));
    if (result.ok) setItems(result.data);
  }, [reviewId]);

  const begin = useCallback(
    async (entry: Local) => {
      const outcome = await uploadFile(
        reviewId,
        entry.file,
        (share) => setLocals((all) => all.map((l) => (l.key === entry.key ? { ...l, progress: share } : l))),
        abort.current.signal,
      );
      setLocals((all) =>
        all.map((l) => (l.key === entry.key ? { ...l, done: outcome.ok, progress: outcome.ok ? 1 : l.progress, error: outcome.ok ? undefined : outcome.error } : l)),
      );
      await refresh();
    },
    [reviewId, refresh],
  );

  const add = useCallback(
    (files: File[]) => {
      const entries = files.map((file) => ({ key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, progress: 0, done: false }));
      setLocals((all) => [...all, ...entries]);
      for (const entry of entries) {
        if (started.current.has(entry.key)) continue;
        started.current.add(entry.key);
        void begin(entry);
      }
    },
    [begin],
  );

  useEffect(() => {
    // Starts the files chosen on the review form (once), and reads what the server already has. Uploads are not cancelled when the person
    // moves to another page of the site: they carry on in the background, which is what makes "keep typing while it uploads" work.
    if (initialFiles.length > 0 && !initialStarted.current) {
      initialStarted.current = true;
      add(initialFiles);
    }
    void (async () => {
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on first show
  }, []);

  useEffect(() => {
    // While something is being processed, look again every few seconds.
    if (!items.some((i) => WAITING.has(i.status))) return;
    const timer = setInterval(() => void refresh(), 4000);
    return () => clearInterval(timer);
  }, [items, refresh]);

  async function remove(id: string) {
    setNotice(null);
    await unwrap(api.DELETE("/api/me/media/{id}", { params: { path: { id } } }));
    await refresh();
  }

  async function chooseCover(id: string, choice: "auto" | "first" | "frame", frameIndex?: number) {
    const result = await unwrap<OwnMedia>(api.PUT("/api/me/media/{id}/cover", { params: { path: { id } }, body: { choice, frameIndex: frameIndex ?? null } }));
    if (!result.ok) setNotice(dict.errors[result.error] ?? dict.errors.unknown);
    await refresh();
  }

  const uploading = locals.filter((l) => !l.done && !l.error);
  const failed = locals.filter((l) => l.error);

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <p className="text-sm text-muted">{dict.intro}</p>
        {anonymous ? <p className="rounded-xl bg-tint p-3 text-sm">{dict.anonymousNote}</p> : null}
        <input
          ref={input}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          aria-label={dict.pick}
          onChange={(e) => {
            add(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <Button type="button" variant="secondary" onClick={() => input.current?.click()}>
          {dict.pick}
        </Button>
        <span className="ms-3 text-sm text-muted">{dict.pickHint}</span>
        {uploading.length > 0 ? <p className="text-sm text-muted">{dict.keepOpen}</p> : null}
      </Card>

      {uploading.map((l) => (
        <Card key={l.key} className="space-y-2">
          <p className="text-sm font-medium" role="status">
            {fmt(dict.uploading, { pct: Math.round(l.progress * 100) })}
          </p>
          <progress value={Math.round(l.progress * 100)} max={100} aria-label={dict.uploading.replace("{pct}", "")} className="h-2 w-full accent-[var(--verified)]" />
        </Card>
      ))}

      {failed.map((l) => (
        <Card key={l.key} className="space-y-2">
          <p role="alert" className="text-sm text-negative">
            {dict.errors[l.error ?? "unknown"] ?? dict.errors.unknown}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setLocals((all) => all.filter((x) => x.key !== l.key));
              add([l.file]);
            }}
          >
            {dict.retry}
          </Button>
        </Card>
      ))}

      {notice ? (
        <p role="alert" className="text-sm text-negative">
          {notice}
        </p>
      ) : null}

      <ul className="space-y-4">
        {items.map((m) => (
          <li key={m.id}>
            <Card className="space-y-3" >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {dict.kind[m.kind] ?? m.kind}
                  {m.durationSeconds ? ` · ${Math.round(m.durationSeconds)}s` : ""}
                </p>
                <span data-testid={`media-status-${m.status}`} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium">
                  {dict.status[m.status] ?? m.status}
                </span>
              </div>
              {m.rejectionReason ? <p className="text-sm text-negative">{m.moderatorReason ?? dict.reasons[m.rejectionReason] ?? dict.reasons.processing_failed}</p> : null}
              {m.failureReason ? <p className="text-sm text-negative">{dict.reasons[m.failureReason] ?? dict.reasons.processing_failed}</p> : null}

              {m.kind === "Video" && m.candidateFrames > 0 ? (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">{dict.cover.heading}</legend>
                  <p className="text-xs text-muted">{dict.cover.hint}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant={m.cover === "Auto" ? "primary" : "secondary"} aria-pressed={m.cover === "Auto"} onClick={() => void chooseCover(m.id, "auto")}>
                      {dict.cover.auto}
                    </Button>
                    <Button type="button" variant="secondary" aria-pressed={m.cover === "First"} onClick={() => void chooseCover(m.id, "first")}>
                      {dict.cover.first}
                    </Button>
                  </div>
                  <ul className="flex gap-2 overflow-x-auto pb-1" aria-label={dict.cover.choose}>
                    {Array.from({ length: m.candidateFrames }, (_, i) => (
                      <li key={i}>
                        <button type="button" onClick={() => void chooseCover(m.id, "frame", i)} aria-pressed={m.cover === "Frame" && m.coverFrameIndex === i} className="block rounded-lg border border-border p-0.5 aria-pressed:border-verified">
                          {/* eslint-disable-next-line @next/next/no-img-element -- a private preview from the API */}
                          <img src={`/api/me/media/${m.id}/preview/poster_${i}.jpg`} alt={fmt(dict.cover.frame, { n: i + 1 })} width={72} height={128} loading="lazy" className="h-32 w-[72px] rounded-md object-cover" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ) : null}

              <Button type="button" variant="ghost" onClick={() => void remove(m.id)}>
                {dict.delete}
              </Button>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
