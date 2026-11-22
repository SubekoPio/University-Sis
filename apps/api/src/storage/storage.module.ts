// Purpose: Provide the configured S3-compatible storage adapter to feature modules.
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MinioStorageService } from "./minio-storage.service.js";
import { StorageService } from "./storage.service.js";

/** Provides one vendor-neutral storage service backed by MinIO. */
@Module({
  imports: [ConfigModule],
  providers: [{ provide: StorageService, useClass: MinioStorageService }],
  exports: [StorageService],
})
export class StorageModule {}
