import { X, FileText, Loader2 } from 'lucide-react';
import { PendingFile } from './hooks/useFileUpload';

interface FilePreviewProps {
  file: PendingFile;
  onRemove: () => void;
}

export function FilePreview({ file, onRemove }: FilePreviewProps) {
  const isImage = file.file.type.startsWith('image/');
  const isPdf = file.file.type === 'application/pdf';

  return (
    <div className="relative group">
      <div className={`
        w-16 h-16 rounded-lg border overflow-hidden flex items-center justify-center
        ${file.status === 'error' ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}
      `}>
        {isImage && file.previewUrl ? (
          <img
            src={file.previewUrl}
            alt={file.file.name}
            className="w-full h-full object-cover"
          />
        ) : isPdf ? (
          <FileText className="w-8 h-8 text-red-500" />
        ) : (
          <FileText className="w-8 h-8 text-gray-400" />
        )}

        {/* Loading overlay */}
        {file.status === 'uploading' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}

        {/* Completed checkmark */}
        {file.status === 'completed' && (
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove file"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Filename tooltip */}
      <div className="absolute -bottom-6 left-0 right-0 text-center">
        <span className="text-[10px] text-gray-500 truncate block max-w-16" title={file.file.name}>
          {file.file.name.length > 10 ? `${file.file.name.slice(0, 8)}...` : file.file.name}
        </span>
      </div>

      {/* Error message */}
      {file.status === 'error' && file.error && (
        <div className="absolute top-full left-0 mt-1 text-xs text-red-500 whitespace-nowrap">
          {file.error}
        </div>
      )}
    </div>
  );
}

interface FilePreviewListProps {
  files: PendingFile[];
  onRemove: (id: string) => void;
}

export function FilePreviewList({ files, onRemove }: FilePreviewListProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex gap-3 px-4 pb-2 flex-wrap">
      {files.map(file => (
        <FilePreview
          key={file.id}
          file={file}
          onRemove={() => onRemove(file.id)}
        />
      ))}
    </div>
  );
}

export default FilePreview;
