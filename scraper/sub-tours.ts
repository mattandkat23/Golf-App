/**
 * NTPGA and STPGA each run several series under one schedule page (AAT/Medalist/Prep for NTPGA;
 * Prestige Tour/Junior Tour/Junior Links/Little Linksters for STPGA) -- splitting those into
 * separate subscribable tours keeps a parent's Available list from being swamped by every age
 * group's weekly qualifying round. Keyed by the base tourId passed to publish-schedule.ts; each
 * classifier sorts one event's name into the right sub-tour id. The ids must match src/data/tours.ts.
 */
export const SUB_TOUR_CLASSIFIERS: Record<string, (name: string) => string> = {
  ntpga: (name) => (/^Medalist Tour\b/i.test(name) ? 'ntpga-medalist' : /^Prep Tour\b/i.test(name) ? 'ntpga-prep' : 'ntpga-majors'),
  stpga: (name) =>
    /^Junior Tour\b/i.test(name)
      ? 'stpga-junior-tour'
      : /^Junior Links\b/i.test(name)
        ? 'stpga-junior-links'
        : /^Little Linksters\b/i.test(name)
          ? 'stpga-little-linksters'
          : 'stpga-prestige',
};
