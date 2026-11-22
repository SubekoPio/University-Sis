// Purpose: Validate HTTP payloads and parameters for admissions Phase 2 workflows.
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ApplicationDocumentType, StudentSchedule, StudyMode } from "@prisma/client";

/** UUID route parameter shared by admissions resources. */
export class AdmissionsIdParamDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  id!: string;
}

/** Uploaded document metadata supplied during application intake. */
export class ApplicationDocumentDto {
  @ApiProperty({ enum: ApplicationDocumentType })
  @IsEnum(ApplicationDocumentType)
  type!: ApplicationDocumentType;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  storageKey!: string;
}

/** Creates an application from the admission office or integration workflow. */
export class CreateApplicationDto {
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  applicantName!: string;

  @ApiProperty({ format: "email" })
  @IsString()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @MaxLength(50)
  phone!: string;

  @ApiProperty({ type: String, format: "date-time" })
  @Type(() => Date)
  @IsDate()
  dateOfBirth!: Date;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  nationality!: string;

  @ApiProperty({ enum: StudyMode })
  @IsEnum(StudyMode)
  studyMode!: StudyMode;

  @ApiProperty({ enum: StudentSchedule })
  @IsEnum(StudentSchedule)
  schedule!: StudentSchedule;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  desiredProgrammeId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  desiredIntakeId!: string;

  @ApiPropertyOptional({ type: [ApplicationDocumentDto] })
  @IsOptional()
  @IsArray()
  documents?: ApplicationDocumentDto[];

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalRef?: string;
}

/** Corrects mutable applicant fields before a final decision. */
export class UpdateApplicationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) applicantName?: string;
  @ApiPropertyOptional({ format: "email" })
  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfBirth?: Date;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) nationality?: string;
  @ApiPropertyOptional({ enum: StudyMode }) @IsOptional() @IsEnum(StudyMode) studyMode?: StudyMode;
  @ApiPropertyOptional({ enum: StudentSchedule })
  @IsOptional()
  @IsEnum(StudentSchedule)
  schedule?: StudentSchedule;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() desiredProgrammeId?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() desiredIntakeId?: string;
}

/** Reviews or rejects one application document. */
export class DocumentReviewDto {
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note!: string;
}

/** Records a physical application-fee bank deposit. */
export class RecordApplicationFeeDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  applicationId!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  bankName!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  bankReference!: string;

  @ApiProperty({ minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @ApiProperty({ type: String, format: "date-time" })
  @Type(() => Date)
  @IsDate()
  depositDate!: Date;
}

/** Admits an applicant with the required study mode. */
export class AdmitApplicationDto {
  @ApiProperty({ enum: StudyMode })
  @IsEnum(StudyMode)
  studyMode!: StudyMode;
}

/** Changes an admitted student's study mode. */
export class ChangeStudyModeDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  applicationId!: string;

  @ApiProperty({ enum: StudyMode })
  @IsEnum(StudyMode)
  studyMode!: StudyMode;

  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}
