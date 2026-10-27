import { partOfDay, type PartOfDay } from '@daybrief/core';
import { useEffect, useState } from 'react';

/** Current part of day by local time, re-checked every minute. */
export function usePartOfDay(): PartOfDay {
  const [value, setValue] = useState(() => partOfDay(new Date()));
  useEffect(() => {
    const id = setInterval(() => setValue(partOfDay(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);
  return value;
}
