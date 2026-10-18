"use client";

import { useState } from "react";
import { VideoPlayer } from "@/components/site/VideoPlayer";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { QueueMedia } from "@/lib/api/types";
import { useConsole } from "./context";
import { Banner, Button, Card, Chip, EmptyState, Icon, LoadState, PageHeader, ReasonForm, useAction, useLoad } from "./ui";

export function MediaQueue() {
  const { t, number } = useConsole();
  const [state, reload] = useLoad("media", () => unwrap<QueueMedia[]>(api.GET("/api/moderation/media")));
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <PageHeader title={t("media.title")} intro={t("media.intro")} right={state.status === "ready" ? <span className="text-sm text-muted" data-testid="queue-total">{t("common.total")}: {number(state.data.length)}</span> : null} />
      <p className="mb-4 text-xs text-muted">{t("proofs.everyOpeningLogged")}</p>
      {notice ? <div className="mb-4"><Banner tone="positive" onClose={() => setNotice(null)}>{notice}</Banner></div> : null}
      <LoadState state={state} reload={reload}>
        {(items) =>
          items.length === 0 ? <EmptyState>{t("media.empty")}</EmptyState> : (
            <div className="space-y-4">{items.map((m) => <MediaCard key={m.id} item={m} onDone={(msg) => { setNotice(msg); reload(); }} />)}</div>
          )
        }
      </LoadState>
    </>
  );
}

function MediaCard({ item, onDone }: { item: QueueMedia; onDone: (message: string) => void }) {
  const { t, has } = useConsole();
  const [rejecting, setRejecting] = useState(false);
  const action = useAction();
  const a = item;

  const approve = () =>
    action.run(
      () => unwrap(api.POST("/api/moderation/media/{id}/approve", { params: { path: { id: item.id } } })),
      () => onDone(t("media.decided")),
      (code) => code === "wrong_state" && onDone(""),
    );
  const reject = (reason: string) =>
    action.run(() => unwrap(api.POST("/api/moderation/media/{id}/reject", { params: { path: { id: item.id } }, body: { reason } })), () => onDone(t("media.decided")));
  const error = action.error;

  return (
    <Card>
      <article data-testid="media-item" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{item.kind}</Chip>
          <Chip tone={a.analysisStatus === "Completed" ? "verified" : "warning"}>{t(`media.analysisStatus.${a.analysisStatus}`)}</Chip>
          {item.protectedForAnonymous ? <Chip tone="verified">{t("media.anonymousProtected")}</Chip> : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            {item.kind === "Video" && item.playlistUrl ? (
              <div className="max-w-xs">
                <VideoPlayer
                  playlistUrl={item.playlistUrl}
                  posterUrl={item.posterUrl}
                  labels={{ play: t("media.play"), pause: t("media.pause"), mute: t("media.mute"), unmute: t("media.unmute"), label: t("media.video") }}
                />
              </div>
            ) : item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className="max-h-96 rounded-2xl border border-border" />
            ) : null}
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{t("media.analysis")}</h3>
            <ul className="space-y-1 text-sm">
              <li>{t("media.faces", { n: a.facesFound })}</li>
              <li>{t("media.children", { n: a.childrenFound })}</li>
              <li>{t("media.plates", { n: a.platesFound })}</li>
              {a.nudity ? <li className="text-negative">{t("media.nudity")}</li> : null}
              {a.violence ? <li className="text-negative">{t("media.violence")}</li> : null}
              {a.personalDataOnScreen ? <li className="text-negative">{t("media.personalData")}</li> : null}
              {a.abusiveSpeech ? <li className="text-negative">{t("media.abusive")}</li> : null}
              {a.personalDataInSpeech ? <li className="text-negative">{t("media.personalSpeech")}</li> : null}
              {a.qualityScore != null ? <li>{t("media.quality", { n: Math.round(a.qualityScore * 100) })}</li> : null}
              {item.blurApplied ? <li>{t("media.blur")}</li> : null}
              {item.voiceChanged ? <li>{t("media.voice")}</li> : null}
              {a.concerns.map((c) => <li key={c} dir="auto" className="text-warning-text">{c}</li>)}
            </ul>
            {item.captions?.ar || item.captions?.en ? (
              <div>
                <h3 className="text-sm font-semibold">{t("media.captions")}</h3>
                <p dir="auto" className="text-sm text-muted">{item.captions?.ar ?? item.captions?.en}</p>
              </div>
            ) : null}
          </div>
        </div>

        {!rejecting ? (
          <>
            {error ? <Banner tone="negative">{has(`media.errors.${error}`) ? t(`media.errors.${error}`) : error}</Banner> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="solid" busy={action.busy} onClick={approve}><Icon name="check" className="size-4" />{t("media.approve")}</Button>
              <Button variant="danger" onClick={() => { setRejecting(true); action.clearError(); }}>{t("media.reject")}</Button>
            </div>
          </>
        ) : (
          <ReasonForm title={t("media.reason")} help={t("common.reasonHelp")} submitLabel={t("media.reject")} busy={action.busy} error={error} onSubmit={reject} onCancel={() => { setRejecting(false); action.clearError(); }} />
        )}
      </article>
    </Card>
  );
}
