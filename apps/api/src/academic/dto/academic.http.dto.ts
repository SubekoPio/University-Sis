// Purpose: Validate HTTP payloads for academic structure, sessions, attendance, and communications.
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  AnnouncementCategory,
  AttendanceStatus,
  AwardLevel,
  CommunicationAudienceType,
  CourseUnitLevel,
  CourseUnitStatus,
  DayOfWeek,
  DeliveryMode,
  IntakeStatus,
  OfferingLecturerRole,
  ProgrammeCourseUnitType,
} from "@prisma/client";

/** UUID route parameter for academic resources. */
export class AcademicIdParamDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  id!: string;
}

/** UUID route parameter for a course-unit resource. */
export class CourseUnitIdParamDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() id!: string;
}
/** UUID route parameter for an offering resource. */
export class OfferingIdParamDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() id!: string;
}
/** UUID route parameter for a session resource. */
export class SessionIdParamDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() id!: string;
}
/** UUID route parameter for a student resource. */
export class StudentIdParamDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() id!: string;
}

/**
 *
 */
export class CreateFacultyDto {
  @ApiProperty({ maxLength: 20 }) @IsString() @MaxLength(20) code!: string;
  @ApiProperty({ maxLength: 200 }) @IsString() @MaxLength(200) name!: string;
}
/**
 *
 */
export class UpdateFacultyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) name?: string;
}
/**
 *
 */
export class CreateDepartmentDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() facultyId!: string;
  @ApiProperty({ maxLength: 20 }) @IsString() @MaxLength(20) code!: string;
  @ApiProperty({ maxLength: 200 }) @IsString() @MaxLength(200) name!: string;
}
/**
 *
 */
export class UpdateDepartmentDto {
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() facultyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) name?: string;
}
/**
 *
 */
export class CreateProgrammeDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() departmentId!: string;
  @ApiProperty({ maxLength: 20 }) @IsString() @MaxLength(20) code!: string;
  @ApiProperty({ maxLength: 200 }) @IsString() @MaxLength(200) name!: string;
  @ApiProperty({ enum: AwardLevel }) @IsEnum(AwardLevel) awardLevel!: AwardLevel;
  @ApiProperty({ minimum: 1 }) @Type(() => Number) @IsInt() @Min(1) durationYears!: number;
}
/**
 *
 */
export class UpdateProgrammeDto {
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() departmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) name?: string;
  @ApiPropertyOptional({ enum: AwardLevel })
  @IsOptional()
  @IsEnum(AwardLevel)
  awardLevel?: AwardLevel;
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationYears?: number;
}

/**
 *
 */
export class IntakeDto {
  @ApiProperty({ minimum: 1, maximum: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  sequence!: number;
  @ApiProperty() @IsString() @MaxLength(200) name!: string;
  @ApiProperty({ type: String, format: "date-time" }) @Type(() => Date) @IsDate() startDate!: Date;
  @ApiProperty({ type: String, format: "date-time" }) @Type(() => Date) @IsDate() endDate!: Date;
  @ApiProperty({ type: String, format: "date-time" })
  @Type(() => Date)
  @IsDate()
  selectionOpensAt!: Date;
  @ApiProperty({ type: String, format: "date-time" })
  @Type(() => Date)
  @IsDate()
  selectionClosesAt!: Date;
}
/**
 *
 */
export class CreateAcademicYearDto {
  @ApiProperty() @IsString() @MaxLength(200) label!: string;
  @ApiProperty({ type: String, format: "date-time" }) @Type(() => Date) @IsDate() startDate!: Date;
  @ApiProperty({ type: String, format: "date-time" }) @Type(() => Date) @IsDate() endDate!: Date;
  @ApiProperty({ type: [IntakeDto] }) @IsArray() intakes!: IntakeDto[];
}
/**
 *
 */
export class UpdateAcademicYearDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) label?: string;
  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;
  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;
}
/**
 *
 */
export class UpdateIntakeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) name?: string;
  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;
  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;
  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  selectionOpensAt?: Date;
  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  selectionClosesAt?: Date;
}
/**
 *
 */
export class TransitionIntakeDto {
  @ApiProperty({ enum: IntakeStatus }) @IsEnum(IntakeStatus) status!: IntakeStatus;
}

/**
 *
 */
export class CreateCourseUnitDto {
  @ApiProperty() @IsString() @MaxLength(30) code!: string;
  @ApiProperty() @IsString() @MaxLength(200) name!: string;
  @ApiProperty({ minimum: 1 }) @Type(() => Number) @IsInt() @Min(1) creditUnits!: number;
  @ApiProperty({ enum: CourseUnitLevel }) @IsEnum(CourseUnitLevel) level!: CourseUnitLevel;
  @ApiProperty({ format: "uuid" }) @IsUUID() ownerDepartmentId!: string;
  @ApiPropertyOptional({ enum: CourseUnitStatus })
  @IsOptional()
  @IsEnum(CourseUnitStatus)
  status?: CourseUnitStatus;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isGeneral?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() openToAllFaculties?: boolean;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  eligibleFacultyIds?: string[];
}
/**
 *
 */
export class UpdateCourseUnitDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) name?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) creditUnits?: number;
  @ApiPropertyOptional({ enum: CourseUnitLevel })
  @IsOptional()
  @IsEnum(CourseUnitLevel)
  level?: CourseUnitLevel;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() ownerDepartmentId?: string;
  @ApiPropertyOptional({ enum: CourseUnitStatus })
  @IsOptional()
  @IsEnum(CourseUnitStatus)
  status?: CourseUnitStatus;
}
/**
 *
 */
export class GeneralEligibilityDto {
  @ApiProperty() @IsBoolean() isGeneral!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() openToAllFaculties?: boolean;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  eligibleFacultyIds?: string[];
}
/**
 *
 */
export class CurriculumPlacementDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() courseUnitId!: string;
  @ApiProperty({ enum: ProgrammeCourseUnitType })
  @IsEnum(ProgrammeCourseUnitType)
  type!: ProgrammeCourseUnitType;
}
/**
 *
 */
export class CurriculumPlacementListDto {
  @ApiProperty({ type: [CurriculumPlacementDto] }) @IsArray() placements!: CurriculumPlacementDto[];
}
/**
 *
 */
export class ElectiveRuleDto {
  @ApiProperty({ minimum: 0 }) @Type(() => Number) @IsInt() @Min(0) minCredits!: number;
  @ApiProperty({ minimum: 0 }) @Type(() => Number) @IsInt() @Min(0) maxCredits!: number;
}
/**
 *
 */
export class ElectiveRuleListDto {
  @ApiProperty({ type: [ElectiveRuleDto] }) @IsArray() rules!: ElectiveRuleDto[];
}
/**
 *
 */
export class PrerequisiteListDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID("4", { each: true })
  prerequisiteIds!: string[];
}

/**
 *
 */
export class CreateOfferingDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() courseUnitId!: string;
  @ApiProperty({ format: "uuid" }) @IsUUID() intakeId!: string;
  @ApiProperty({ enum: DeliveryMode }) @IsEnum(DeliveryMode) deliveryMode!: DeliveryMode;
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number | null;
}
/**
 *
 */
export class BulkOfferingDto {
  @ApiProperty({ enum: DeliveryMode }) @IsEnum(DeliveryMode) deliveryMode!: DeliveryMode;
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number | null;
}
/**
 *
 */
export class OfferingCapacityDto {
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity!: number | null;
}
/**
 *
 */
export class AssignLecturerDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() lecturerId!: string;
  @ApiProperty({ enum: OfferingLecturerRole })
  @IsEnum(OfferingLecturerRole)
  role!: OfferingLecturerRole;
}

/**
 *
 */
export class CreateLecturerDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() userId!: string;
  @ApiProperty({ format: "uuid" }) @IsUUID() departmentId!: string;
  @ApiProperty() @IsString() @MaxLength(50) staffNumber!: string;
}
/**
 *
 */
export class UpdateLecturerDto {
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID() departmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) staffNumber?: string;
}
/**
 *
 */
export class UpdateStudentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) studentNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) phone?: string | null;
  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfBirth?: Date | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) nationality?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) gender?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) nationalId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) nextOfKinName?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) nextOfKinPhone?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) nextOfKinRelationship?:
    string | null;
}

/**
 *
 */
export class TimetableSlotDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() offeringId!: string;
  @ApiProperty({ enum: DayOfWeek }) @IsEnum(DayOfWeek) dayOfWeek!: DayOfWeek;
  @ApiProperty({ type: String, format: "date-time" }) @Type(() => Date) @IsDate() startTime!: Date;
  @ApiProperty({ type: String, format: "date-time" }) @Type(() => Date) @IsDate() endTime!: Date;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) room?: string | null;
  @ApiProperty({ enum: DeliveryMode }) @IsEnum(DeliveryMode) deliveryMode!: DeliveryMode;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) defaultMeetingUrl?:
    string | null;
}
/**
 *
 */
export class MeetingLinkDto {
  @ApiProperty({ maxLength: 2000 }) @IsString() @MaxLength(2000) meetingUrl!: string;
}
/**
 *
 */
export class RescheduleSessionDto {
  @ApiProperty({ type: String, format: "date-time" }) @Type(() => Date) @IsDate() startsAt!: Date;
  @ApiProperty({ type: String, format: "date-time" }) @Type(() => Date) @IsDate() endsAt!: Date;
}

/**
 *
 */
export class PhysicalAttendanceMarkDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() studentId!: string;
  @ApiProperty({ enum: AttendanceStatus }) @IsEnum(AttendanceStatus) status!: AttendanceStatus;
}
/**
 *
 */
export class PhysicalAttendanceBulkDto {
  @ApiProperty({ type: [PhysicalAttendanceMarkDto] })
  @IsArray()
  marks!: PhysicalAttendanceMarkDto[];
}
/**
 *
 */
export class AttendanceOverrideDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() studentId!: string;
  @ApiProperty({ enum: AttendanceStatus }) @IsEnum(AttendanceStatus) status!: AttendanceStatus;
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

/**
 *
 */
export class AttendanceCsvReportDto {
  @ApiProperty({ description: "RFC 4180 attendance report CSV" })
  @IsString()
  @MinLength(1)
  @MaxLength(10_000_000)
  csv!: string;
}

/**
 *
 */
export class UnitSelectionDto {
  @ApiProperty({ format: "uuid" }) @IsUUID() studentId!: string;
  @ApiProperty({ format: "uuid" }) @IsUUID() intakeId!: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsUUID("4", { each: true }) offeringIds!: string[];
}

/**
 *
 */
export class WeeklyScheduleQueryDto {
  @ApiProperty({ type: String, format: "date-time" })
  @Type(() => Date)
  @IsDate()
  weekContaining!: Date;
}

/**
 *
 */
export class CommunicationAudienceDto {
  @ApiProperty({ enum: CommunicationAudienceType })
  @IsEnum(CommunicationAudienceType)
  audienceType!: CommunicationAudienceType;
  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID()
  targetId: string | null = null;
}
/**
 *
 */
export class CreateAnnouncementDto {
  @ApiProperty() @IsString() @MaxLength(200) title!: string;
  @ApiProperty() @IsString() @MaxLength(5000) body!: string;
  @ApiProperty({ enum: AnnouncementCategory })
  @IsEnum(AnnouncementCategory)
  category!: AnnouncementCategory;
  @ApiProperty({ type: [CommunicationAudienceDto] })
  @IsArray()
  audiences!: CommunicationAudienceDto[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPinned?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishAt?: Date;
  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date | null;
}
/**
 *
 */
export class UpdateAnnouncementDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) body?: string;
  @ApiPropertyOptional({ enum: AnnouncementCategory })
  @IsOptional()
  @IsEnum(AnnouncementCategory)
  category?: AnnouncementCategory;
  @ApiPropertyOptional({ type: [CommunicationAudienceDto] })
  @IsOptional()
  @IsArray()
  audiences?: CommunicationAudienceDto[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPinned?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishAt?: Date;
  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date | null;
}
