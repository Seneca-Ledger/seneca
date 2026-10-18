// Screenshot stands only: moves this Node process's clock to TOUR_SHOTS_NOW (an ISO date-time)
// and lets it run on from there. Preloaded into the backend of the guide-screenshot stack
// (`NODE_OPTIONS=--require …`), so that "this month" on the server — budget periods, the net
// worth range, upcoming charges, advice — is the demo data's anchor month whatever the real
// date of the run is. Never part of a real deployment.

const target = Date.parse(process.env.TOUR_SHOTS_NOW ?? '');
if (Number.isNaN(target)) {
  throw new Error('TOUR_SHOTS_NOW must be an ISO date-time');
}

const RealDate = Date;
const offset = target - RealDate.now();

class ShiftedDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) {
      super(RealDate.now() + offset);
    } else {
      super(...args);
    }
  }

  static now() {
    return RealDate.now() + offset;
  }

  // Dates Node makes itself (file stats) still count as dates.
  static [Symbol.hasInstance](value) {
    return value instanceof RealDate;
  }
}

// Called without `new`, Date returns the current time as a string.
globalThis.Date = new Proxy(ShiftedDate, {
  apply: () => new ShiftedDate().toString(),
});
