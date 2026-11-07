import { supabase } from "./supabase";

/**
 * Delete file from Supabase Storage
 */
export async function deleteFileFromStorage(
  bucketId: string,
  path: string,
): Promise<boolean> {
  try {
    // Normalize path: strip bucket prefix if present
    const normalizedPath = path.replace(new RegExp(`^${bucketId}/`), "");

    console.log(`[deleteFileFromStorage] Deleting from bucket "${bucketId}":`, {
      originalPath: path,
      normalizedPath,
    });

    const result = await supabase.storage
      .from(bucketId)
      .remove([normalizedPath]);

    console.log("[deleteFileFromStorage] Full response:", result);

    // Check for errors in response
    if (result.error) {
      console.error("[deleteFileFromStorage] Error in response:", result.error);
      throw result.error;
    }

    // Check the data response
    if (!result.data) {
      console.warn("[deleteFileFromStorage] No data in response");
      return false;
    }

    console.log("[deleteFileFromStorage] Deletion data:", result.data);
    console.log("[deleteFileFromStorage] File deleted successfully");
    return true;
  } catch (err) {
    console.error("[deleteFileFromStorage] Exception:", err);
    return false;
  }
}
