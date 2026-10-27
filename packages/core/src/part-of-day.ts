export type PartOfDay = 'morning' | 'day' | 'evening' | 'night';

/**
 * Part of day by local hour, as defined in the design: morning 05–11, day 11–17,
 * evening 17–22, night 22–05. Drives the greeting and the background scene.
 */
export function partOfDay(date: Date): PartOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}
