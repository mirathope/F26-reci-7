import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mergeIntervals, type Interval } from '../src/intervals';

// Recitation Part 2 (groups) and problem set Task 2.
// Read the spec in src/intervals/mergeIntervals.ts, then check your progress
// with `npm run mutants:intervals`.
//
// Label every property with its pattern, on the line above its `it(`:
//   // Pattern: invariant. The output is sorted.
// (invariant, algebraic, metamorphic, differential, or conditional)

// A first attempt at a generator. It has a problem: run the tests and read
// the counterexample.
// const interval: fc.Arbitrary<Interval> = fc.tuple(fc.integer(), fc.integer());
// const intervalList = fc.array(interval);

// Checkpoint 1: Construct valid inputs, not by filtering 
const interval: fc.Arbitrary<Interval> = fc
  .tuple(fc.integer({ min: -20, max: 20 }), fc.nat(10))
  .map(([start, len]): Interval => [start, start + len]);
const intervalList = fc.array(interval);

//  helper
const covered = (list: readonly Interval[], p: number) =>
  list.some(([s, e]) => s <= p && p <= e);

//  generator: lists that are already disjoint and non-touching.
// Each interval starts at least 1 after the previous one ends, then the list is shuffled.
const disjointList = fc
  .tuple(
    fc.integer({ min: -20, max: 20 }),
    fc.array(fc.tuple(fc.integer({ min: 1, max: 5 }), fc.nat(5))),
  )
  .map(([first, parts]) => {
    const sorted: Interval[] = [];
    let pos = first;
    for (const [gap, len] of parts) {
      const start = sorted.length === 0 ? pos : pos + gap;
      sorted.push([start, start + len]);
      pos = start + len;
    }
    return sorted;
  })
  .chain(sorted =>
    fc
      .shuffledSubarray(sorted, { minLength: sorted.length, maxLength: sorted.length })
      .map(shuffled => ({ sorted, shuffled })),
  );

describe('mergeIntervals', () => {
  // Pattern: invariant. Every input interval lies inside some output interval.
  it('every input interval lies inside some output interval', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        const uncovered = xs.filter(([s, e]) => !out.some(([a, b]) => a <= s && e <= b));
        expect(uncovered).toEqual([]);
      }),
    );
  });

  // Add your properties here. Aim for at least one of each pattern:
  // invariant, algebraic, metamorphic, differential, conditional.

  // Pattern: invariant. The output is sorted and consecutive intervals neither overlap nor touch.
  it('returns sorted, separated intervals', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        for (let i = 0; i < out.length - 1; i++) {
          expect(out[i][1]).toBeLessThan(out[i + 1][0]);
        }
      }),
    );
  });

  // Pattern: differential. A point (including half-points) is covered by the output exactly when it is covered by the input.
  it('covers exactly the same points as the input', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        for (let p = -22; p <= 32; p += 0.5) {
          expect(covered(out, p)).toBe(covered(xs, p));
        }
      }),
    );
  });

  // Pattern: metamorphic. Reordering the input does not change the output.
  it('gives the same result for any order of the input', () => {
    fc.assert(
      fc.property(
        intervalList.chain(xs =>
          fc
            .shuffledSubarray(xs, { minLength: xs.length, maxLength: xs.length })
            .map(shuffled => [xs, shuffled] as const),
        ),
        ([xs, shuffled]) => {
          expect(mergeIntervals(shuffled)).toEqual(mergeIntervals(xs));
        },
      ),
    );
  });

  // Pattern: algebraic. Merging an already-merged list changes nothing (merge is idempotent).
  it('merging twice is the same as merging once', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const once = mergeIntervals(xs);
        expect(mergeIntervals(once)).toEqual(once);
      }),
    );
  });

  // Pattern: conditional. If the input is already disjoint and non-touching, the output is that input, sorted.
  it('returns already-disjoint input unchanged, just sorted', () => {
    fc.assert(
      fc.property(disjointList, ({ sorted, shuffled }) => {
        expect(mergeIntervals(shuffled)).toEqual(sorted);
      }),
    );
  });

  // Pattern: invariant. The input array and its intervals are not modified.
  it('does not modify its input', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const copy = xs.map(([s, e]): Interval => [s, e]);
        mergeIntervals(xs);
        expect(xs).toEqual(copy);
      }),
    );
  });
});
