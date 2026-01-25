import { Request, Response } from "express";
import {
  generateUploadUrl,
  buildChatFileKey,
  isAllowedChatUploadType,
  isFileStorageConfigured,
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

  // Check if file storage is configured
  if (!isFileStorageConfigured()) {
    logger.warn("File upload requested but GCS not configured");
    return res.status(503).json({
      error: "File storage is not configured. Please contact your administrator."
    });
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
