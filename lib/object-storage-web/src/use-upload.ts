import { useCallback, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

interface UploadSlotResponse {
  uploadUrl: string;
  token: string;
  objectPath: string;
  bucket: string;
  metadata: UploadMetadata;
}

export interface UploadResult {
  objectPath: string;
  bucket: string;
  metadata: UploadMetadata;
}

interface UseUploadOptions {
  /** Supabase client used to complete the upload directly to Storage. */
  supabase: SupabaseClient;
  /** Base path where the storage routes are mounted (default: "/api/storage") */
  basePath?: string;
  /** Async fn returning request headers (e.g. Authorization: Bearer <jwt>) */
  authHeaders?: () => Promise<Record<string, string>>;
  onSuccess?: (result: UploadResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Two-step upload flow against Supabase Storage:
 * 1. Ask our backend for a signed upload slot (auth required — folder is
 *    the caller's own user id, enforced server-side in objectStorage.ts).
 * 2. Upload the file bytes directly to Supabase Storage using that slot's
 *    token via `uploadToSignedUrl` — the file never touches our server.
 */
export function useUpload(options: UseUploadOptions) {
  const basePath = options.basePath ?? "/api/storage";
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const requestUploadSlot = useCallback(
    async (file: File): Promise<UploadSlotResponse> => {
      const headers = await (options.authHeaders?.() ?? Promise.resolve({}));
      const response = await fetch(`${basePath}/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get upload URL");
      }

      return response.json();
    },
    [basePath, options],
  );

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        setProgress(10);
        const slot = await requestUploadSlot(file);

        setProgress(40);
        const { error: uploadError } = await options.supabase.storage
          .from(slot.bucket)
          .uploadToSignedUrl(slot.objectPath, slot.token, file, {
            contentType: file.type || "application/octet-stream",
          });

        if (uploadError) throw uploadError;

        setProgress(100);
        const result: UploadResult = {
          objectPath: slot.objectPath,
          bucket: slot.bucket,
          metadata: slot.metadata,
        };
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [requestUploadSlot, options],
  );

  return { uploadFile, isUploading, error, progress };
}
