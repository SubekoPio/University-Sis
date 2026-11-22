// Purpose: Expose admissions application, document, fee, and admission workflows with RBAC.
import { Body, Controller, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/rbac/jwt-auth.guard.js";
import { PermissionsGuard } from "../common/rbac/permissions.guard.js";
import { RolesGuard } from "../common/rbac/roles.guard.js";
import { Permissions, Roles } from "../common/rbac/rbac.decorators.js";
import { CurrentUser } from "../common/rbac/current-user.decorator.js";
import type { AuthenticatedUser } from "../common/rbac/rbac.types.js";
import { AdmissionService } from "./admission.service.js";
import { ApplicationFeeService } from "./application-fee.service.js";
import { ApplicationsService } from "./applications.service.js";
import { DocumentReviewService } from "./document-review.service.js";
import {
  AdmitApplicationDto,
  AdmissionsIdParamDto,
  ChangeStudyModeDto,
  CreateApplicationDto,
  DocumentReviewDto,
  RecordApplicationFeeDto,
  UpdateApplicationDto,
} from "./dto/admissions.http.dto.js";
import { StudentsService } from "../academic/students.service.js";

/** Maps protected admissions workflows to the existing admissions and SIS services. */
@ApiTags("Admissions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller("admissions")
export class AdmissionsController {
  /** Creates the HTTP adapter for admissions workflows. */
  constructor(
    private readonly applications: ApplicationsService,
    private readonly documents: DocumentReviewService,
    private readonly fees: ApplicationFeeService,
    private readonly admissions: AdmissionService,
    private readonly students: StudentsService,
  ) {}

  /**
   *
   */
  @Post("applications")
  @Roles("admissions_officer")
  @Permissions("admissions:application:manage")
  @ApiOperation({ summary: "Create an admission-office application" })
  @ApiCreatedResponse({ description: "The application was created." })
  createApplication(@Body() input: CreateApplicationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.createOfficeApplication(input, user.id);
  }

  /**
   *
   */
  @Patch("applications/:id")
  @Roles("admissions_officer", "admissions_head")
  @Permissions("admissions:application:manage")
  @ApiOperation({ summary: "Update mutable application details" })
  @ApiParam({ name: "id", format: "uuid" })
  updateApplication(
    @Param() params: AdmissionsIdParamDto,
    @Body() input: UpdateApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applications.update(params.id, input, user.id);
  }

  /**
   *
   */
  @Post("applications/:id/reject")
  @Roles("admissions_head")
  @Permissions("admissions:reject", "admissions:application:manage")
  @ApiOperation({ summary: "Reject an application before final admission" })
  @ApiParam({ name: "id", format: "uuid" })
  rejectApplication(@Param() params: AdmissionsIdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.applications.withdraw(params.id, user.id);
  }

  /**
   *
   */
  @Post("documents/:id/approve")
  @Roles("admissions_officer", "admissions_head")
  @Permissions("admissions:document:review")
  @ApiOperation({ summary: "Approve an application document" })
  @ApiParam({ name: "id", format: "uuid" })
  approveDocument(
    @Param() params: AdmissionsIdParamDto,
    @Body() input: DocumentReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.approveDocument(params.id, user.id, input.note);
  }

  /**
   *
   */
  @Post("documents/:id/reject")
  @Roles("admissions_officer", "admissions_head")
  @Permissions("admissions:document:review")
  @ApiOperation({ summary: "Reject an application document" })
  @ApiParam({ name: "id", format: "uuid" })
  rejectDocument(
    @Param() params: AdmissionsIdParamDto,
    @Body() input: DocumentReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.rejectDocument(params.id, user.id, input.note);
  }

  /**
   *
   */
  @Post("fees")
  @Roles("bursar")
  @Permissions("admissions:fee:confirm")
  @ApiOperation({ summary: "Record and confirm an application-fee bank deposit" })
  recordApplicationFee(
    @Body() input: RecordApplicationFeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.fees.record(input, user.id);
  }

  /**
   *
   */
  @Post("applications/:id/admit")
  @Roles("admissions_head")
  @Permissions("admissions:admit")
  @ApiOperation({ summary: "Admit an eligible application and provision a student account" })
  @ApiParam({ name: "id", format: "uuid" })
  admitApplication(
    @Param() params: AdmissionsIdParamDto,
    @Body() input: AdmitApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admissions.admit(params.id, user.id, input.studyMode);
  }

  /**
   *
   */
  @Post("applications/:id/resend-credentials")
  @Roles("admissions_head")
  @Permissions("admissions:admit")
  @ApiOperation({ summary: "Resend credentials for an admitted application" })
  @ApiParam({ name: "id", format: "uuid" })
  resendCredentials(@Param() params: AdmissionsIdParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admissions.resendCredentials(params.id, user.id);
  }

  /**
   *
   */
  @Post("study-mode/change")
  @Roles("admissions_head")
  @Permissions("admissions:study-mode:change")
  @ApiOperation({ summary: "Change the study mode of an admitted application" })
  @ApiOkResponse({ description: "The study mode was changed and audited." })
  changeStudyMode(@Body() input: ChangeStudyModeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.students.changeStudyMode(input, user.id);
  }
}
