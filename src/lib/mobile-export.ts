import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export type FileDelivery = "downloaded" | "shared";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Could not read the export file."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not encode the export file."));
        return;
      }
      const separator = result.indexOf(",");
      if (separator < 0) {
        reject(new Error("Could not encode the export file as base64."));
        return;
      }
      resolve(result.slice(separator + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Downloads files in desktop/web browsers and uses Android's native share sheet
 * for local files. Android WebView does not reliably honour anchor.download for
 * Blob URLs, so files are first written to Capacitor's shareable cache directory.
 */
export async function saveBlobForUser(blob: Blob, filename: string): Promise<FileDelivery> {
  if (Capacitor.isNativePlatform()) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = "axivestra-" + Date.now() + "-" + safeName;
    const data = await blobToBase64(blob);
    const saved = await Filesystem.writeFile({
      path,
      data,
      directory: Directory.Cache,
      recursive: true
    });

    try {
      await Share.share({
        title: filename,
        text: "AXIVESTRA export. Save this file to a secure location.",
        files: [saved.uri],
        dialogTitle: "Save AXIVESTRA file"
      });
      return "shared";
    } finally {
      // The share chooser has completed or been dismissed. Remove the temporary
      // private cache copy; the destination app receives the file through FileProvider.
      try {
        await Filesystem.deleteFile({ path, directory: Directory.Cache });
      } catch {
        // Cache cleanup must not turn a successful export into a failed export.
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}
