/** App version stamp: vSHORTYEAR.SHORTMONTH.SHORTDAY (e.g. v26.8.11). */
export function formatAppVersion(date: Date): string {
  const year = date.getFullYear() % 100;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `v${year}.${month}.${day}`;
}

export const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ?? formatAppVersion(new Date());
