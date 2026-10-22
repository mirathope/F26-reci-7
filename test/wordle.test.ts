import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { matchGuess } from '../src/wordle';

// Recitation Part 1: follow along with your TA, filling in the todos below.
// Problem set Task 1: keep adding properties until `npm run mutants:wordle`
// kills every mutant. Read the spec in src/wordle/matchGuess.ts.
//
// Label every property with its pattern, on the line above its `it(`:
//   // Pattern: invariant. The result always has exactly five colors.
// (invariant, algebraic, metamorphic, differential, or conditional)

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Step 1: a generator for five-letter uppercase words.
const wordFrom = (letters: string) =>
  fc.array(fc.constantFrom(...letters), { minLength: 5, maxLength: 5 }).map(cs => cs.join(''));
const word = wordFrom(ALPHABET);

// Small alphabet: repeated letters show up constantly, which exposes
// duplicate-letter bugs. (But it almost never produces a guess letter that is
// missing from the secret, so the full alphabet is still used elsewhere.)
const smallWord = wordFrom('AB');

// Targeted generator: a secret with five distinct letters, and a guess that is
// the same letters rotated by 1-4 positions. Every guess letter is in the
// secret but never in the same position, so every color must be yellow.
const rotatedPair = fc
  .tuple(
    fc.shuffledSubarray([...ALPHABET], { minLength: 5, maxLength: 5 }),
    fc.integer({ min: 1, max: 4 }),
  )
  .map(([letters, k]) => {
    const secret = letters.join('');
    const guess = [...letters.slice(k), ...letters.slice(0, k)].join('');
    return { secret, guess };
  });

// Generator for a consistent renaming of letters: a shuffled alphabet.
const renaming = fc
  .shuffledSubarray([...ALPHABET], { minLength: 26, maxLength: 26 })
  .map(shuffled => (w: string) => [...w].map(c => shuffled[ALPHABET.indexOf(c)]).join(''));

describe('matchGuess', () => {
  // Pattern: invariant. The result always has exactly five colors.
  it('returns exactly five colors', () => {
    fc.assert(
      fc.property(word, word, (secret, guess) => {
        expect(matchGuess(secret, guess)).toHaveLength(5);
      }),
    );
  });

  // Pattern: invariant. Every color is G, Y, or B.
  it('only uses the colors G, Y, B', () => {
    fc.assert(
      fc.property(word, word, (secret, guess) => {
        for (const c of matchGuess(secret, guess)) expect(['G', 'Y', 'B']).toContain(c);
      }),
    );
  });

  // Pattern: conditional. If the guess is the secret, every color is green.
  it('guessing the secret gives all greens', () => {
    fc.assert(
      fc.property(word, w => {
        expect(matchGuess(w, w)).toEqual(['G', 'G', 'G', 'G', 'G']);
      }),
    );
  });

  // Pattern: invariant. No letter gets more G/Y credits than the secret contains it.
  it('never credits a letter more times than the secret contains it', () => {
    fc.assert(
      fc.property(smallWord, smallWord, (secret, guess) => {
        const result = matchGuess(secret, guess);
        for (const letter of new Set(guess)) {
          const credited = [...guess].filter((c, i) => c === letter && result[i] !== 'B').length;
          const inSecret = [...secret].filter(c => c === letter).length;
          expect(credited).toBeLessThanOrEqual(inSecret);
        }
      }),
    );
  });

  // Pattern: invariant. A position is green exactly when the guess and secret letters match there.
  it('is green exactly where the letters match', () => {
    fc.assert(
      fc.property(fc.oneof(word, smallWord), fc.oneof(word, smallWord), (secret, guess) => {
        const result = matchGuess(secret, guess);
        for (let i = 0; i < 5; i++) {
          expect(result[i] === 'G').toBe(guess[i] === secret[i]);
        }
      }),
    );
  });

  // Pattern: invariant. A guess letter that does not appear in the secret at all is black.
  it('colors letters missing from the secret black', () => {
    fc.assert(
      fc.property(word, word, (secret, guess) => {
        const result = matchGuess(secret, guess);
        for (let i = 0; i < 5; i++) {
          if (!secret.includes(guess[i])) expect(result[i]).toBe('B');
        }
      }),
    );
  });

  // Pattern: conditional. If the guess is a rotation of a secret with five distinct letters, every color is yellow.
  it('a rotated secret with distinct letters gives all yellows', () => {
    fc.assert(
      fc.property(rotatedPair, ({ secret, guess }) => {
        expect(matchGuess(secret, guess)).toEqual(['Y', 'Y', 'Y', 'Y', 'Y']);
      }),
    );
  });

  // Pattern: metamorphic. Renaming letters consistently in both words does not change the colors.
  it('gives the same colors after a consistent renaming of letters', () => {
    fc.assert(
      fc.property(fc.oneof(word, smallWord), fc.oneof(word, smallWord), renaming, (secret, guess, rename) => {
        expect(matchGuess(rename(secret), rename(guess))).toEqual(matchGuess(secret, guess));
      }),
    );
  });
});