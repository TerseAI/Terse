import { useRef } from 'react';
import { Paperclip } from 'lucide-react';

interface FileUploadButtonProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  accept?: string;
}

const DEFAULT_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,application/pdf';

export function FileUploadButton({
  onFileSelect,
  disabled = false,
  accept = DEFAULT_ACCEPT,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Attach file"
      >
        <Paperclip className="w-5 h-5" />
      </button>
    </>
  );
}

export default FileUploadButton;
