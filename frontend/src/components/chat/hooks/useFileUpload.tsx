import { useState, useCallback } from 'react';
import { BackendProvider } from '../../../services/backend';
import { UploadedFile } from '../../../shared/ModelEvents';

// Allowed MIME types for chat uploads
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

// Max file size: 20MB
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export interface PendingFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
  uploadedFile?: UploadedFile;
  previewUrl?: string;
}

interface UseFileUploadOptions {
  runId: string;
  maxFiles?: number;
}

export function useFileUpload({ runId, maxFiles = 5 }: UseFileUploadOptions) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return 'Unsupported file type. Only images (PNG, JPG, GIF, WEBP) and PDFs are allowed.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`;
    }
    return null;
  }, []);

  const addFile = useCallback((file: File) => {
    const error = validateFile(file);
    const id = crypto.randomUUID();

    // Create preview URL for images
    let previewUrl: string | undefined;
    if (file.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(file);
    }

    const pendingFile: PendingFile = {
      id,
      file,
      status: error ? 'error' : 'pending',
      progress: 0,
      error: error || undefined,
      previewUrl,
    };

    setPendingFiles(prev => {
      if (prev.length >= maxFiles) {
        return prev;
      }
      return [...prev, pendingFile];
    });

    return pendingFile;
  }, [validateFile, maxFiles]);

  const removeFile = useCallback((id: string) => {
    setPendingFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const clearFiles = useCallback(() => {
    setPendingFiles(prev => {
      prev.forEach(f => {
        if (f.previewUrl) {
          URL.revokeObjectURL(f.previewUrl);
        }
      });
      return [];
    });
  }, []);

  const uploadFile = useCallback(async (pendingFile: PendingFile): Promise<UploadedFile | null> => {
    if (pendingFile.status === 'error') {
      return null;
    }

    // Update status to uploading
    setPendingFiles(prev => prev.map(f =>
      f.id === pendingFile.id ? { ...f, status: 'uploading' as const, progress: 0 } : f
    ));

    try {
      // Get presigned upload URL
      const { uploadUrl, fileKey } = await BackendProvider.getFileUploadUrl(
        pendingFile.file.name,
        pendingFile.file.type,
        runId
      );

      // Upload directly to GCS
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': pendingFile.file.type,
        },
        body: pendingFile.file,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const uploadedFile: UploadedFile = {
        fileKey,
        filename: pendingFile.file.name,
        mimeType: pendingFile.file.type,
      };

      // Update status to completed
      setPendingFiles(prev => prev.map(f =>
        f.id === pendingFile.id
          ? { ...f, status: 'completed' as const, progress: 100, uploadedFile }
          : f
      ));

      return uploadedFile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';

      // Update status to error
      setPendingFiles(prev => prev.map(f =>
        f.id === pendingFile.id
          ? { ...f, status: 'error' as const, error: errorMessage }
          : f
      ));

      return null;
    }
  }, [runId]);

  const uploadAllPending = useCallback(async (): Promise<UploadedFile[]> => {
    const filesToUpload = pendingFiles.filter(f => f.status === 'pending');
    if (filesToUpload.length === 0) {
      // Return already completed files
      return pendingFiles
        .filter(f => f.status === 'completed' && f.uploadedFile)
        .map(f => f.uploadedFile!);
    }

    setIsUploading(true);

    try {
      const results = await Promise.all(filesToUpload.map(uploadFile));

      // Combine newly uploaded files with previously completed ones
      const allUploaded = [
        ...pendingFiles
          .filter(f => f.status === 'completed' && f.uploadedFile)
          .map(f => f.uploadedFile!),
        ...results.filter((r): r is UploadedFile => r !== null),
      ];

      return allUploaded;
    } finally {
      setIsUploading(false);
    }
  }, [pendingFiles, uploadFile]);

  const hasFiles = pendingFiles.length > 0;
  const hasErrors = pendingFiles.some(f => f.status === 'error');
  const allCompleted = pendingFiles.every(f => f.status === 'completed');
  const canSend = hasFiles && !isUploading && pendingFiles.every(f => f.status !== 'error');

  return {
    pendingFiles,
    isUploading,
    hasFiles,
    hasErrors,
    allCompleted,
    canSend,
    addFile,
    removeFile,
    clearFiles,
    uploadAllPending,
  };
}
