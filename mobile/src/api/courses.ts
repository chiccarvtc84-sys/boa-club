import { apiRequest } from './client';

/**
 * Conventions :
 * - day_of_week côté backend : 0=Dim, 1=Lun, 2=Mar, …, 6=Sam (convention Postgres)
 * - day_of_week côté mobile (mockCourses, DayTabs) : 0=Lun, 1=Mar, …, 6=Dim
 *
 * Le helper `backendDayToMobile` fait la conversion à l'arrivée.
 */

export type CourseDiscipline =
  | 'jjb_gi'
  | 'jjb_nogi'
  | 'mma'
  | 'wrestling'
  | 'open_mat'
  | 'mixed';

export type CourseStatus = 'scheduled' | 'cancelled' | 'free_open';

export interface RecurringCourseDTO {
  id: string;
  day_of_week: number; // 0=Dim, 1=Lun, …, 6=Sam (backend)
  start_time: string;  // "18:30"
  end_time: string;
  name: string;
  location: string | null;
  discipline: CourseDiscipline;
  intensity?: string;
  coach_id?: string;
  coach_name?: string;
}

export interface CourseInstanceOverrideDTO {
  recurring_course_id: string;
  date: string; // "2026-05-06"
  status: CourseStatus;
  coach_late_minutes?: number;
  coach_absent_message?: string;
}

export interface WeekResponse {
  from: string; // "2026-05-04" (lundi)
  to: string;   // "2026-05-10" (dimanche)
  courses: RecurringCourseDTO[];
  instances: CourseInstanceOverrideDTO[];
}

export const coursesApi = {
  /**
   * `from` doit être au format YYYY-MM-DD ou omis (la semaine courante est utilisée).
   * Le backend normalise toujours au lundi de la semaine.
   */
  week: (from?: string) => {
    const path = from ? `/api/courses/week?from=${from}` : '/api/courses/week';
    return apiRequest<WeekResponse>(path);
  },
};

/** Convertit le day_of_week backend (0=Dim, 1=Lun) vers mobile (0=Lun, …, 6=Dim). */
export function backendDayToMobile(backendDay: number): number {
  return backendDay === 0 ? 6 : backendDay - 1;
}
