// Purpose: Define role-specific navigation items and semantic permission metadata.
// Used by: AppShell and NavigationRail.
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Home,
  Landmark,
  Library,
  Megaphone,
  ReceiptText,
  Settings2,
  UserRound,
  Users,
} from "lucide-react";
import type { AppRole } from "@/lib/auth-role";

/** One navigation destination shown in a role's rail. */
export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  permission: string | null;
  enabled: boolean;
}

/** A labeled rail section containing related destinations. */
export interface NavSection {
  label: string;
  items: readonly NavItem[];
}

const item = (
  label: string,
  icon: LucideIcon,
  href: string,
  permission: string | null,
  enabled = true,
): NavItem => ({ label, icon, href, permission, enabled });

/** Navigation sections by role, with inactive Phase 3+ items omitted. */
export const NAV_CONFIG: Record<AppRole, readonly NavSection[]> = {
  student: [
    {
      label: "Academic",
      items: [
        item("Home", Home, "/student", "academic:unit:select"),
        item("My Programme", GraduationCap, "/student/programme", "academic:catalog:read"),
        item("Course Units", Library, "/student/course-units", "academic:unit:select"),
        item("Timetable", CalendarDays, "/student/timetable", "academic:session:attend"),
        item("Attendance", ClipboardCheck, "/student/attendance", "academic:attendance:read_own"),
        item("Announcements", Megaphone, "/student/announcements", "auth:profile:read_own"),
      ],
    },
  ],
  lecturer: [
    {
      label: "Teaching",
      items: [
        item("Home", Home, "/lecturer", "academic:session:manage"),
        item("My Course Units", Library, "/lecturer/course-units", "academic:session:manage"),
        item("Class Sessions", CalendarDays, "/lecturer/sessions", "academic:session:manage"),
        item("Attendance", ClipboardCheck, "/lecturer/attendance", "attendance:review"),
        item("Announcements", Megaphone, "/lecturer/announcements", "announcements:post-own"),
      ],
    },
  ],
  registrar: [
    {
      label: "Academic management",
      items: [
        item("Home", Home, "/registrar", "academic:structure:manage"),
        item(
          "Faculties & Departments",
          Building2,
          "/registrar/structure",
          "academic:structure:manage",
        ),
        item("Programmes", GraduationCap, "/registrar/programmes", "academic:structure:manage"),
        item("Intakes", Settings2, "/registrar/intakes", "academic:structure:manage"),
        item("Course Units", Library, "/registrar/course-units", "academic:curriculum:manage"),
        item("Curriculum", ClipboardCheck, "/registrar/curriculum", "academic:curriculum:manage"),
        item("Offerings & Lecturers", Users, "/registrar/offerings", "academic:offering:manage"),
        item("Class Sessions", CalendarDays, "/registrar/sessions", "academic:session:manage"),
      ],
    },
    {
      label: "Records",
      items: [
        item("Students", UserRound, "/registrar/students", "sis:student:read"),
        item("Announcements", Megaphone, "/registrar/announcements", "announcements:manage"),
        item("Calendar", CalendarDays, "/registrar/calendar", "calendar:event:manage"),
      ],
    },
  ],
  admin: [
    {
      label: "Administration",
      items: [
        item("Home", Home, "/admin", "admin:user:manage"),
        item("Users", Users, "/admin/users", "admin:user:manage"),
      ],
    },
  ],
  admissions_officer: [
    {
      label: "Admissions",
      items: [
        item("Home", Home, "/admissions", "admissions:application:manage"),
        item(
          "Applications",
          ClipboardCheck,
          "/admissions/applications",
          "admissions:application:manage",
        ),
      ],
    },
  ],
  admissions_head: [
    {
      label: "Admissions",
      items: [
        item("Home", Home, "/admissions", "admissions:admit"),
        item("Applications", ClipboardCheck, "/admissions/applications", "admissions:admit"),
        item(
          "Study Mode Changes",
          Landmark,
          "/admissions/study-mode-changes",
          "admissions:study-mode:change",
        ),
      ],
    },
  ],
  bursar: [
    {
      label: "Finance",
      items: [
        item(
          "Application Fees",
          ReceiptText,
          "/finance/application-fees",
          "admissions:fee:confirm",
        ),
      ],
    },
  ],
};
