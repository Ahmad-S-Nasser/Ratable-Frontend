import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/http";
import type { UploadInfo, UploadProgress } from "@/lib/api/types";

export type UploadOutcome = { ok: true; mediaId: string } | { ok: false; error: string; mediaId?: string };

const MAX_TRIES = 6;

/** Sends one piece with progress. The signed address carries its own permission, so no cookie or token is needed. */
function sendPiece(url: string, piece: Blob, start: number, total: number, onBytes: (sent: number) => void, signal: AbortSignal) {
  return new Promise<{ status: number; body: UploadProgress | { error?: string } | null }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Range", `bytes ${start}-${start + piece.size - 1}/${total}`);
    xhr.upload.onprogress = (e) => onBytes(e.loaded);
    xhr.onload = () => {
      let body = null;
      try {
        body = JSON.parse(xhr.responseText) as UploadProgress;
      } catch {
        /* an empty or non-JSON answer */
      }
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(piece);
  });
}

/**
 * Uploads one file in pieces. After a break (a weak mobile network) it asks the server how many bytes arrived and continues from there, so a long
 * video is never sent again from the start. Progress is reported as a share from 0 to 1.
 */
export async function uploadFile(reviewId: string, file: File, onProgress: (share: number) => void, signal: AbortSignal): Promise<UploadOutcome> {
  const kind = file.type.startsWith("video/") ? "Video" : "Photo";
  const created = await unwrap<UploadInfo>(
    api.POST("/api/reviews/{reviewId}/media", { params: { path: { reviewId } }, body: { kind, contentType: file.type, sizeBytes: file.size } }),
  );
  if (!created.ok) return { ok: false, error: created.error };

  const { mediaId, uploadUrl, chunkBytes } = created.data;
  let offset = 0;
  let tries = 0;
  while (offset < file.size) {
    const end = Math.min(file.size, offset + chunkBytes);
    try {
      const { status, body } = await sendPiece(uploadUrl, file.slice(offset, end), offset, file.size, (sent) => onProgress((offset + sent) / file.size), signal);
      if (status === 200) {
        offset = end;
        tries = 0;
        onProgress(offset / file.size);
      } else if (status === 409 && body && "receivedBytes" in body) {
        offset = body.receivedBytes; // resume from what the server has
      } else {
        const code = body && "error" in body && body.error ? body.error : "unknown";
        return { ok: false, error: code, mediaId };
      }
    } catch (error) {
      if (signal.aborted) return { ok: false, error: "aborted", mediaId };
      if (++tries >= MAX_TRIES) return { ok: false, error: "network", mediaId };
      await new Promise((r) => setTimeout(r, 500 * 2 ** tries));
      const state = await unwrap<UploadProgress>(api.GET("/api/media/upload/{token}", { params: { path: { token: uploadUrl.split("/").pop() ?? "" } } }));
      if (state.ok) offset = state.data.receivedBytes;
      void error;
    }
  }
  return { ok: true, mediaId };
}
