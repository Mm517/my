import { Router, type IRouter, type Request, type Response } from "express";
import { RequestUploadUrlBody } from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Auth is now required (the old Replit-era route allowed anonymous
 * requests — flagged as a risk in MIGRATION_MAP.md and fixed here).
 * Returns a Supabase Storage signed-upload token; the client finishes the
 * upload itself via
 *   supabase.storage.from("chat-attachments").uploadToSignedUrl(objectPath, token, file)
 * so the file bytes never pass through this server.
 */
router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    const { objectPath, token, uploadUrl } = await objectStorageService.createUploadSlot(
      req.user!.id,
      name,
    );

    res.json({
      uploadUrl,
      token,
      objectPath,
      bucket: "chat-attachments",
      metadata: { name, size, contentType },
    });
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/objects/:objectPath(*)
 *
 * Issues a short-lived signed download URL and redirects to it, after
 * verifying the caller owns the folder (or is an admin) — same ownership
 * rule enforced by the storage.objects RLS policies for any direct access.
 */
router.get("/storage/objects/*path", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const objectPath = Array.isArray(raw) ? raw.join("/") : raw;

    const isOwner = objectStorageService.isOwnedBy(objectPath, req.user!.id);
    if (!isOwner && req.user!.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const signedUrl = await objectStorageService.createDownloadUrl(objectPath);
    res.redirect(signedUrl);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
