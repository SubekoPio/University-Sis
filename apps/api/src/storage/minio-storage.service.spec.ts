// Purpose: Test MinIO storage boundary validation without making network requests.
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import type { EnvironmentConfig } from "../config/environment.config.js";
import { MinioStorageService } from "./minio-storage.service.js";

const config = {
  get: (key: string) => {
    const values: Record<string, string> = {
      MINIO_BUCKET: "school-files",
      MINIO_ENDPOINT: "http://127.0.0.1:9000",
      MINIO_REGION: "us-east-1",
      MINIO_ROOT_PASSWORD: "local-password",
      MINIO_ROOT_USER: "local-user",
    };
    return values[key];
  },
} as unknown as ConfigService<EnvironmentConfig, true>;

describe("MinioStorageService", () => {
  it("rejects image bytes whose signature does not match the declared content type", async () => {
    // Arrange: configure the adapter with a local S3-compatible endpoint.
    const service = new MinioStorageService(config);

    try {
      // Act / Assert: reject before sending a put-object request.
      await expect(
        service.storeAnnouncementImage({
          bytes: Buffer.from("not a PNG"),
          contentType: "image/png",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    } finally {
      service.onModuleDestroy();
    }
  });

  it("rejects traversal-like object keys before deleting an object", async () => {
    // Arrange: configure the adapter with a local S3-compatible endpoint.
    const service = new MinioStorageService(config);

    try {
      // Act / Assert: invalid keys never reach the MinIO client.
      await expect(service.deleteObject("announcements/../private")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    } finally {
      service.onModuleDestroy();
    }
  });
});
