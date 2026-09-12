import { randomUUID } from "crypto";
import { supabaseAdmin } from "./supabaseAdmin";

export const CHAT_ATTACHMENTS_BUCKET = "chat-attachments";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

/**
 * Object storage backed by the Supabase Storage bucket `chat-attachments`
 * (created + RLS-protected in supabase/migrations/001_initial_schema.sql).
 *
 * Every object lives under `<user_id>/<uuid>-<filename>` so the storage RLS
 * policies (folder = auth.uid()) map 1:1 onto ownership. Because uploads are
 * signed by the service role here, folder ownership is enforced in
 * `requireAuth` + this class rather than by RLS at signing time — RLS still
 * protects any *direct* client access to the bucket.
 */
export class ObjectStorageService {
  /**
   * Creates a signed upload slot for `userId` and returns the storage path
   * plus the upload token the client uses with
   * `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)`.
   */
  async createUploadSlot(userId: string, originalName: string) {
    const safeName = originalName.replace(/[^\w.\-]+/g, "_").slice(-120);
    const objectPath = `${userId}/${randomUUID()}-${safeName}`;

    const { data, error } = await supabaseAdmin.storage
      .from(CHAT_ATTACHMENTS_BUCKET)
      .createSignedUploadUrl(objectPath);

    if (error || !data) {
      throw new Error(`Failed to create signed upload URL: ${error?.message}`);
    }

    return {
      objectPath, // e.g. "3f2a.../<uuid>-photo.png" — store this, not the signed URL
      token: data.token,
      uploadUrl: data.signedUrl,
    };
  }

  /** Owner check: object paths are namespaced as "<user_id>/...". */
  isOwnedBy(objectPath: string, userId: string): boolean {
    return objectPath.split("/")[0] === userId;
  }

  async createDownloadUrl(objectPath: string, ttlSec = 3600): Promise<string> {
    const { data, error } = await supabaseAdmin.storage
      .from(CHAT_ATTACHMENTS_BUCKET)
      .createSignedUrl(objectPath, ttlSec);

    if (error || !data?.signedUrl) {
      throw new ObjectNotFoundError();
    }
    return data.signedUrl;
  }

  async deleteObject(objectPath: string): Promise<void> {
    await supabaseAdmin.storage.from(CHAT_ATTACHMENTS_BUCKET).remove([objectPath]);
  }
}
