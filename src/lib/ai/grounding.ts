// Numbers a model writes must come from the data it was given.
//
// Load steps, deloads and every other figure that matters are decided by
// the deterministic engine (ROADMAP, principle 4); the model only puts them
// into words. A sentence with a number that is not in its input is either
// invented or a prescription the model was not allowed to make, so the
// answer is rejected and the router tries the next provider or the rules.

const NUMBER = /\d+(?:[.,]\d+)*/g;

/** Every value a written number can stand for (Spanish and English separators). */
function readings(token: string): number[] {
  const out = new Set<number>();
  // "2,5" / "2.5" as a decimal.
  const decimal = Number(token.replace(',', '.'));
  if (Number.isFinite(decimal)) out.add(round(decimal));
  // "1.200" / "1,200" as thousands.
  const grouped = Number(token.replace(/[.,]/g, ''));
  if (/^\d{1,3}([.,]\d{3})+$/.test(token) && Number.isFinite(grouped)) out.add(grouped);
  return [...out];
}

const round = (x: number) => Math.round(x * 100) / 100;

function numbersIn(text: string): Set<number> {
  const out = new Set<number>();
  for (const token of text.match(NUMBER) ?? []) for (const v of readings(token)) out.add(v);
  return out;
}

/** The numbers in `output` that none of `sources` contains, as written. */
export function ungroundedNumbers(output: string, sources: string[]): string[] {
  const known = numbersIn(sources.join('\n'));
  return (output.match(NUMBER) ?? []).filter((token) => !readings(token).some((v) => known.has(v)));
}

/** Throws (so the router moves on) when the text cites a number it was not given. */
export function assertGrounded(output: string, sources: string[]): string {
  const invented = ungroundedNumbers(output, sources);
  if (invented.length) throw new Error(`cifras que no están en los datos: ${invented.join(', ')}`);
  return output;
}
