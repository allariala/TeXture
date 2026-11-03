import { latexToHwp } from './hwp.js';

// Keep conversion/consent ahead of the only clipboard write. Failure and cancel
// leave both the editor and the previous clipboard contents untouched.
export async function copyHwp(input, { writeText, confirmApproximation }) {
  const result = latexToHwp(input);
  if (result.errors.length) return { ...result, copied: false };
  if (result.warnings.length && !confirmApproximation(result.warnings)) return { ...result, copied: false };
  await writeText(result.script);
  return { ...result, copied: true };
}
