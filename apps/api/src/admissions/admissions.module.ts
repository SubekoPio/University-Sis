// Purpose: Register admissions services and the website integration endpoint.
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { AcademicModule } from "../academic/academic.module.js";
import { RbacModule } from "../common/rbac/rbac.module.js";
import { PrismaModule } from "../database/prisma.module.js";
import { UsersModule } from "../users/users.module.js";
import { AdmissionService } from "./admission.service.js";
import { AdmissionsRepository } from "./admissions.repository.js";
import { ApplicationFeeService } from "./application-fee.service.js";
import { ApplicationsService } from "./applications.service.js";
import { DocumentReviewService } from "./document-review.service.js";
import { IntegrationsController } from "./integrations.controller.js";
import { WebsiteIntegrationGuard } from "./website-integration.guard.js";
import { AdmissionsController } from "./admissions.controller.js";

/** Provides admissions workflows and the signed website application endpoint. */
@Module({
  imports: [
    ConfigModule,
    AcademicModule,
    PrismaModule,
    RbacModule,
    UsersModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
  ],
  controllers: [IntegrationsController, AdmissionsController],
  providers: [
    AdmissionService,
    AdmissionsRepository,
    ApplicationFeeService,
    ApplicationsService,
    DocumentReviewService,
    WebsiteIntegrationGuard,
  ],
  exports: [AdmissionService, ApplicationFeeService, ApplicationsService, DocumentReviewService],
})
export class AdmissionsModule {}
