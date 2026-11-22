// Purpose: Validate the secured university-website application intake payload.
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ApplicationDocumentType, StudentSchedule, StudyMode } from "@prisma/client";

/** Validated object-storage metadata for one supporting application document. */
export class WebsiteApplicationDocumentDto {
  /** Document category required by the admissions workflow. */
  @IsEnum(ApplicationDocumentType)
  type!: ApplicationDocumentType;

  /** Object-storage key; uploads are handled by the external website integration. */
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  storageKey!: string;
}

/** Applicant fields accepted by the signed, idempotent website integration route. */
export class WebsiteApplicationDto {
  /** Stable external application reference used as an idempotency key. */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  externalRef!: string;

  /** Applicant's full name. */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  applicantName!: string;

  /** Applicant's contact email address. */
  @IsEmail()
  @MaxLength(320)
  email!: string;

  /** Applicant's contact phone number. */
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  phone!: string;

  /** Applicant's date of birth. */
  @Type(() => Date)
  @IsDate()
  dateOfBirth!: Date;

  /** Applicant's nationality. */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nationality!: string;

  /** Study mode requested by the applicant. */
  @IsEnum(StudyMode)
  studyMode!: StudyMode;

  /** Regular student schedule requested by the applicant. */
  @IsEnum(StudentSchedule)
  schedule!: StudentSchedule;

  /** Desired active programme. */
  @IsUUID()
  desiredProgrammeId!: string;

  /** Desired active intake. */
  @IsUUID()
  desiredIntakeId!: string;

  /** Supporting document object keys already uploaded by the website. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => WebsiteApplicationDocumentDto)
  documents?: WebsiteApplicationDocumentDto[];
}
