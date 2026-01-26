import { useRef } from 'react';
import { Paperclip } from 'lucide-react';

interface FileUploadButtonProps {
  onFilesSelect: (files: File[]) => void;
  disabled?: boolean;
  accept?: string;
  multiple?: boolean;
}

const DEFAULT_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,application/pdf';

export function FileUploadButton({
  onFilesSelect,
  disabled = false,
  accept = DEFAULT_ACCEPT,
  multiple = true,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelect(Array.from(files));
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
        multiple={multiple}
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
