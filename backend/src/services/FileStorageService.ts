import { Storage, File } from '@google-cloud/storage';
import crypto from 'crypto';
import { gcp, gcs } from '../config/settings';
import logger from '../logger';

// Check if GCS is configured
if (!gcp.serviceAccountBase64 || !gcp.projectId || !gcs.imageBucket) {
  logger.warn('GCS not configured - file storage disabled. Set GCP_SERVICE_ACCOUNT_BASE64, GCP_PROJECT_ID, and GCS_IMAGE_BUCKET to enable.');
  throw new Error('GCS not configured - file storage disabled. Set GCP_SERVICE_ACCOUNT_BASE64, GCP_PROJECT_ID, and GCS_IMAGE_BUCKET to enable.');
}

// File categories for multimodal processing
export enum FileCategory {
  IMAGE = 'image',
  DOCUMENT = 'document',
  UNSUPPORTED = 'unsupported'
}


export interface StoredFile {
  url: string;           // Presigned GCS URL
  mimeType: string;      // Original MIME type
  category: FileCategory; // How this file should be processed
  filename?: string;     // Original filename (if available)
  sizeBytes?: number;    // File size in bytes
}

// Download result from integrations
export interface FileDownloadResult {
  data: Buffer;
  mimeType: string;
  filename?: string;
}

export type FileDownloadFn = () => Promise<FileDownloadResult>;

// Legacy type aliases for backward compatibility with existing integrations
export type ImageDownloadResult = FileDownloadResult;
export type ImageDownloadFn = FileDownloadFn;

// MIME type to category mapping
const MIME_TYPE_CATEGORIES: Record<string, FileCategory> = {
  // Images (Claude vision)
  'image/png': FileCategory.IMAGE,
  'image/jpeg': FileCategory.IMAGE,
  'image/jpg': FileCategory.IMAGE,
  'image/gif': FileCategory.IMAGE,
  'image/webp': FileCategory.IMAGE,
  'image/bmp': FileCategory.IMAGE,
  'image/svg+xml': FileCategory.IMAGE,
  'image/tiff': FileCategory.IMAGE,

  // Documents (Claude PDF support - visual analysis)
  'application/pdf': FileCategory.DOCUMENT
};

// File extensions for fallback categorization
const EXTENSION_CATEGORIES: Record<string, FileCategory> = {
  // Images
  '.png': FileCategory.IMAGE,
  '.jpg': FileCategory.IMAGE,
  '.jpeg': FileCategory.IMAGE,
  '.gif': FileCategory.IMAGE,
  '.webp': FileCategory.IMAGE,
  '.bmp': FileCategory.IMAGE,
  '.svg': FileCategory.IMAGE,
  '.tiff': FileCategory.IMAGE,
  '.tif': FileCategory.IMAGE,

  // Documents
  '.pdf': FileCategory.DOCUMENT
};

// Presigned URL expiry: 24 hours
const PRESIGNED_URL_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Max file size (32MB - Claude's limit)
const MAX_FILE_SIZE_BYTES = 32 * 1024 * 1024;

// Singleton storage client
let storageClient: Storage | null = null;
let isConfigured = false;

/**
 * Classify a file by its MIME type and/or filename
 */
export function classifyFile(mimeType?: string, filename?: string): FileCategory {
  // Try MIME type first
  const category = classifyFileByMimeType(mimeType);
  if (category !== FileCategory.UNSUPPORTED) {
    return category;
  }
  return classifyFileByExtension(filename);
}

export function classifyFileByMimeType(mimeType?: string): FileCategory {
  if (mimeType) {
    const normalizedMime = mimeType.toLowerCase().split(';')[0].trim();
    if (MIME_TYPE_CATEGORIES[normalizedMime]) {
      return MIME_TYPE_CATEGORIES[normalizedMime];
    }
  }
  return FileCategory.UNSUPPORTED;
}

export function classifyFileByExtension(filename?: string): FileCategory {
  if (filename) {
    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (ext && EXTENSION_CATEGORIES[ext]) {
      return EXTENSION_CATEGORIES[ext];
    }
  }
  return FileCategory.UNSUPPORTED;
}

/**
 * Check if a file type is supported for multimodal processing
 */
export function isSupportedFileType(mimeType?: string, filename?: string): boolean {
  return classifyFile(mimeType, filename) !== FileCategory.UNSUPPORTED;
}

/**
 * Initialize the GCS storage client
 * Returns null if GCS is not configured (graceful degradation)
 */
function getStorageClient(): Storage | null {
  if (storageClient !== null) {
    return storageClient;
  }

  if (!gcp.serviceAccountBase64 || !gcp.projectId || !gcs.imageBucket) {
    throw new Error('GCS not configured - file storage disabled. Set GCP_SERVICE_ACCOUNT_BASE64, GCP_PROJECT_ID, and GCS_IMAGE_BUCKET to enable.');
  }

  try {
    // Decode service account credentials from base64
    const serviceAccountJson = Buffer.from(gcp.serviceAccountBase64, 'base64').toString('utf-8');
    const credentials = JSON.parse(serviceAccountJson);

    storageClient = new Storage({
      projectId: gcp.projectId,
      credentials,
    });
    isConfigured = true;
    logger.info('GCS storage client initialized', { bucket: gcs.imageBucket, prefix: gcs.imagePrefix });
    return storageClient;
  } catch (error) {
    logger.error('Failed to initialize GCS storage client', { error });
    isConfigured = false;
    return null;
  }
}

/**
 * Sanitize a primary key for use as a GCS object name
 * Replaces invalid characters with underscores
 */
function sanitizeObjectKey(primaryKey: string): string {
  // Allow alphanumeric, dots, underscores, hyphens, and forward slashes
  // Replace anything else with underscore
  return primaryKey.replace(/[^a-zA-Z0-9._\-\/]/g, '_');
}

/**
 * Build the full GCS object name from a primary key
 */
function buildObjectName(primaryKey: string): string {
  const sanitized = sanitizeObjectKey(primaryKey);
  if (gcs.imagePrefix) {
    return `${gcs.imagePrefix}/${sanitized}`;
  }
  return sanitized;
}

/**
 * Get the GCS file reference for a primary key
 */
function getFile(primaryKey: string): File | null {
  const storage = getStorageClient();
  if (!storage || !gcs.imageBucket) {
    return null;
  }
  const objectName = buildObjectName(primaryKey);
  return storage.bucket(gcs.imageBucket).file(objectName);
}

/**
 * Generate a presigned URL for reading a GCS object
 * URL is valid for 24 hours
 */
async function generatePresignedUrl(file: File): Promise<string> {
  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + PRESIGNED_URL_EXPIRY_MS,
  });
  return signedUrl;
}

/**
 * Ensure a file is stored in GCS and return a presigned URL
 *
 * This is the main entry point for integrations. It:
 * 1. Checks if the file already exists (by primary key)
 * 2. If exists, returns a presigned URL
 * 3. If not, downloads the file using the provided function, uploads to GCS, returns presigned URL
 *
 * @param primaryKey - Unique identifier for the file (e.g., "gmail/{integrationId}/{md5hash}")
 * @param download - Function that downloads the file and returns bytes + MIME type
 * @returns Presigned URL to access the file, or null if storage failed
 */
export async function ensureStored(
  primaryKey: string,
  download: FileDownloadFn
): Promise<string | null> {
  const file = getFile(primaryKey);

  // If GCS is not configured, return null (graceful degradation)
  if (!file) {
    logger.debug('GCS not configured, skipping file storage', { primaryKey });
    return null;
  }

  try {
    // Check if object already exists
    const [exists] = await file.exists();
    if (exists) {
      logger.debug('File already exists in GCS, generating presigned URL', { primaryKey });
      return await generatePresignedUrl(file);
    }

    // Download the file
    logger.debug('Downloading file for storage', { primaryKey });
    const { data, mimeType, filename } = await download();

    // Check file size
    if (data.length > MAX_FILE_SIZE_BYTES) {
      logger.warn('File exceeds maximum size limit, skipping', {
        primaryKey,
        sizeBytes: data.length,
        maxSizeBytes: MAX_FILE_SIZE_BYTES,
        filename
      });
      return null;
    }

    // Upload to GCS
    await file.save(data, {
      contentType: mimeType,
      metadata: {
        cacheControl: 'public, max-age=86400', // 24 hours
        originalFilename: filename,
      },
    });

    logger.info('File uploaded to GCS', {
      primaryKey,
      mimeType,
      sizeBytes: data.length,
      filename,
      category: classifyFile(mimeType, filename)
    });

    // Generate and return presigned URL
    return await generatePresignedUrl(file);
  } catch (error) {
    logger.error('Error storing file in GCS', { primaryKey, error });
    return null;
  }
}

/**
 * Ensure a file is stored and return full metadata
 */
export async function ensureStoredWithMetadata(
  primaryKey: string,
  download: FileDownloadFn
): Promise<StoredFile | null> {
  const file = getFile(primaryKey);

  if (!file) {
    logger.debug('GCS not configured, skipping file storage', { primaryKey });
    return null;
  }

  try {
    // Check if object already exists
    const [exists] = await file.exists();
    if (exists) {
      const [metadata] = await file.getMetadata();
      const url = await generatePresignedUrl(file);
      const contentType = typeof metadata.contentType === 'string' ? metadata.contentType : undefined;
      const originalFilename = metadata.metadata?.originalFilename;
      const filenameStr = typeof originalFilename === 'string' ? originalFilename : undefined;
      return {
        url,
        mimeType: contentType || 'application/octet-stream',
        category: classifyFile(contentType, filenameStr),
        filename: filenameStr,
        sizeBytes: Number(metadata.size) || undefined,
      };
    }

    // Download the file
    const { data, mimeType, filename } = await download();

    // Check file size
    if (data.length > MAX_FILE_SIZE_BYTES) {
      logger.warn('File exceeds maximum size limit, skipping', {
        primaryKey,
        sizeBytes: data.length,
        maxSizeBytes: MAX_FILE_SIZE_BYTES,
        filename
      });
      return null;
    }

    // Classify the file
    const category = classifyFile(mimeType, filename);
    if (category === FileCategory.UNSUPPORTED) {
      logger.debug('Unsupported file type, skipping', { primaryKey, mimeType, filename });
      return null;
    }

    // Upload to GCS
    await file.save(data, {
      contentType: mimeType,
      metadata: {
        cacheControl: 'public, max-age=86400',
        originalFilename: filename,
      },
    });

    const url = await generatePresignedUrl(file);

    logger.info('File uploaded to GCS', {
      primaryKey,
      mimeType,
      sizeBytes: data.length,
      filename,
      category
    });

    return {
      url,
      mimeType,
      category,
      filename,
      sizeBytes: data.length,
    };
  } catch (error) {
    logger.error('Error storing file in GCS', { primaryKey, error });
    return null;
  }
}

// Helper functions for generating primary keys

/**
 * Generate MD5 hash of a string (for primary key generation)
 */
export function md5Hash(input: string): string {
  return crypto.createHash('md5').update(input, 'utf8').digest('hex');
}

/**
 * Build a primary key for Gmail files
 * Format: gmail/{integrationId}/{md5(messageId/attachmentId)}
 */
export function buildGmailFileKey(
  integrationId: string,
  messageId: string,
  attachmentId: string
): string {
  const hash = md5Hash(`${messageId}/${attachmentId}`);
  return `gmail/${integrationId}/${hash}`;
}

/**
 * Build a primary key for Slack files
 * Format: slack/{teamId}/{md5(fileId)}
 */
export function buildSlackFileKey(teamId: string, fileId: string): string {
  const hash = md5Hash(fileId);
  return `slack/${teamId}/${hash}`;
}

// Legacy alias
export const buildSlackImageKey = buildSlackFileKey;

/**
 * Build a primary key for GitHub files
 * Format: github/{repoId}/{md5(fileUrl)}
 */
export function buildGithubFileKey(repoId: string | number, fileUrl: string): string {
  const hash = md5Hash(fileUrl);
  return `github/${repoId}/${hash}`;
}

// Legacy alias
export const buildGithubImageKey = buildGithubFileKey;

/**
 * Build a primary key for Linear files
 * Format: linear/{organizationId}/{md5(issueId/attachmentId)}
 */
export function buildLinearFileKey(
  organizationId: string,
  issueId: string,
  attachmentId: string
): string {
  const hash = md5Hash(`${issueId}/${attachmentId}`);
  return `linear/${organizationId}/${hash}`;
}

/**
 * Build a primary key for Jira files
 * Format: jira/{integrationId}/{md5(issueKey/attachmentId)}
 */
export function buildJiraFileKey(
  integrationId: string,
  issueKey: string,
  attachmentId: string
): string {
  const hash = md5Hash(`${issueKey}/${attachmentId}`);
  return `jira/${integrationId}/${hash}`;
}

/**
 * Build a primary key for Figma node images
 * Format: figma/{integrationId}/{md5(fileKey/commentId/node)}
 */
export function buildFigmaNodeImageKey(
  integrationId: string,
  fileKey: string,
  commentId: string
): string {
  const hash = md5Hash(`${fileKey}/${commentId}/node`);
  return `figma/${integrationId}/${hash}`;
}

/**
 * Build a primary key for Figma full frame images
 * Format: figma/{integrationId}/{md5(fileKey/commentId/fullFrame)}
 */
export function buildFigmaFullFrameImageKey(
  integrationId: string,
  fileKey: string,
  commentId: string
): string {
  const hash = md5Hash(`${fileKey}/${commentId}/fullFrame`);
  return `figma/${integrationId}/${hash}`;
}

/**
 * Build a primary key for chat file uploads
 * Format: chat/{userId}/{runId}/{uuid}_{filename}
 */
export function buildChatFileKey(
  userId: string,
  runId: string,
  filename: string
): string {
  const uuid = crypto.randomUUID();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `chat/${userId}/${runId}/${uuid}_${sanitizedFilename}`;
}

// Upload URL expiry: 15 minutes (for write operations)
const UPLOAD_URL_EXPIRY_MS = 15 * 60 * 1000;

// Allowed MIME types for chat uploads (images + PDFs)
const ALLOWED_CHAT_UPLOAD_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

/**
 * Check if a MIME type is allowed for chat uploads
 */
export function isAllowedChatUploadType(mimeType: string): boolean {
  return ALLOWED_CHAT_UPLOAD_TYPES.has(mimeType.toLowerCase());
}

/**
 * Generate a presigned URL for uploading a file directly to GCS
 *
 * @param primaryKey - The GCS object key (use buildChatFileKey to generate)
 * @param mimeType - The MIME type of the file being uploaded
 * @param filename - Original filename (for metadata)
 * @returns Upload URL and object key, or null if GCS not configured
 */
export async function generateUploadUrl(
  primaryKey: string,
  mimeType: string,
  filename?: string
): Promise<{ uploadUrl: string; fileKey: string } | null> {
  const file = getFile(primaryKey);

  if (!file) {
    logger.debug('GCS not configured, cannot generate upload URL', { primaryKey });
    return null;
  }

  try {
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + UPLOAD_URL_EXPIRY_MS,
      contentType: mimeType,
    });

    logger.info('Generated upload URL', {
      primaryKey,
      mimeType,
      filename,
      expiresIn: '15 minutes',
    });

    return {
      uploadUrl: signedUrl,
      fileKey: primaryKey,
    };
  } catch (error) {
    logger.error('Error generating upload URL', { primaryKey, error });
    return null;
  }
}

/**
 * Extract the original filename from a chat file key
 * Chat file keys have format: chat/{userId}/{runId}/{uuid}_{filename}
 */
function extractFilenameFromKey(fileKey: string): string | undefined {
  // Match the pattern: anything_{filename} at the end
  const match = fileKey.match(/\/[^\/]+_(.+)$/);
  if (match) {
    // The filename was sanitized (non-alphanumeric replaced with _),
    // but this is still useful as a fallback
    return match[1];
  }
  return undefined;
}

/**
 * Set metadata on an already-uploaded file
 * Used after frontend uploads a file directly to GCS to set the original filename
 *
 * @param fileKey - The GCS object key
 * @param filename - The original filename to store in metadata
 * @returns true if successful, false otherwise
 */
export async function setFileMetadata(
  fileKey: string,
  filename: string
): Promise<boolean> {
  const file = getFile(fileKey);

  if (!file) {
    logger.debug('GCS not configured, cannot set file metadata', { fileKey });
    return false;
  }

  try {
    const [exists] = await file.exists();
    if (!exists) {
      logger.warn('File not found in GCS, cannot set metadata', { fileKey });
      return false;
    }

    await file.setMetadata({
      metadata: {
        originalFilename: filename,
      },
    });

    logger.info('Set file metadata', { fileKey, filename });
    return true;
  } catch (error) {
    logger.error('Error setting file metadata', { fileKey, error });
    return false;
  }
}

/**
 * Get StoredFile metadata for an already-uploaded file by its key
 * Used after frontend uploads a file directly to GCS
 *
 * @param fileKey - The GCS object key
 * @returns StoredFile with presigned read URL and metadata, or null if not found
 */
export async function getStoredFileByKey(fileKey: string): Promise<StoredFile | null> {
  const file = getFile(fileKey);

  if (!file) {
    logger.debug('GCS not configured, cannot get stored file', { fileKey });
    return null;
  }

  try {
    const [exists] = await file.exists();
    if (!exists) {
      logger.warn('File not found in GCS', { fileKey });
      return null;
    }

    const [metadata] = await file.getMetadata();
    const url = await generatePresignedUrl(file);

    const contentType = typeof metadata.contentType === 'string' ? metadata.contentType : 'application/octet-stream';
    const originalFilename = metadata.metadata?.originalFilename;
    // Try to extract filename from metadata, fall back to extracting from key
    const filenameStr = typeof originalFilename === 'string'
      ? originalFilename
      : extractFilenameFromKey(fileKey);

    return {
      url,
      mimeType: contentType,
      category: classifyFile(contentType, filenameStr),
      filename: filenameStr,
      sizeBytes: Number(metadata.size) || undefined,
    };
  } catch (error) {
    logger.error('Error getting stored file by key', { fileKey, error });
    return null;
  }
}
