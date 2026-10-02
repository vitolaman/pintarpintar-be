// Links rendered to learners must not allow javascript:, data:, or plain http.
export const HTTPS_URL = {
  protocols: ['https'],
  require_protocol: true,
};

export const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Upper bound for free-text descriptions stored in `text` columns, so a
// single request cannot store an unbounded payload.
export const MAX_DESCRIPTION_LENGTH = 10_000;
