// Purpose: Store and sign private announcement images in S3-compatible MinIO.
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BadRequestException, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentConfig } from "../config/environment.config.js";
import { StorageService, type StorageImageInput } from "./storage.service.js";

const MAX_ANNOUNCEMENT_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} satisfies Record<StorageImageInput["contentType"], string>;

/** Stores private images in MinIO through its S3-compatible API. */
@Injectable()
export class MinioStorageService extends StorageService implements OnModuleDestroy {
  private readonly client: S3Client;
  private readonly bucket: string;

  /** Receives the S3-compatible endpoint, bucket, region, and credentials. */
  constructor(config: ConfigService<EnvironmentConfig, true>) {
    super();
    this.bucket = config.get("MINIO_BUCKET", { infer: true });
    this.client = new S3Client({
      endpoint: config.get("MINIO_ENDPOINT", { infer: true }),
      region: config.get("MINIO_REGION", { infer: true }),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.get("MINIO_ROOT_USER", { infer: true }),
        secretAccessKey: config.get("MINIO_ROOT_PASSWORD", { infer: true }),
      },
    });
  }

  /** Releases HTTP sockets owned by the S3-compatible client. */
  onModuleDestroy(): void {
    this.client.destroy();
  }

  /** Stores a validated raster image under a generated announcement key. */
  async storeAnnouncementImage(input: StorageImageInput): Promise<string> {
    this.validateImage(input);
    const storageKey = `announcements/${randomUUID()}.${IMAGE_EXTENSIONS[input.contentType]}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: input.bytes,
        ContentType: input.contentType,
        CacheControl: "private, max-age=300",
      }),
    );
    return storageKey;
  }

  /** Deletes an object by its validated storage key. */
  async deleteObject(storageKey: string): Promise<void> {
    this.validateStorageKey(storageKey);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }

  /** Returns a short-lived signed URL for a private object. */
  getReadUrl(storageKey: string): Promise<string> {
    this.validateStorageKey(storageKey);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      { expiresIn: 15 * 60 },
    );
  }

  private validateImage(input: StorageImageInput): void {
    if (
      !Buffer.isBuffer(input.bytes) ||
      input.bytes.length === 0 ||
      input.bytes.length > MAX_ANNOUNCEMENT_IMAGE_BYTES
    ) {
      throw new BadRequestException("Announcement image must be between 1 byte and 5 MiB.");
    }

    const isJpeg =
      input.contentType === "image/jpeg" &&
      input.bytes.length >= 3 &&
      input.bytes[0] === 0xff &&
      input.bytes[1] === 0xd8 &&
      input.bytes[2] === 0xff;
    const isPng =
      input.contentType === "image/png" &&
      input.bytes.length >= 8 &&
      input.bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isWebp =
      input.contentType === "image/webp" &&
      input.bytes.length >= 12 &&
      input.bytes.toString("ascii", 0, 4) === "RIFF" &&
      input.bytes.toString("ascii", 8, 12) === "WEBP";
    if (!isJpeg && !isPng && !isWebp) {
      throw new BadRequestException("Announcement image must be a valid JPEG, PNG, or WebP file.");
    }
  }

  private validateStorageKey(storageKey: string): void {
    if (
      storageKey.trim().length === 0 ||
      storageKey.startsWith("/") ||
      storageKey.includes("\\") ||
      storageKey.split("/").some((part) => part === ".." || part.length === 0) ||
      storageKey.split("").some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
      })
    ) {
      throw new BadRequestException("The object-storage key is invalid.");
    }
  }
}
