import { useRef, type ChangeEvent, type ReactNode } from "react";

interface ObjectUploaderProps {
  maxFileSize?: number;
  accept?: string;
  disabled?: boolean;
  /** Called once per selected file; wire this to `useUpload().uploadFile`. */
  onFileSelected: (file: File) => void | Promise<void>;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * Lightweight replacement for the old Uppy-based uploader.
 * Uppy's AwsS3 plugin assumed a raw S3 PUT flow, which doesn't match
 * Supabase Storage's `uploadToSignedUrl` POST flow — a plain file input
 * plus `useUpload` covers the same single/multi-file button UX without
 * an extra ~150KB dependency.
 */
export function ObjectUploader({
  maxFileSize = 10 * 1024 * 1024,
  accept,
  disabled,
  onFileSelected,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (file.size > maxFileSize) {
      onFileSelected(Promise.reject(new Error("File too large")) as unknown as File);
      return;
    }
    await onFileSelected(file);
  };

  return (
    <div>
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
        onClick={() => inputRef.current?.click()}
        className={buttonClassName}
        disabled={disabled}
      >
        {children}
      </button>
    </div>
  );
}
