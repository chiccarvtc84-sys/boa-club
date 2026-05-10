/**
 * Helpers de dates pour le Planning et autres écrans.
 *
 * Convention dans l'app : `DayOfWeek` = 0=Lundi, 1=Mardi, ..., 6=Dimanche
 * (différent du `Date.prototype.getDay()` natif JS qui est 0=Dimanche,
 * 1=Lundi, ..., 6=Samedi).
 *
 * Toutes les fonctions ci-dessous travaillent en heure locale du téléphone
 * (timezone système). Elles ne font donc pas appel à `toISOString()` pour la
 * comparaison, qui basculerait en UTC et causerait des décalages d'un jour
 * pour les utilisateurs au coucher du soleil.
 */

import type { DayOfWeek } from '../data/mockCourses';

export const SHORT_DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
export const FULL_DAY_LABELS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
] as const;
export const FULL_MONTH_LABELS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/**
 * Convertit un Date JS en `DayOfWeek` côté app (0=Lun, 6=Dim).
 * Formule : (jsDay + 6) % 7
 *  - JS 0 (Dim) → 6
 *  - JS 1 (Lun) → 0
 *  - JS 6 (Sam) → 5
 */
export function dateToDayOfWeek(d: Date): DayOfWeek {
  return ((d.getDay() + 6) % 7) as DayOfWeek;
}

/**
 * Renvoie tous les jours d'un mois donné, en heure locale.
 * Année et mois en base 0 (janvier=0).
 */
export function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date(year, month, 1);
  while (cursor.getMonth() === month) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/**
 * Tronque une Date au début de journée locale (00:00:00.000).
 * Utile pour comparer 2 jours sans se faire piéger par les heures.
 */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Vrai si les 2 dates tombent le même jour calendaire local.
 */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Vrai si les 2 dates sont dans le même mois calendaire (année + mois).
 */
export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * Format complet pour l'utilisateur : "Lundi 5 mai".
 * Pas d'année, on est dans le mois courant.
 */
export function formatLongDate(d: Date): string {
  const dow = dateToDayOfWeek(d);
  return `${FULL_DAY_LABELS[dow]} ${d.getDate()} ${FULL_MONTH_LABELS[d.getMonth()]}`;
}
