import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  FILE_CONFIG,
  formatFileSize,
  getFileIcon,
  prepareFile,
  uploadFileToSupabase,
  getTotalFileSize,
  type UploadedFile,
} from "../lib/fileUpload";

interface FileUploadProps {
  bookingId?: string;
  onFilesUpload?: (files: UploadedFile[]) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export interface FileUploadRef {
  uploadFiles: (bookingId: string) => Promise<UploadedFile[]>;
  clearSelected: () => void;
}

const FileUploadComponent = forwardRef<FileUploadRef, FileUploadProps>(
  ({ onFilesUpload, onError, disabled = false }, ref) => {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<
      Record<string, number>
    >({});
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      uploadFiles: async (bookingId: string) => {
        if (selectedFiles.length === 0) return [];

        setIsUploading(true);
        setErrorMessage("");
        const uploaded: UploadedFile[] = [];

        for (const file of selectedFiles) {
          try {
            setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));

            // Prepare file (validate + compress)
            const preparedFile = await prepareFile(file);
            setUploadProgress((prev) => ({ ...prev, [file.name]: 50 }));

            // Upload to Supabase
            const uploadedFile = await uploadFileToSupabase(
              bookingId,
              preparedFile,
            );
            uploaded.push(uploadedFile);

            setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : "Failed to upload file";
            setErrorMessage(errorMsg);
            onError?.(errorMsg);
          }
        }

        setUploadedFiles((prev) => [...prev, ...uploaded]);
        onFilesUpload?.([...uploadedFiles, ...uploaded]);
        setSelectedFiles([]);
        setUploadProgress({});
        setIsUploading(false);
        return uploaded;
      },
      clearSelected: () => {
        setSelectedFiles([]);
        setUploadedFiles([]);
        setErrorMessage("");
      },
    }));

    const handleFileSelect = (files: FileList | null) => {
      if (!files || disabled) return;

      const newFiles = Array.from(files);
      const totalSize = getTotalFileSize([...selectedFiles, ...newFiles]);

      // Check total size
      if (totalSize > FILE_CONFIG.MAX_TOTAL_SIZE_MB) {
        const error = `Total file size exceeds ${FILE_CONFIG.MAX_TOTAL_SIZE_MB}MB limit. Current: ${totalSize.toFixed(2)}MB`;
        setErrorMessage(error);
        onError?.(error);
        return;
      }

      setSelectedFiles((prev) => [...prev, ...newFiles]);
      setErrorMessage("");
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
      handleFileSelect(e.target.files);
    };

    const handleDrag = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(e.type === "dragenter" || e.type === "dragover");
      }
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    };

    const removeFile = (index: number) => {
      setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const removeUploadedFile = (fileId: string) => {
      setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    };

    return (
      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-medium text-gray-900">
          Attachments (Optional)
        </h3>

        {/* Drag & Drop Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-white hover:border-gray-400"
          } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleInputChange}
            disabled={disabled}
            className="hidden"
            aria-label="Upload files"
          />

          <div className="space-y-2">
            <div className="text-2xl">📁</div>
            <p className="text-sm font-medium text-gray-700">
              Drag files here or{" "}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="text-blue-600 hover:text-blue-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                browse
              </button>
            </p>
            <p className="text-xs text-gray-500">
              Max {FILE_CONFIG.MAX_FILE_SIZE_MB}MB per file,{" "}
              {FILE_CONFIG.MAX_TOTAL_SIZE_MB}
              MB total
            </p>
          </div>
        </div>

        {/* File Info */}
        <div className="text-xs text-gray-600">
          <p>
            <strong>Supported:</strong> Images (JPEG, PNG, WebP), PDF, Word
            documents
          </p>
          <p>
            <strong>Note:</strong> Images will be automatically compressed and
            resized for faster uploads.
          </p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-700">
              Selected ({selectedFiles.length})
            </h4>
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between rounded bg-white p-2"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-lg">{getFileIcon(file.type)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-gray-900">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    disabled={isUploading}
                    className="ml-2 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    aria-label="Remove file"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {Object.keys(uploadProgress).length > 0 && isUploading && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-700">
              Uploading -{" "}
              {Object.values(uploadProgress).filter((p) => p === 100).length}/
              {Object.keys(uploadProgress).length}
            </h4>
            {Object.entries(uploadProgress).map(([name, progress]) => (
              <div key={name} className="flex items-center gap-2">
                <span className="text-xs text-gray-600">{name}</span>
                <div className="flex-1 rounded-full bg-gray-200 h-1.5">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600">{progress}%</span>
              </div>
            ))}
          </div>
        )}

        {/* Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2 border-t border-gray-200 pt-4">
            <h4 className="text-xs font-medium text-gray-700">
              Attached ({uploadedFiles.length})
            </h4>
            <div className="space-y-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between rounded bg-green-50 p-2"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-lg">
                      {getFileIcon(file.fileType)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-xs font-medium text-blue-600 hover:underline"
                      >
                        {file.fileName}
                      </a>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.fileSize)} · Uploaded{" "}
                        {new Date(file.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUploadedFile(file.id)}
                    className="ml-2 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove uploaded file"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
);

FileUploadComponent.displayName = "FileUpload";

export default FileUploadComponent;
