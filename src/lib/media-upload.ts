export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
/** Whole multipart body: the largest file plus boundaries, headers, alt text and caption. */
export const MAX_UPLOAD_BODY_BYTES = MAX_MEDIA_BYTES + 64 * 1024;
export const MEDIA_ORIGIN = "https://media.orboro.net";

export function mediaUrlForRequest(requestUrl: URL, key: string): string {
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(requestUrl.hostname);
  return isLocal
    ? `/media/${key}`
    : `${MEDIA_ORIGIN}/${key}`;
}

type SupportedImage = { contentType: string; extension: string };

export function identifyImage(bytes: Uint8Array): SupportedImage | null {
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { contentType: "image/png", extension: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length >= 6 && String.fromCharCode(...bytes.subarray(0, 6)).match(/^GIF8[79]a$/)) {
    return { contentType: "image/gif", extension: "gif" };
  }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") {
    return { contentType: "image/webp", extension: "webp" };
  }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(4, 8)) === "ftyp" &&
      ["avif", "avis"].includes(String.fromCharCode(...bytes.subarray(8, 12)))) {
    return { contentType: "image/avif", extension: "avif" };
  }
  return null;
}
