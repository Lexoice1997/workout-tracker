export const todayLocal = (d = new Date()): string =>
  new Intl.DateTimeFormat('en-CA').format(d);
