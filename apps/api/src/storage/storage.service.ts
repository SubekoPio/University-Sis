// Purpose: Define object-storage operations used by services without vendor coupling.

/** Supported raster image types stored for announcement artwork. */
export type StorageImageContentType = "image/jpeg" | "image/png" | "image/webp";

/** Image bytes and media type to store in object storage. */
export interface StorageImageInput {
  bytes: Buffer;
  contentType: StorageImageContentType;
}

/** Provider-neutral object storage contract for announcement images and links. */
export abstract class StorageService {
  /** Stores an announcement image and returns its private object key. */
  abstract storeAnnouncementImage(input: StorageImageInput): Promise<string>;

  /** Removes one object after its persisted reference is replaced or cleared. */
  abstract deleteObject(storageKey: string): Promise<void>;

  /** Creates a short-lived URL for displaying a private object. */
  abstract getReadUrl(storageKey: string): Promise<string>;
}
