/**
 * Données de cours en dur, calquées sur le proto HTML.
 *
 * À remplacer par un appel à `GET /api/courses/week` quand l'endpoint backend
 * sera en place. Pour l'instant ça permet de voir l'écran Planning.
 */

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Lun, 6=Dim
export type Discipline = 'gi' | 'nogi' | 'mma' | 'openmat' | 'mixed';

export interface CoachAlert {
  type: 'late' | 'absent';
  message: string;
}

/**
 * `courseKey` = identifiant logique d'un cours récurrent (ex: 'jjb-gi'),
 * partagé avec les notifications pour la sync cloche/switch.
 */
export interface Course {
  id: string;
  courseKey: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  name: string;
  coachName: string | null;
  location: string;
  discipline: Discipline;
  alert?: CoachAlert;
}

export const mockCourses: Course[] = [
  // Lundi 5 mai
  { id: '1', courseKey: 'grappling-debutant', dayOfWeek: 0, startTime: '18:30', endTime: '19:30', name: 'Grappling No-Gi débutant', coachName: 'Vincent', location: 'Dojo de Sorgues', discipline: 'nogi' },
  { id: '2', courseKey: 'grappling-confirme', dayOfWeek: 0, startTime: '19:30', endTime: '20:30', name: 'Grappling No-Gi Confirmé', coachName: 'Nassim', location: 'Dojo de Sorgues', discipline: 'nogi' },
  { id: '3', courseKey: 'mma', dayOfWeek: 0, startTime: '20:30', endTime: '21:30', name: 'MMA cours à thèmes', coachName: 'Victor', location: 'Dojo de Vedène', discipline: 'mma' },

  // Mardi 6 mai (alerte coach en retard sur JJB)
  { id: '4', courseKey: 'jjb-gi', dayOfWeek: 1, startTime: '18:30', endTime: '19:30', name: 'JJB (Gi)', coachName: 'Victor', location: 'Dojo de Sorgues', discipline: 'gi',
    alert: { type: 'late', message: "Coach en retard de 15 min — démarrez l'échauffement entre vous" } },
  { id: '5', courseKey: 'open-mat', dayOfWeek: 1, startTime: '19:30', endTime: '20:30', name: 'Open Mat', coachName: 'Samuel', location: 'Dojo de Sorgues', discipline: 'openmat' },
  { id: '6', courseKey: 'mma', dayOfWeek: 1, startTime: '20:30', endTime: '21:30', name: 'MMA cours à thèmes', coachName: 'Victor', location: 'Dojo de Vedène', discipline: 'mma' },

  // Mercredi 7 mai (alerte coach absent sur MMA)
  { id: '7', courseKey: 'grappling-debutant', dayOfWeek: 2, startTime: '18:30', endTime: '19:30', name: 'Grappling No-Gi débutant', coachName: 'Vincent', location: 'Dojo de Sorgues', discipline: 'nogi' },
  { id: '8', courseKey: 'grappling-confirme', dayOfWeek: 2, startTime: '19:30', endTime: '20:30', name: 'Grappling No-Gi Confirmé', coachName: 'Nassim', location: 'Dojo de Sorgues', discipline: 'nogi' },
  { id: '9', courseKey: 'mma', dayOfWeek: 2, startTime: '20:30', endTime: '21:30', name: 'MMA cours à thèmes', coachName: 'Victor', location: 'Dojo de Vedène', discipline: 'mma',
    alert: { type: 'absent', message: 'Coach absent — cours libre maintenu' } },

  // Jeudi 8 mai
  { id: '10', courseKey: 'jjb-gi', dayOfWeek: 3, startTime: '18:30', endTime: '19:30', name: 'JJB (Gi)', coachName: 'Victor', location: 'Dojo de Sorgues', discipline: 'gi' },
  { id: '11', courseKey: 'open-mat', dayOfWeek: 3, startTime: '19:30', endTime: '20:30', name: 'Open Mat', coachName: 'Samuel', location: 'Dojo de Sorgues', discipline: 'openmat' },

  // Vendredi 9 mai
  { id: '12', courseKey: 'grappling-debutant', dayOfWeek: 4, startTime: '18:30', endTime: '19:30', name: 'Grappling No-Gi débutant', coachName: 'Vincent', location: 'Dojo de Sorgues', discipline: 'nogi' },
  { id: '13', courseKey: 'grappling-confirme', dayOfWeek: 4, startTime: '19:30', endTime: '20:30', name: 'Grappling No-Gi Confirmé', coachName: 'Nassim', location: 'Dojo de Sorgues', discipline: 'nogi' },

  // Samedi 10 et Dimanche 11 : pas de cours
];

export const dayLabels: { short: string; full: string; date: number }[] = [
  { short: 'Lun', full: 'Lundi', date: 5 },
  { short: 'Mar', full: 'Mardi', date: 6 },
  { short: 'Mer', full: 'Mercredi', date: 7 },
  { short: 'Jeu', full: 'Jeudi', date: 8 },
  { short: 'Ven', full: 'Vendredi', date: 9 },
  { short: 'Sam', full: 'Samedi', date: 10 },
  { short: 'Dim', full: 'Dimanche', date: 11 },
];
