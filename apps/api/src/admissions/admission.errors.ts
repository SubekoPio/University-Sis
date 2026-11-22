// Purpose: Provide typed admission workflow errors for unmet admission prerequisites.
import { ConflictException } from "@nestjs/common";

/** Machine-readable reasons an application is not yet eligible for admission. */
export type AdmissionEligibilityFailure =
  | "REQUIRED_DOCUMENTS_MISSING"
  | "REQUIRED_DOCUMENTS_NOT_APPROVED"
  | "APPLICATION_FEE_NOT_CONFIRMED"
  | "APPLICATION_ALREADY_FINAL";

/** Conflict returned when an application has not met every admission prerequisite. */
export class AdmissionEligibilityError extends ConflictException {
  /** Stable reasons callers can inspect without parsing a message. */
  readonly failures: AdmissionEligibilityFailure[];

  /** Describes the specific unmet admission prerequisites. */
  constructor(failures: AdmissionEligibilityFailure[]) {
    super({
      message: "The application is not eligible for admission.",
      failures,
    });
    this.name = AdmissionEligibilityError.name;
    this.failures = failures;
  }
}
