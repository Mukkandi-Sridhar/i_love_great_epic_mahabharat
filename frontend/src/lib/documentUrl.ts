/**
 * Resolve stored purchase links into something embeddable.
 *
 * Library files are stored as Google Drive share links or direct PDF URLs.
 * A Drive "/view" link renders Drive's own chrome and refuses to frame in
 * some contexts, so it is rewritten to the "/preview" embed form.
 */

const DRIVE_FILE_ID = [
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
  /docs\.google\.com\/[^/]+\/d\/([a-zA-Z0-9_-]+)/,
  /[?&]id=([a-zA-Z0-9_-]{20,})/,
];

export type DocumentSource = {
  /** URL to render inside the reader, or null when nothing is viewable. */
  embedUrl: string | null;
  /** URL to open in a new tab for downloading/printing. */
  openUrl: string | null;
  /** Drive embeds are opaque iframes: no zoom or page controls apply. */
  isDriveEmbed: boolean;
};

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

export const driveFileId = (url: string): string | null => {
  for (const pattern of DRIVE_FILE_ID) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
};

export const resolveDocumentSource = (rawUrl?: string | null): DocumentSource => {
  const url = (rawUrl || "").trim();
  if (!url || !isHttpUrl(url)) {
    return { embedUrl: null, openUrl: null, isDriveEmbed: false };
  }

  const fileId = driveFileId(url);
  if (fileId) {
    return {
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      openUrl: `https://drive.google.com/file/d/${fileId}/view`,
      isDriveEmbed: true,
    };
  }

  return { embedUrl: url, openUrl: url, isDriveEmbed: false };
};
