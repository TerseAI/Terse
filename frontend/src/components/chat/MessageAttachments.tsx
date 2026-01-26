import { FileText } from 'lucide-react';
import { useState } from 'react';
import { UploadedFile } from '../../shared/ModelEvents';

interface MessageAttachmentsProps {
  files: UploadedFile[];
}

/**
 * Read-only component to display files within sent message Turns.
 * Different from FilePreview which handles upload state.
 */
export function MessageAttachments({ files }: MessageAttachmentsProps) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  if (files.length === 0) return null;

  return (
    <>
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
                    className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setExpandedImage(displayUrl)}
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

      {/* Expanded image modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Expanded view"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
            onClick={() => setExpandedImage(null)}
          >
            &times;
          </button>
        </div>
      )}
    </>
  );
}

export default MessageAttachments;
