/**
 * NTPGA and STPGA each run several series under one schedule page (AAT/Medalist/Prep for NTPGA;
 * Prestige Tour/Junior Tour/Junior Links/Little Linksters for STPGA); AJGA runs one national schedule
 * mixing its main Open Championships with Qualifiers (nearly half of all events), Invitationals, the
 * ICL Academy Junior All-Star Series, Preview events and Senior tournaments -- same categories AJGA's
 * own entry-limit rules name ("Open and ICL Academy Junior All-Star Series combined... Invitationals,
 * Preview Series tournaments, & Senior tournaments are not included"). Splitting each into its own
 * subscribable tour keeps a parent's Available list from being swamped by every qualifier nationwide.
 * Keyed by the base tourId (passed to publish-schedule.ts for hand-published tours, or applied directly
 * in scrape.ts for a still-scraped one like AJGA); each classifier sorts one event's name into the right
 * sub-tour id. The ids must match src/data/tours.ts.
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
  ajga: (name) =>
    /^Qualifier\b/i.test(name)
      ? 'ajga-qualifier'
      : /\bInvitational\b/i.test(name) // checked before All-Star: a name can carry both (e.g. "AJGA Junior All-Star Invitational")
        ? 'ajga-invitational'
        : /\bJunior All-Star\b/i.test(name)
          ? 'ajga-allstar'
          : /\bPreview\b/i.test(name)
            ? 'ajga-preview'
            : /\bSenior\b/i.test(name)
              ? 'ajga-senior'
              : 'ajga-open',
};
