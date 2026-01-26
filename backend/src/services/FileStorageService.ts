/**
 * FileStorageService
 *
 * Handles downloading, storing, and serving files (images and documents) from GCS for multimodal support.
 * Provides a reusable interface for all integrations (Gmail, Slack, GitHub, Linear, Jira, Figma).
 *
 * Supported file types:
 * - Images: PNG, JPG, JPEG, GIF, WEBP, BMP, SVG (type: 'image')
 * - Documents: PDF (type: 'document' - Claude can process visually)
 * - Text files: TXT, MD, CSV (type: 'text' - content extracted as plain text)
 * - Office documents: DOCX, XLSX (type: 'text' - content extracted as plain text)
 *
 * Key features:
 * - Deduplication via primary key (avoids re-uploading same file)
 * - Presigned URL generation (24h expiry, read-only)
 * - Per-file error handling (failures don't block other files)
 * - File type classification for downstream processing
 */

import { Storage, File } from '@google-cloud/storage';
import crypto from 'crypto';
import { gcp, gcs } from '../config/settings';
import logger from '../logger';

// File categories for multimodal processing
export type FileCategory = 'image' | 'document' | 'text' | 'unsupported';

// Stored file result with URL and metadata
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
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/bmp': 'image',
  'image/svg+xml': 'image',
  'image/tiff': 'image',

  // Documents (Claude PDF support - visual analysis)
  'application/pdf': 'document',

  // Text files (extract content as plain text)
  'text/plain': 'text',
  'text/markdown': 'text',
  'text/csv': 'text',
  'text/html': 'text',
  'application/json': 'text',

  // Office documents (need text extraction - treat as text for content inclusion)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'text', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'text', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'text', // .pptx
  'application/msword': 'text', // .doc
  'application/vnd.ms-excel': 'text', // .xls
  'application/vnd.ms-powerpoint': 'text', // .ppt

  // Google Docs formats
  'application/vnd.google-apps.document': 'text',
  'application/vnd.google-apps.spreadsheet': 'text',
  'application/vnd.google-apps.presentation': 'text',
};

// File extensions for fallback categorization
const EXTENSION_CATEGORIES: Record<string, FileCategory> = {
  // Images
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.bmp': 'image',
  '.svg': 'image',
  '.tiff': 'image',
  '.tif': 'image',

  // Documents
  '.pdf': 'document',

  // Text
  '.txt': 'text',
  '.md': 'text',
  '.markdown': 'text',
  '.csv': 'text',
  '.json': 'text',
  '.html': 'text',
  '.htm': 'text',
  '.xml': 'text',

  // Office
  '.docx': 'text',
  '.doc': 'text',
  '.xlsx': 'text',
  '.xls': 'text',
  '.pptx': 'text',
  '.ppt': 'text',
};

// Presigned URL expiry: 24 hours
const PRESIGNED_URL_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Max concurrent file operations
const MAX_CONCURRENT_OPERATIONS = 5;

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
  if (mimeType) {
    const normalizedMime = mimeType.toLowerCase().split(';')[0].trim();

    // Check exact match
    if (MIME_TYPE_CATEGORIES[normalizedMime]) {
      return MIME_TYPE_CATEGORIES[normalizedMime];
    }

    // Check prefix for generic image types
    if (normalizedMime.startsWith('image/')) {
      return 'image';
    }

    // Check prefix for text types
    if (normalizedMime.startsWith('text/')) {
      return 'text';
    }
  }

  // Fall back to filename extension
  if (filename) {
    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (ext && EXTENSION_CATEGORIES[ext]) {
      return EXTENSION_CATEGORIES[ext];
    }
  }

  return 'unsupported';
}

/**
 * Check if a file type is supported for multimodal processing
 */
export function isSupportedFileType(mimeType?: string, filename?: string): boolean {
  return classifyFile(mimeType, filename) !== 'unsupported';
}

/**
 * Check if a MIME type represents an image
 */
export function isImageMimeType(mimeType: string): boolean {
  return classifyFile(mimeType) === 'image';
}

/**
 * Check if a MIME type represents a document (PDF)
 */
export function isDocumentMimeType(mimeType: string): boolean {
  return classifyFile(mimeType) === 'document';
}

/**
 * Check if a MIME type represents a text file
 */
export function isTextMimeType(mimeType: string): boolean {
  return classifyFile(mimeType) === 'text';
}

/**
 * Initialize the GCS storage client
 * Returns null if GCS is not configured (graceful degradation)
 */
function getStorageClient(): Storage | null {
  if (storageClient !== null) {
    return storageClient;
  }

  // Check if GCS is configured
  if (!gcp.serviceAccountBase64 || !gcp.projectId || !gcs.imageBucket) {
    logger.warn('GCS not configured - file storage disabled. Set GCP_SERVICE_ACCOUNT_BASE64, GCP_PROJECT_ID, and GCS_IMAGE_BUCKET to enable.');
    isConfigured = false;
    return null;
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
 * Check if file storage is configured and available
 */
export function isFileStorageConfigured(): boolean {
  if (storageClient === null && !isConfigured) {
    getStorageClient(); // Attempt initialization
  }
  return isConfigured;
}

// Legacy alias for backward compatibility
export const isImageStorageConfigured = isFileStorageConfigured;

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
 * Get a presigned URL for an existing object (without re-downloading)
 * Returns null if the object doesn't exist or GCS is not configured
 */
export async function getPresignedUrl(primaryKey: string): Promise<string | null> {
  const file = getFile(primaryKey);
  if (!file) {
    return null;
  }

  try {
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }
    return await generatePresignedUrl(file);
  } catch (error) {
    logger.error('Error getting presigned URL', { primaryKey, error });
    return null;
  }
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
    if (category === 'unsupported') {
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

/**
 * Process multiple files with concurrency control
 * Returns an array of stored file metadata (null for failed files)
 */
export async function ensureStoredBatch(
  files: Array<{ primaryKey: string; download: FileDownloadFn }>
): Promise<Array<string | null>> {
  if (!isFileStorageConfigured()) {
    return files.map(() => null);
  }

  // Process in batches to limit concurrency
  const results: Array<string | null> = [];

  for (let i = 0; i < files.length; i += MAX_CONCURRENT_OPERATIONS) {
    const batch = files.slice(i, i + MAX_CONCURRENT_OPERATIONS);
    const batchResults = await Promise.all(
      batch.map(({ primaryKey, download }) =>
        ensureStored(primaryKey, download).catch(error => {
          logger.error('Error in batch file storage', { primaryKey, error });
          return null;
        })
      )
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Process multiple files with full metadata
 */
export async function ensureStoredBatchWithMetadata(
  files: Array<{ primaryKey: string; download: FileDownloadFn }>
): Promise<Array<StoredFile | null>> {
  if (!isFileStorageConfigured()) {
    return files.map(() => null);
  }

  const results: Array<StoredFile | null> = [];

  for (let i = 0; i < files.length; i += MAX_CONCURRENT_OPERATIONS) {
    const batch = files.slice(i, i + MAX_CONCURRENT_OPERATIONS);
    const batchResults = await Promise.all(
      batch.map(({ primaryKey, download }) =>
        ensureStoredWithMetadata(primaryKey, download).catch(error => {
          logger.error('Error in batch file storage', { primaryKey, error });
          return null;
        })
      )
    );
    results.push(...batchResults);
  }

  return results;
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

// Legacy alias
export const buildGmailImageKey = buildGmailFileKey;

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

// Legacy alias
export const buildLinearImageKey = buildLinearFileKey;

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

// Legacy alias
export const buildJiraImageKey = buildJiraFileKey;

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
    // Note: We don't use extensionHeaders for x-goog-content-length-range because
    // that would require the client to send the same header during upload.
    // File size validation is done client-side and server-side after upload instead.
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
    const filenameStr = typeof originalFilename === 'string' ? originalFilename : undefined;

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
