// Purpose: Coordinate required-document review and application status transitions.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ApplicationDocumentStatus, ApplicationStatus } from "@prisma/client";
import { isUUID } from "class-validator";
import { RbacService } from "../common/rbac/rbac.service.js";
import { AdmissionsRepository } from "./admissions.repository.js";
import {
  REQUIRED_APPLICATION_DOCUMENT_TYPES,
  type DocumentReviewResult,
} from "./admissions.types.js";

const DOCUMENT_REVIEW_PERMISSION = "admissions:document:review";

/** Reviews application documents and promotes applications when all required items pass. */
@Injectable()
export class DocumentReviewService {
  /** Receives admissions persistence and permission services. */
  constructor(
    private readonly repository: AdmissionsRepository,
    private readonly rbac: RbacService,
  ) {}

  /** Approves one document and records the review note and actor. */
  approveDocument(
    documentId: string,
    reviewerId: string,
    note: string,
  ): Promise<DocumentReviewResult> {
    return this.reviewDocument(documentId, reviewerId, note, ApplicationDocumentStatus.APPROVED);
  }

  /** Rejects one document and records the review note and actor. */
  rejectDocument(
    documentId: string,
    reviewerId: string,
    note: string,
  ): Promise<DocumentReviewResult> {
    return this.reviewDocument(documentId, reviewerId, note, ApplicationDocumentStatus.REJECTED);
  }

  private async reviewDocument(
    documentId: string,
    reviewerId: string,
    note: string,
    decision: typeof ApplicationDocumentStatus.APPROVED | typeof ApplicationDocumentStatus.REJECTED,
  ): Promise<DocumentReviewResult> {
    await this.assertPermission(reviewerId);
    if (!isUUID(documentId)) {
      throw new BadRequestException("Document ID must be a valid UUID.");
    }
    const normalizedNote = this.requiredNote(note);

    return this.repository.withTransaction(async (transaction) => {
      const current = await this.repository.findDocumentForReview(documentId, transaction);
      if (current === null) {
        throw new NotFoundException("Application document not found.");
      }
      this.assertApplicationReviewable(current.application.status);

      const document = await this.repository.updateDocumentReview(
        documentId,
        reviewerId,
        decision,
        normalizedNote,
        new Date(),
        transaction,
      );
      const documents = await this.repository.listApplicationDocuments(
        current.applicationId,
        transaction,
      );
      const allRequiredDocumentsApproved = REQUIRED_APPLICATION_DOCUMENT_TYPES.every((type) => {
        const required = documents.filter((candidate) => candidate.type === type);
        return (
          required.length > 0 &&
          required.every((candidate) => candidate.status === ApplicationDocumentStatus.APPROVED)
        );
      });
      const requiredDocumentRejected = REQUIRED_APPLICATION_DOCUMENT_TYPES.some((type) =>
        documents.some(
          (candidate) =>
            candidate.type === type && candidate.status === ApplicationDocumentStatus.REJECTED,
        ),
      );
      const nextStatus = allRequiredDocumentsApproved
        ? current.application.status === ApplicationStatus.FEE_CONFIRMED
          ? ApplicationStatus.FEE_CONFIRMED
          : ApplicationStatus.DOCS_APPROVED
        : requiredDocumentRejected
          ? ApplicationStatus.DOCS_REJECTED
          : current.application.status === ApplicationStatus.FEE_CONFIRMED
            ? ApplicationStatus.FEE_CONFIRMED
            : ApplicationStatus.UNDER_REVIEW;

      await this.repository.updateApplicationStatus(current.applicationId, nextStatus, transaction);
      await this.repository.writeAudit(transaction, {
        actorId: reviewerId,
        action:
          decision === ApplicationDocumentStatus.APPROVED
            ? "admissions.document.approved"
            : "admissions.document.rejected",
        resourceType: "application_document",
        resourceId: documentId,
        reason: normalizedNote,
        metadata: { applicationId: current.applicationId },
      });

      return {
        id: document.id,
        applicationId: document.applicationId,
        status: decision,
        reviewerNote: document.reviewerNote ?? normalizedNote,
        applicationStatus: nextStatus,
      };
    });
  }

  private async assertPermission(reviewerId: string): Promise<void> {
    const status = await this.repository.findUserStatus(reviewerId);
    if (status !== "ACTIVE") {
      throw new ForbiddenException(
        "An active account with document-review permission is required.",
      );
    }
    const snapshot = await this.rbac.getAuthorizationSnapshot(reviewerId);
    if (!snapshot.permissions.includes(DOCUMENT_REVIEW_PERMISSION)) {
      throw new ForbiddenException(`The ${DOCUMENT_REVIEW_PERMISSION} permission is required.`);
    }
  }

  private requiredNote(note: string): string {
    if (typeof note !== "string" || note.trim().length === 0) {
      throw new BadRequestException("A review note is required.");
    }
    return note.trim();
  }

  private assertApplicationReviewable(status: ApplicationStatus): void {
    if (
      status === ApplicationStatus.ADMITTED ||
      status === ApplicationStatus.REJECTED ||
      status === ApplicationStatus.WITHDRAWN
    ) {
      throw new ConflictException(
        "Documents cannot be reviewed after a final application decision.",
      );
    }
  }
}
