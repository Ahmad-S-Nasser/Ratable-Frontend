"use client";

import { useState } from "react";
import { useConsole } from "./context";
import { Banner, Button, Card, Chip, EmptyState, Field, PageHeader, TextArea, TextInput } from "./ui";

type Item = { line: number; outcome: string; name: string | null; entityId: string | null; matchedEntityId: string | null; score: number | null; reason: string | null; changed: boolean | null };
type Report = { dryRun: boolean; batch: string; total: number; created: number; merged: number; needsReview: number; skipped: number; items: Item[] };

/**
 * The seed importer (P11). Paste or open a CSV or JSON file, check it first (a dry run writes nothing and reports exactly what a real run would do), then import.
 * The file is sent as text, so it is not part of the JSON schema and goes through fetch.
 */
export function SeedImport() {
  const { t, has, number } = useConsole();
  const [text, setText] = useState("");
  const [batch, setBatch] = useState("");
  const [checked, setChecked] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const query = new URLSearchParams({ dryRun: String(dryRun) });
      if (batch.trim()) query.set("batch", batch.trim());
      const response = await fetch(`/api/admin/import/entities?${query}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "text/plain" }, body: text });
      const body = (await response.json().catch(() => null)) as (Report & { error?: string }) | null;
      if (!response.ok || !body) {
        const code = body?.error ?? "unknown";
        setError(has(`import.errors.${code}`) ? t(`import.errors.${code}`) : t("import.errors.unknown"));
      } else {
        setReport(body);
        setChecked(dryRun ? text : null);
      }
    } catch {
      setError(t("import.errors.network"));
    }
    setBusy(false);
  }

  async function openFile(file: File | undefined) {
    if (!file) return;
    setText(await file.text());
    setReport(null);
    setChecked(null);
  }

  const canImport = report?.dryRun === true && checked === text && text.length > 0 && report.created + report.merged + report.needsReview > 0;

  return (
    <>
      <PageHeader title={t("import.heading")} intro={t("import.intro")} />
      <Card className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <a className="font-medium text-link underline" href="/api/admin/import/sample?format=csv" download="seed-sample.csv">{t("import.sampleCsv")}</a>
          <a className="font-medium text-link underline" href="/api/admin/import/sample?format=json" download="seed-sample.json">{t("import.sampleJson")}</a>
        </div>
        <Field label={t("import.file")} htmlFor="import-file">
          <input id="import-file" type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => void openFile(e.target.files?.[0])} className="block w-full text-sm" />
        </Field>
        <Field label={t("import.text")} htmlFor="import-text" help={t("import.textHelp")}>
          <TextArea id="import-text" rows={8} dir="ltr" value={text} onChange={(e) => { setText(e.target.value); setReport(null); setChecked(null); }} />
        </Field>
        <Field label={t("import.batch")} htmlFor="import-batch" help={t("import.batchHelp")}>
          <TextInput id="import-batch" dir="ltr" value={batch} onChange={(e) => setBatch(e.target.value)} />
        </Field>
        {error ? <Banner tone="negative">{error}</Banner> : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" busy={busy} disabled={!text.trim()} onClick={() => void run(true)}>{t("import.check")}</Button>
          <Button variant="solid" busy={busy} disabled={!canImport} onClick={() => void run(false)}>{t("import.run")}</Button>
        </div>
        <p className="text-xs text-muted">{t("import.runHelp")}</p>
      </Card>

      {report ? (
        <section aria-labelledby="import-report" className="space-y-4" data-testid="import-report">
          <h2 id="import-report" className="font-heading text-xl font-semibold">{report.dryRun ? t("import.reportDry") : t("import.reportDone")}</h2>
          <div className="flex flex-wrap gap-2">
            <Chip tone="verified">{t("import.created")}: {number(report.created)}</Chip>
            <Chip>{t("import.merged")}: {number(report.merged)}</Chip>
            <Chip tone="warning">{t("import.review")}: {number(report.needsReview)}</Chip>
            <Chip tone="negative">{t("import.skipped")}: {number(report.skipped)}</Chip>
            <Chip>{t("import.batchName")}: {report.batch}</Chip>
          </div>
          {report.items.length === 0 ? <EmptyState>{t("common.empty")}</EmptyState> : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-start">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-start">{t("import.line")}</th>
                    <th scope="col" className="px-4 py-2 text-start">{t("import.outcome")}</th>
                    <th scope="col" className="px-4 py-2 text-start">{t("import.name")}</th>
                    <th scope="col" className="px-4 py-2 text-start">{t("import.detail")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.slice(0, 500).map((i) => (
                    <tr key={i.line} className="border-t border-border" data-outcome={i.outcome}>
                      <td className="px-4 py-2">{number(i.line)}</td>
                      <td className="px-4 py-2">{t(`import.outcomes.${i.outcome}`)}</td>
                      <td className="px-4 py-2" dir="auto">{i.name ?? "—"}</td>
                      <td className="px-4 py-2 text-muted" dir="ltr">
                        {i.reason ? (has(`import.reasons.${i.reason.split(":")[0]}`) ? t(`import.reasons.${i.reason.split(":")[0]}`) : i.reason) : ""}
                        {i.reason?.includes(":") ? ` (${i.reason.split(":")[1]})` : ""}
                        {i.matchedEntityId ? ` · ${i.matchedEntityId}` : ""}
                        {i.score !== null ? ` · ${Math.round(i.score * 100)}%` : ""}
                        {i.outcome === "merged" ? ` · ${i.changed ? t("import.filled") : t("import.unchanged")}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {report.items.length > 500 ? <p className="text-sm text-muted">{t("import.firstRows", { n: 500 })}</p> : null}
        </section>
      ) : null}
    </>
  );
}
