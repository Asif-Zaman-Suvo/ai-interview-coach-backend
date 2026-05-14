/** Marker `sessionId` values for questions in the manual bank (not tied to an interview session). */
export const PRIMARY_QUESTION_BANK_SESSION_ID = '__question_bank__';
export const QUESTION_BANK_SESSION_IDS = [
  PRIMARY_QUESTION_BANK_SESSION_ID,
  'admin-manual',
] as const;
