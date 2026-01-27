import { Request, Response } from "express";
import {
  generateUploadUrl,
  buildChatFileKey,
  isAllowedChatUploadType,
  setFileMetadata,
} from "../services/FileStorageService";
import logger from "../logger";

/**
 * Request body for generating an upload URL
 */
interface UploadUrlRequest {
  filename: string;
  mimeType: string;
  runId: string;
}

/**
 * Response for upload URL generation
 */
interface UploadUrlResponse {
  uploadUrl: string;
  fileKey: string;
}

/**
 * Generate a presigned URL for direct file upload to GCS
 *
 * POST /files/upload-url
 * Body: { filename: string, mimeType: string, runId: string }
 * Response: { uploadUrl: string, fileKey: string }
 */
export async function getUploadUrl(req: Request, res: Response) {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Validate request body
  const { filename, mimeType, runId } = req.body as UploadUrlRequest;

  if (!filename || typeof filename !== "string") {
    return res.status(400).json({ error: "filename is required" });
  }

  if (!mimeType || typeof mimeType !== "string") {
    return res.status(400).json({ error: "mimeType is required" });
  }

  if (!runId || typeof runId !== "string") {
    return res.status(400).json({ error: "runId is required" });
  }

  // Validate file type (only images and PDFs allowed for chat uploads)
  if (!isAllowedChatUploadType(mimeType)) {
    return res.status(400).json({
      error: "Unsupported file type. Only images (PNG, JPG, GIF, WEBP) and PDFs are allowed.",
      allowedTypes: ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]
    });
  }

  try {
    // Generate a unique file key
    const fileKey = buildChatFileKey(user.id, runId, filename);

    // Generate presigned upload URL
    const result = await generateUploadUrl(fileKey, mimeType, filename);

    if (!result) {
      logger.error("Failed to generate upload URL", { userId: user.id, runId, filename });
      return res.status(500).json({ error: "Failed to generate upload URL" });
    }

    logger.info("Generated upload URL for chat file", {
      userId: user.id,
      runId,
      filename,
      mimeType,
      fileKey: result.fileKey,
    });

    const response: UploadUrlResponse = {
      uploadUrl: result.uploadUrl,
      fileKey: result.fileKey,
    };

    return res.json(response);
  } catch (error) {
    logger.error("Error generating upload URL", { error, userId: user.id, runId, filename });
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Request body for confirming an upload
 */
interface ConfirmUploadRequest {
  fileKey: string;
  filename: string;
}

/**
 * Confirm a file upload and set metadata (original filename)
 * Should be called after the browser successfully uploads to GCS
 *
 * POST /files/confirm-upload
 * Body: { fileKey: string, filename: string }
 * Response: { success: boolean }
 */
export async function confirmUpload(req: Request, res: Response) {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { fileKey, filename } = req.body as ConfirmUploadRequest;

  if (!fileKey || typeof fileKey !== "string") {
    return res.status(400).json({ error: "fileKey is required" });
  }

  if (!filename || typeof filename !== "string") {
    return res.status(400).json({ error: "filename is required" });
  }

  // Verify the file belongs to this user (chat files have format: chat/{userId}/...)
  if (!fileKey.startsWith(`chat/${user.id}/`)) {
    logger.warn("User attempted to confirm upload for file they don't own", {
      userId: user.id,
      fileKey,
    });
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const success = await setFileMetadata(fileKey, filename);

    if (!success) {
      logger.warn("Failed to set file metadata", { userId: user.id, fileKey, filename });
      return res.status(404).json({ error: "File not found or metadata could not be set" });
    }

    logger.info("Confirmed file upload with metadata", {
      userId: user.id,
      fileKey,
      filename,
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error("Error confirming upload", { error, userId: user.id, fileKey, filename });
    return res.status(500).json({ error: "Internal server error" });
  }
}
