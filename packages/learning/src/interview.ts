/**
 * The interview record of a Learning Card (DEC-LR-31): `cards/<number>/interview.md`, next to its two languages. It
 * keeps the input of the card as the interview of the learning-card skill gave it: each of the seven questions with
 * the answer of its author and where that answer went in the card, the ladder, who brought what, and what is still
 * to do. Data Hub does not show it; the fact check reads the card against it.
 *
 *     # Interview record · 2.1.3 Leading versus lagging indicators
 *
 *     | | |
 *     | --- | --- |
 *     | Card | 2.1.3 Leading versus lagging indicators (Learning Level 2, section 2.1 Metric literacy) |
 *     | Author | … |
 *     | Interviewed | 2026-11-10, with the learning-card skill |
 *     | Fact check | … |
 *     | Test reader | … |
 *
 *     ## 1. The reader's question
 *     **Asked:** … **Answer:** … **In the card:** …
 *     …
 *     ## 7. Neighbours
 *     ## The ladder
 *     ## Who brought what
 *     ## To do
 */

/** The sections of an interview record, in their order. */
export const INTERVIEW_SECTIONS = [
  "1. The reader's question",
  '2. What went wrong',
  '3. The aha',
  '4. The everyday anchor',
  '5. Never again, ask first',
  '6. One card or a family',
  '7. Neighbours',
  'The ladder',
  'Who brought what',
  'To do',
] as const;

/** The facts in the table on top of an interview record. */
export const INTERVIEW_FACTS = ['Card', 'Author', 'Interviewed', 'Fact check', 'Test reader'] as const;

/** What in an interview record does not fit its shape; none when it fits. */
export function interviewMisfits(source: string, number: string): string[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  const title = lines.find((line) => line.startsWith('# '));
  if (!title?.startsWith(`# Interview record · ${number} `)) out.push(`it opens with "# Interview record · ${number} <the title of the plan>"`);
  for (const fact of INTERVIEW_FACTS) if (!lines.some((line) => line.startsWith(`| ${fact} |`))) out.push(`its table names "${fact}"`);
  const sections = lines.filter((line) => line.startsWith('## ')).map((line) => line.slice(3).trim());
  if (sections.join('\n') !== INTERVIEW_SECTIONS.join('\n')) out.push(`its sections are, in this order: ${INTERVIEW_SECTIONS.join('; ')}`);
  return out;
}
