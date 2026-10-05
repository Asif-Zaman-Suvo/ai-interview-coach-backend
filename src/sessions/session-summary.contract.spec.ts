import { validateSessionSummary } from './session-summary.contract';
describe('session summary output validation', () => {
  const valid = {
    summary: ' Strong examples, but weak trade-off analysis. ',
    topImprovements: [' Compare alternatives. '],
  };
  it('validates and trims the exact public contract', () => {
    expect(validateSessionSummary(valid)).toEqual({
      summary: valid.summary.trim(),
      topImprovements: ['Compare alternatives.'],
    });
  });
  it.each([
    null,
    'malformed',
    {},
    { ...valid, summary: ' ' },
    { ...valid, summary: 'x'.repeat(2001) },
    { ...valid, topImprovements: [1] },
    { ...valid, topImprovements: [''] },
    { ...valid, topImprovements: ['one', 'two', 'three', 'four'] },
    { ...valid, topImprovements: ['same', 'same'] },
    { ...valid, provider: 'secret' },
  ])('rejects invalid output %j', (value) =>
    expect(() => validateSessionSummary(value)).toThrow(
      'invalid_session_summary',
    ),
  );
});
