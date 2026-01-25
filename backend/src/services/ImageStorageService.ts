/**
 * ImageStorageService
 *
 * Handles downloading, storing, and serving images from GCS for multimodal support.
 * Provides a reusable interface for all integrations (Gmail, Slack, GitHub, Linear, Jira, Figma).
 *
 * Key features:
 * - Deduplication via primary key (avoids re-uploading same image)
 * - Presigned URL generation (24h expiry, read-only)
 * - Per-image error handling (failures don't block other images)
 */

import { Storage, File } from '@google-cloud/storage';
import crypto from 'crypto';
import { gcp, gcs } from '../config/settings';
import logger from '../logger';

// Types exported for use by integrations
export interface ImageDownloadResult {
  data: Buffer;
  mimeType: string;
}

export type ImageDownloadFn = () => Promise<ImageDownloadResult>;

// Presigned URL expiry: 24 hours
const PRESIGNED_URL_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Max concurrent image operations
const MAX_CONCURRENT_OPERATIONS = 5;

// Singleton storage client
let storageClient: Storage | null = null;
let isConfigured = false;

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
    logger.warn('GCS not configured - image storage disabled. Set GCP_SERVICE_ACCOUNT_BASE64, GCP_PROJECT_ID, and GCS_IMAGE_BUCKET to enable.');
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
 * Check if image storage is configured and available
 */
export function isImageStorageConfigured(): boolean {
  if (storageClient === null && !isConfigured) {
    getStorageClient(); // Attempt initialization
  }
  return isConfigured;
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
 * Ensure an image is stored in GCS and return a presigned URL
 *
 * This is the main entry point for integrations. It:
 * 1. Checks if the image already exists (by primary key)
 * 2. If exists, returns a presigned URL
 * 3. If not, downloads the image using the provided function, uploads to GCS, returns presigned URL
 *
 * @param primaryKey - Unique identifier for the image (e.g., "gmail/{integrationId}/{md5hash}")
 * @param download - Function that downloads the image and returns bytes + MIME type
 * @returns Presigned URL to access the image, or null if storage failed
 */
export async function ensureStored(
  primaryKey: string,
  download: ImageDownloadFn
): Promise<string | null> {
  const file = getFile(primaryKey);

  // If GCS is not configured, return null (graceful degradation)
  if (!file) {
    logger.debug('GCS not configured, skipping image storage', { primaryKey });
    return null;
  }

  try {
    // Check if object already exists
    const [exists] = await file.exists();
    if (exists) {
      logger.debug('Image already exists in GCS, generating presigned URL', { primaryKey });
      return await generatePresignedUrl(file);
    }

    // Download the image
    logger.debug('Downloading image for storage', { primaryKey });
    const { data, mimeType } = await download();

    // Upload to GCS
    await file.save(data, {
      contentType: mimeType,
      metadata: {
        cacheControl: 'public, max-age=86400', // 24 hours
      },
    });

    logger.info('Image uploaded to GCS', {
      primaryKey,
      mimeType,
      sizeBytes: data.length
    });

    // Generate and return presigned URL
    return await generatePresignedUrl(file);
  } catch (error) {
    logger.error('Error storing image in GCS', { primaryKey, error });
    return null;
  }
}

/**
 * Process multiple images with concurrency control
 * Returns an array of presigned URLs (null for failed images)
 */
export async function ensureStoredBatch(
  images: Array<{ primaryKey: string; download: ImageDownloadFn }>
): Promise<Array<string | null>> {
  if (!isImageStorageConfigured()) {
    return images.map(() => null);
  }

  // Process in batches to limit concurrency
  const results: Array<string | null> = [];

  for (let i = 0; i < images.length; i += MAX_CONCURRENT_OPERATIONS) {
    const batch = images.slice(i, i + MAX_CONCURRENT_OPERATIONS);
    const batchResults = await Promise.all(
      batch.map(({ primaryKey, download }) =>
        ensureStored(primaryKey, download).catch(error => {
          logger.error('Error in batch image storage', { primaryKey, error });
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
 * Build a primary key for Gmail images
 * Format: gmail/{integrationId}/{md5(messageId/attachmentId)}
 */
export function buildGmailImageKey(
  integrationId: string,
  messageId: string,
  attachmentId: string
): string {
  const hash = md5Hash(`${messageId}/${attachmentId}`);
  return `gmail/${integrationId}/${hash}`;
}

/**
 * Build a primary key for Slack images
 * Format: slack/{teamId}/{md5(fileId)}
 */
export function buildSlackImageKey(teamId: string, fileId: string): string {
  const hash = md5Hash(fileId);
  return `slack/${teamId}/${hash}`;
}

/**
 * Build a primary key for GitHub images
 * Format: github/{repoId}/{md5(imageUrl)}
 */
export function buildGithubImageKey(repoId: string | number, imageUrl: string): string {
  const hash = md5Hash(imageUrl);
  return `github/${repoId}/${hash}`;
}

/**
 * Build a primary key for Linear images
 * Format: linear/{organizationId}/{md5(issueId/attachmentId)}
 */
export function buildLinearImageKey(
  organizationId: string,
  issueId: string,
  attachmentId: string
): string {
  const hash = md5Hash(`${issueId}/${attachmentId}`);
  return `linear/${organizationId}/${hash}`;
}

/**
 * Build a primary key for Jira images
 * Format: jira/{integrationId}/{md5(issueKey/attachmentId)}
 */
export function buildJiraImageKey(
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
