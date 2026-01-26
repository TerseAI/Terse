import { Download, FileText } from 'lucide-react';
import { UploadedFile } from '../../shared/ModelEvents';

interface MessageAttachmentsProps {
  files: UploadedFile[];
}

/**
 * Download a file by creating a temporary anchor element.
 * Works with presigned URLs from GCS.
 */
function downloadFile(url: string, filename: string) {
  // Fetch the file and create a blob to force download
  // This works around CORS issues with direct downloads from GCS
  fetch(url)
    .then(response => response.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    })
    .catch(error => {
      console.error('Failed to download file:', error);
      // Fallback: open in new tab
      window.open(url, '_blank');
    });
}

/**
 * Read-only component to display files within sent message Turns.
 * Different from FilePreview which handles upload state.
 */
export function MessageAttachments({ files }: MessageAttachmentsProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex gap-2 mt-2 flex-wrap">
      {files.map((file, index) => {
        const isImage = file.mimeType.startsWith('image/');
        const isPdf = file.mimeType === 'application/pdf';
        const displayUrl = file.url || file.fileKey;

        return (
          <div key={index} className="relative group">
            <div className="w-16 h-16 rounded-lg border border-gray-600 overflow-hidden flex items-center justify-center bg-gray-800/50">
              {isImage && displayUrl ? (
                <img
                  src={displayUrl}
                  alt={file.filename}
                  className="w-full h-full object-cover"
                />
              ) : isPdf ? (
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center w-full h-full hover:bg-gray-700/50 transition-colors"
                >
                  <FileText className="w-8 h-8 text-red-400" />
                </a>
              ) : (
                <FileText className="w-8 h-8 text-gray-400" />
              )}
            </div>

            {/* Download button on hover */}
            {displayUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadFile(displayUrl, file.filename);
                }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Download"
              >
                <Download className="w-3 h-3 text-white" />
              </button>
            )}

            {/* Filename tooltip */}
            <div className="absolute -bottom-5 left-0 right-0 text-center">
              <span
                className="text-[10px] text-gray-400 truncate block max-w-16"
                title={file.filename}
              >
                {file.filename.length > 10
                  ? `${file.filename.slice(0, 8)}...`
                  : file.filename}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MessageAttachments;
