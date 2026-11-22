// Purpose: Coordinate creation and lifecycle changes for admissions applications.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApplicationDocumentType,
  ApplicationSource,
  ApplicationStatus,
  Prisma,
  StudentSchedule,
  StudyMode,
} from "@prisma/client";
import { isEmail, isUUID } from "class-validator";
import { RbacService } from "../common/rbac/rbac.service.js";
import { AdmissionsRepository } from "./admissions.repository.js";
import type {
  CreateApplicationInput,
  UpdateApplicationInput,
  WebsiteApplicationResult,
} from "./admissions.types.js";

const APPLICATION_MANAGE_PERMISSION = "admissions:application:manage";

/** Provides staff and secured-website application creation and lifecycle operations. */
@Injectable()
export class ApplicationsService {
  /** Receives admissions persistence and permission services. */
  constructor(
    private readonly repository: AdmissionsRepository,
    private readonly rbac: RbacService,
  ) {}

  /** Creates an office application on behalf of an authorized admissions user. */
  async createOfficeApplication(
    input: CreateApplicationInput,
    enteredById: string,
  ): Promise<WebsiteApplicationResult> {
    await this.assertPermission(enteredById, APPLICATION_MANAGE_PERMISSION);
    const normalized = this.normalizeCreateInput(input, false);
    delete normalized.externalRef;
    await this.assertProgrammeAndIntake(normalized);

    const application = await this.repository.createApplication(
      normalized,
      ApplicationSource.ADMISSION_OFFICE,
      enteredById,
    );
    return this.toResult(application);
  }

  /** Creates a website application once per external reference without mutating replays. */
  async createWebsiteApplication(
    input: CreateApplicationInput & { externalRef: string },
  ): Promise<WebsiteApplicationResult> {
    const normalized = this.normalizeCreateInput(input, true);
    const externalRef = normalized.externalRef;
    if (externalRef === undefined) {
      throw new BadRequestException("A website application reference is required.");
    }

    const existing = await this.repository.findWebsiteApplication(externalRef);
    if (existing !== null) {
      return this.toResult(existing);
    }
    await this.assertProgrammeAndIntake(normalized);

    try {
      const application = await this.repository.createApplication(
        normalized,
        ApplicationSource.WEBSITE,
        null,
      );
      return this.toResult(application);
    } catch (error: unknown) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }

      const application = await this.repository.findWebsiteApplication(externalRef);
      if (application === null) {
        throw error;
      }
      return this.toResult(application);
    }
  }

  /** Updates applicant details before admission and records the change. */
  async update(
    applicationId: string,
    input: UpdateApplicationInput,
    actorId: string,
  ): Promise<WebsiteApplicationResult> {
    await this.assertPermission(actorId, APPLICATION_MANAGE_PERMISSION);
    this.validateUuid(applicationId, "Application ID");
    const update = this.normalizeUpdateInput(input);
    const application = await this.repository.withTransaction(async (transaction) => {
      const current = await this.repository.findApplicationInTransaction(
        applicationId,
        transaction,
      );
      if (current === null) {
        throw new NotFoundException("Application not found.");
      }
      this.assertMutable(current.status);

      const programmeId = update.desiredProgrammeId ?? current.desiredProgrammeId;
      const intakeId = update.desiredIntakeId ?? current.desiredIntakeId;
      if (
        !(await this.repository.hasActiveProgrammeAndIntake(programmeId, intakeId, transaction))
      ) {
        throw new BadRequestException("The selected programme or intake is not active.");
      }
      const updated = await this.repository.updateMutableApplication(
        applicationId,
        update,
        transaction,
      );
      if (updated === null) {
        throw new ConflictException("A final application cannot be changed.");
      }
      await this.repository.writeAudit(transaction, {
        actorId,
        action: "admissions.application.updated",
        resourceType: "application",
        resourceId: applicationId,
        metadata: { changedFields: Object.keys(update) },
      });
      return updated;
    });
    return this.toResult(application);
  }

  /** Withdraws an application before a final decision and preserves its history. */
  async withdraw(applicationId: string, actorId: string): Promise<WebsiteApplicationResult> {
    await this.assertPermission(actorId, APPLICATION_MANAGE_PERMISSION);
    this.validateUuid(applicationId, "Application ID");
    const withdrawn = await this.repository.withTransaction(async (transaction) => {
      const application = await this.repository.findApplicationInTransaction(
        applicationId,
        transaction,
      );
      if (application === null) {
        throw new NotFoundException("Application not found.");
      }
      this.assertMutable(application.status);
      const result = await this.repository.withdrawMutableApplication(applicationId, transaction);
      if (result === null) {
        throw new ConflictException("A final application cannot be withdrawn.");
      }
      await this.repository.writeAudit(transaction, {
        actorId,
        action: "admissions.application.withdrawn",
        resourceType: "application",
        resourceId: applicationId,
      });
      return result;
    });
    return this.toResult(withdrawn);
  }

  private async assertPermission(actorId: string, permission: string): Promise<void> {
    const actorStatus = await this.repository.findUserStatus(actorId);
    if (actorStatus !== "ACTIVE") {
      throw new ForbiddenException("An active account with the required permission is required.");
    }
    const snapshot = await this.rbac.getAuthorizationSnapshot(actorId);
    if (!snapshot.permissions.includes(permission)) {
      throw new ForbiddenException(`The ${permission} permission is required.`);
    }
  }

  private async assertProgrammeAndIntake(input: CreateApplicationInput): Promise<void> {
    if (
      !(await this.repository.hasActiveProgrammeAndIntake(
        input.desiredProgrammeId,
        input.desiredIntakeId,
      ))
    ) {
      throw new BadRequestException("The selected programme or intake is not active.");
    }
  }

  private normalizeCreateInput(
    input: CreateApplicationInput,
    requireExternalRef: boolean,
  ): CreateApplicationInput {
    const applicantName = this.requiredText(input.applicantName, "Applicant name");
    const email = input.email.trim().toLowerCase();
    if (!isEmail(email)) {
      throw new BadRequestException("A valid applicant email address is required.");
    }
    const phone = this.requiredText(input.phone, "Applicant phone");
    const nationality = this.requiredText(input.nationality, "Applicant nationality");
    if (!(input.dateOfBirth instanceof Date) || !Number.isFinite(input.dateOfBirth.getTime())) {
      throw new BadRequestException("A valid applicant date of birth is required.");
    }
    if (
      requireExternalRef &&
      (input.externalRef === undefined || input.externalRef.trim() === "")
    ) {
      throw new BadRequestException("A website application reference is required.");
    }
    const externalRef = input.externalRef?.trim();
    if (externalRef !== undefined && (externalRef.length === 0 || externalRef.length > 255)) {
      throw new BadRequestException(
        "The website application reference must be 1 to 255 characters.",
      );
    }
    this.validateEnums(input.studyMode, input.schedule);
    const desiredProgrammeId = this.requiredText(input.desiredProgrammeId, "Programme ID");
    const desiredIntakeId = this.requiredText(input.desiredIntakeId, "Intake ID");
    if (!isUUID(desiredProgrammeId) || !isUUID(desiredIntakeId)) {
      throw new BadRequestException("Programme and intake IDs must be valid UUIDs.");
    }
    const documents = input.documents?.map((document) => {
      if (!Object.values(ApplicationDocumentType).includes(document.type)) {
        throw new BadRequestException("The application document type is invalid.");
      }
      return {
        type: document.type,
        storageKey: this.requiredText(document.storageKey, "Document storage key"),
      };
    });

    return {
      applicantName,
      email,
      phone,
      dateOfBirth: input.dateOfBirth,
      nationality,
      studyMode: input.studyMode,
      schedule: input.schedule,
      desiredProgrammeId,
      desiredIntakeId,
      ...(documents === undefined ? {} : { documents }),
      ...(externalRef === undefined ? {} : { externalRef }),
    };
  }

  private normalizeUpdateInput(input: UpdateApplicationInput): UpdateApplicationInput {
    const update: UpdateApplicationInput = {};
    if (input.applicantName !== undefined) {
      update.applicantName = this.requiredText(input.applicantName, "Applicant name");
    }
    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      if (!isEmail(email)) {
        throw new BadRequestException("A valid applicant email address is required.");
      }
      update.email = email;
    }
    if (input.phone !== undefined) {
      update.phone = this.requiredText(input.phone, "Applicant phone");
    }
    if (input.nationality !== undefined) {
      update.nationality = this.requiredText(input.nationality, "Applicant nationality");
    }
    if (input.dateOfBirth !== undefined) {
      if (!(input.dateOfBirth instanceof Date) || !Number.isFinite(input.dateOfBirth.getTime())) {
        throw new BadRequestException("A valid applicant date of birth is required.");
      }
      update.dateOfBirth = input.dateOfBirth;
    }
    if (input.studyMode !== undefined) {
      if (!Object.values(StudyMode).includes(input.studyMode)) {
        throw new BadRequestException("The selected study mode is invalid.");
      }
      update.studyMode = input.studyMode;
    }
    if (input.schedule !== undefined) {
      if (!Object.values(StudentSchedule).includes(input.schedule)) {
        throw new BadRequestException("The selected student schedule is invalid.");
      }
      update.schedule = input.schedule;
    }
    if (input.desiredProgrammeId !== undefined) {
      update.desiredProgrammeId = this.requiredText(input.desiredProgrammeId, "Programme ID");
      if (!isUUID(update.desiredProgrammeId)) {
        throw new BadRequestException("Programme ID must be a valid UUID.");
      }
    }
    if (input.desiredIntakeId !== undefined) {
      update.desiredIntakeId = this.requiredText(input.desiredIntakeId, "Intake ID");
      if (!isUUID(update.desiredIntakeId)) {
        throw new BadRequestException("Intake ID must be a valid UUID.");
      }
    }
    if (Object.keys(update).length === 0) {
      throw new BadRequestException("At least one application field must be provided.");
    }
    return update;
  }

  private requiredText(value: string, label: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BadRequestException(`${label} is required.`);
    }
    return value.trim();
  }

  private assertMutable(status: ApplicationStatus): void {
    if (
      status === ApplicationStatus.ADMITTED ||
      status === ApplicationStatus.REJECTED ||
      status === ApplicationStatus.WITHDRAWN
    ) {
      throw new ConflictException("A final application cannot be changed.");
    }
  }

  private validateEnums(studyMode: StudyMode, schedule: StudentSchedule): void {
    if (!Object.values(StudyMode).includes(studyMode)) {
      throw new BadRequestException("The selected study mode is invalid.");
    }
    if (!Object.values(StudentSchedule).includes(schedule)) {
      throw new BadRequestException("The selected student schedule is invalid.");
    }
  }

  private validateUuid(id: string, label: string): void {
    if (!isUUID(id)) {
      throw new BadRequestException(`${label} must be a valid UUID.`);
    }
  }

  private toResult(application: {
    id: string;
    externalRef: string | null;
    status: ApplicationStatus;
    source: ApplicationSource;
  }): WebsiteApplicationResult {
    return {
      id: application.id,
      externalRef: application.externalRef,
      status: application.status,
      source: application.source,
    };
  }
}
