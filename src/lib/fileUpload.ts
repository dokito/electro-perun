import imageCompression from "browser-image-compression";
import { supabase } from "./supabase";

export interface UploadedFile {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  url: string;
  uploadedAt: string;
}

// Configuration
export const FILE_CONFIG = {
  MAX_FILE_SIZE_MB: 10, // Maximum file size in MB
  MAX_TOTAL_SIZE_MB: 50, // Total size for all files in a booking
  ALLOWED_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  IMAGE_COMPRESSION: {
    maxSizeMB: 2, // Compress images to max 2MB
    maxWidthOrHeight: 2048,
    useWebWorker: true,
  },
  PDF_COMPRESSION: {
    maxSizeMB: 3, // Compress PDFs to max 3MB
  },
};

/**
 * Validates file type and size
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!FILE_CONFIG.ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type not allowed. Supported: images (JPEG, PNG, WebP), PDF, Word documents`,
    };
  }

  // Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > FILE_CONFIG.MAX_FILE_SIZE_MB) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${FILE_CONFIG.MAX_FILE_SIZE_MB}MB (yours: ${fileSizeMB.toFixed(2)}MB)`,
    };
  }

  return { valid: true };
}

/**
 * Compresses images using browser-image-compression
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file; // Not an image, return as-is
  }

  try {
    const originalSizeMB = file.size / (1024 * 1024);

    const compressedBlob = await imageCompression(file, {
      maxSizeMB: FILE_CONFIG.IMAGE_COMPRESSION.maxSizeMB,
      maxWidthOrHeight: FILE_CONFIG.IMAGE_COMPRESSION.maxWidthOrHeight,
      useWebWorker: FILE_CONFIG.IMAGE_COMPRESSION.useWebWorker,
    });

    const compressedSizeMB = compressedBlob.size / (1024 * 1024);
    console.log(
      `Image compressed: ${originalSizeMB.toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB`,
    );

    // Create a new File from the compressed Blob
    return new File([compressedBlob], file.name, { type: file.type });
  } catch (error) {
    console.error("Error compressing image:", error);
    return file; // Return original if compression fails
  }
}

/**
 * Prepares file for upload (validates, compresses if needed)
 */
export async function prepareFile(file: File): Promise<File> {
  // Validate
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Compress if image
  if (file.type.startsWith("image/")) {
    return compressImage(file);
  }

  return file;
}

/**
 * Uploads file to Supabase storage and returns metadata
 */
export async function uploadFileToSupabase(
  bookingId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<UploadedFile> {
  try {
    const fileExtension = file.name.split(".").pop() || "bin";
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const filePath = `bookings/${bookingId}/${fileName}`;

    // Upload to Supabase storage
    const { error, data } = await supabase.storage
      .from("booking-attachments")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from("booking-attachments")
      .getPublicUrl(filePath);

    const uploadedFile: UploadedFile = {
      id: fileName,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      url: publicUrl.publicUrl,
      uploadedAt: new Date().toISOString(),
    };

    return uploadedFile;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}

/**
 * Deletes file from Supabase storage
 */
export async function deleteFileFromSupabase(
  bookingId: string,
  fileId: string,
): Promise<boolean> {
  try {
    const filePath = `bookings/${bookingId}/${fileId}`;
    const { error } = await supabase.storage
      .from("booking-attachments")
      .remove([filePath]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting file:", error);
    return false;
  }
}

/**
 * Calculates total size of files in MB
 */
export function getTotalFileSize(files: File[]): number {
  return files.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024);
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const index = Math.min(Math.max(i, 0), sizes.length - 1);
  return (
    Math.round((bytes / Math.pow(k, index)) * 100) / 100 + " " + sizes[index]
  );
}

/**
 * Gets file icon/emoji based on file type
 */
export function getFileIcon(fileType: string): string {
  if (fileType.startsWith("image/")) return "🖼️";
  if (fileType.includes("pdf")) return "📄";
  if (fileType.includes("word") || fileType.includes("document")) return "📝";
  return "📎";
}
