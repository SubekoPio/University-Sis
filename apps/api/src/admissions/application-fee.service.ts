// Purpose: Record, confirm, and void application-fee bank deposits.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApplicationDocumentStatus,
  ApplicationDocumentType,
  ApplicationFeeStatus,
  ApplicationStatus,
  Prisma,
} from "@prisma/client";
import { isUUID } from "class-validator";
import { RbacService } from "../common/rbac/rbac.service.js";
import { AdmissionsRepository } from "./admissions.repository.js";
import { REQUIRED_APPLICATION_DOCUMENT_TYPES } from "./admissions.types.js";

const APPLICATION_FEE_PERMISSION = "admissions:fee:confirm";
const MAX_DATABASE_INTEGER = 2_147_483_647;
/** Input for recording a physical bank deposit against an application. */
export interface RecordApplicationFeeInput {
  applicationId: string;
  bankName: string;
  bankReference: string;
  amountMinor: number;
  depositDate: Date;
}

/** Records application-fee deposits and preserves voided records for audit. */
@Injectable()
export class ApplicationFeeService {
  private readonly requiredFeeMinor: number;
  private readonly currency: string;

  /** Receives admissions persistence, RBAC, and validated application-fee configuration. */
  constructor(
    private readonly repository: AdmissionsRepository,
    private readonly rbac: RbacService,
    config: ConfigService,
  ) {
    this.requiredFeeMinor = config.getOrThrow<number>("APPLICATION_FEE_AMOUNT_MINOR");
    this.currency = config.getOrThrow<string>("CURRENCY");
    if (
      !Number.isSafeInteger(this.requiredFeeMinor) ||
      this.requiredFeeMinor < 0 ||
      this.requiredFeeMinor > MAX_DATABASE_INTEGER
    ) {
      throw new Error("APPLICATION_FEE_AMOUNT_MINOR must be a non-negative database integer.");
    }
  }

  /** Records a physical bank deposit and confirms the fee once its amount meets the configured fee. */
  async record(input: RecordApplicationFeeInput, actorId: string) {
    await this.assertPermission(actorId);
    if (!isUUID(input.applicationId)) {
      throw new BadRequestException("Application ID must be a valid UUID.");
    }
    const bankName = this.requiredText(input.bankName, "Bank name").toUpperCase();
    const bankReference = this.requiredText(input.bankReference, "Bank reference");
    if (
      !Number.isSafeInteger(input.amountMinor) ||
      input.amountMinor <= 0 ||
      input.amountMinor > MAX_DATABASE_INTEGER
    ) {
      throw new BadRequestException(
        "The deposit amount must be a positive whole number of minor units.",
      );
    }
    if (!(input.depositDate instanceof Date) || !Number.isFinite(input.depositDate.getTime())) {
      throw new BadRequestException("A valid deposit date is required.");
    }

    try {
      return await this.repository.withTransaction(async (transaction) => {
        const application = await this.repository.findApplicationForFee(
          input.applicationId,
          transaction,
        );
        if (application === null) {
          throw new NotFoundException("Application not found.");
        }
        this.assertApplicationOpen(application.status);

        const fee = await this.repository.createApplicationFee(
          {
            applicationId: input.applicationId,
            amountMinor: input.amountMinor,
            currency: this.currency,
            bankName,
            bankReference,
            depositDate: input.depositDate,
            recordedById: actorId,
          },
          transaction,
        );
        if (input.amountMinor >= this.requiredFeeMinor) {
          await this.repository.updateApplicationStatus(
            input.applicationId,
            ApplicationStatus.FEE_CONFIRMED,
            transaction,
          );
        }
        await this.repository.writeAudit(transaction, {
          actorId,
          action: "admissions.application_fee.recorded",
          resourceType: "application_fee",
          resourceId: fee.id,
          metadata: {
            applicationId: input.applicationId,
            amountMinor: input.amountMinor,
            currency: this.currency,
            bankName,
          },
        });
        return fee;
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("This bank and reference have already been recorded.");
      }
      throw error;
    }
  }

  /** Voids an active deposit with a reason; the record is retained permanently. */
  async void(feeRecordId: string, actorId: string, reason: string) {
    await this.assertPermission(actorId);
    if (!isUUID(feeRecordId)) {
      throw new BadRequestException("Fee record ID must be a valid UUID.");
    }
    const voidReason = this.requiredText(reason, "A void reason");

    return this.repository.withTransaction(async (transaction) => {
      const record = await this.repository.findFeeRecord(feeRecordId, transaction);
      if (record === null) {
        throw new NotFoundException("Application fee record not found.");
      }
      if (record.status !== ApplicationFeeStatus.RECORDED) {
        throw new ConflictException("Only a recorded application fee can be voided.");
      }
      if (record.recordedById === actorId) {
        throw new ForbiddenException("The user who recorded an application fee cannot void it.");
      }
      if (record.application.status === ApplicationStatus.ADMITTED) {
        throw new ConflictException("An application fee cannot be voided after admission.");
      }

      const voidedAt = new Date();
      const voided = await this.repository.voidApplicationFee(
        feeRecordId,
        actorId,
        voidReason,
        voidedAt,
        transaction,
      );
      if (voided === null) {
        throw new ConflictException("The application fee changed before it could be voided.");
      }
      const activeFees = await this.repository.listActiveApplicationFees(
        record.applicationId,
        transaction,
      );
      let nextStatus: ApplicationStatus = record.application.status;
      if (record.application.status === ApplicationStatus.FEE_CONFIRMED) {
        const hasConfirmedFee = activeFees.some(
          (fee) => fee.currency === this.currency && fee.amountMinor >= this.requiredFeeMinor,
        );
        if (!hasConfirmedFee) {
          const documents = await this.repository.listApplicationDocumentsForStatus(
            record.applicationId,
            transaction,
          );
          nextStatus = this.statusWithoutConfirmedFee(documents);
        }
        await this.repository.updateApplicationStatus(
          record.applicationId,
          nextStatus,
          transaction,
        );
      }
      await this.repository.writeAudit(transaction, {
        actorId,
        action: "admissions.application_fee.voided",
        resourceType: "application_fee",
        resourceId: feeRecordId,
        reason: voidReason,
        metadata: { applicationId: record.applicationId },
      });
      return voided;
    });
  }

  private async assertPermission(actorId: string): Promise<void> {
    const status = await this.repository.findUserStatus(actorId);
    if (status !== "ACTIVE") {
      throw new ForbiddenException(
        "An active account with application-fee permission is required.",
      );
    }
    const snapshot = await this.rbac.getAuthorizationSnapshot(actorId);
    if (!snapshot.permissions.includes(APPLICATION_FEE_PERMISSION)) {
      throw new ForbiddenException(`The ${APPLICATION_FEE_PERMISSION} permission is required.`);
    }
  }

  private assertApplicationOpen(status: ApplicationStatus): void {
    if (
      status === ApplicationStatus.ADMITTED ||
      status === ApplicationStatus.REJECTED ||
      status === ApplicationStatus.WITHDRAWN
    ) {
      throw new ConflictException("A final application cannot receive an application-fee deposit.");
    }
  }

  private statusWithoutConfirmedFee(
    documents: {
      type: ApplicationDocumentType;
      status: ApplicationDocumentStatus;
    }[],
  ): ApplicationStatus {
    const approved = REQUIRED_APPLICATION_DOCUMENT_TYPES.every((type) => {
      const required = documents.filter((document) => document.type === type);
      return (
        required.length > 0 &&
        required.every((document) => document.status === ApplicationDocumentStatus.APPROVED)
      );
    });
    if (approved) {
      return ApplicationStatus.DOCS_APPROVED;
    }
    if (
      REQUIRED_APPLICATION_DOCUMENT_TYPES.some((type) =>
        documents.some(
          (document) =>
            document.type === type && document.status === ApplicationDocumentStatus.REJECTED,
        ),
      )
    ) {
      return ApplicationStatus.DOCS_REJECTED;
    }
    return documents.length > 0 ? ApplicationStatus.UNDER_REVIEW : ApplicationStatus.SUBMITTED;
  }

  private requiredText(value: string, label: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BadRequestException(`${label} is required.`);
    }
    return value.trim();
  }
}
