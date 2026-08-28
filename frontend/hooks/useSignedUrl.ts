import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

const DEFAULT_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "thyrovision-images";

/**
 * Hook to generate a dynamic signed URL for a given storage path.
 * 
 * @param path The storage path of the file (e.g., 'raw/doctor_id/...')
 * @param bucket Optional bucket name, defaults to env or 'thyrovision_wa'
 * @param expiry Seconds until the signed URL expires (default 3600 = 1 hour)
 * @returns { signedUrl: string | null, isLoading: boolean, error: any }
 */
export function useSignedUrl(path: string | null, bucket: string = DEFAULT_BUCKET, expiry: number = 3600) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    // Reset state if path changes or becomes null
    if (!path) {
      setSignedUrl(null);
      return;
    }

    // If path is already a full URL (legacy fallback), use it as is
    if (path.startsWith("http")) {
      setSignedUrl(path);
      return;
    }

    let isMounted = true;

    async function getSignedUrl() {
      setIsLoading(true);
      setError(null);
      
      const supabase = createClient();

      try {
        // Sanitize path: remove leading slashes which can cause 400 errors
        const sanitizedPath = (path as string).startsWith("/") 
          ? (path as string).substring(1) 
          : (path as string);
        
        console.log(`[useSignedUrl] Attempting to sign: "${sanitizedPath}" in bucket: "${bucket}"`);

        const { data, error: storageError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(sanitizedPath, expiry);

        if (storageError) {
          throw storageError;
        }

        if (isMounted && data?.signedUrl) {
          console.log(`[useSignedUrl] Successfully signed path: "${sanitizedPath}"`);
          setSignedUrl(data.signedUrl);
        }
      } catch (err: any) {
        console.error(`Error generating signed URL for ${path}:`, err);
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    getSignedUrl();

    return () => {
      isMounted = false;
    };
  }, [path, bucket, expiry]);

  return { signedUrl, isLoading, error };
}
