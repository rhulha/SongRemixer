# Beat Structure

This project uses the snare markers as the timing truth.

## Core Rule

- Snare positions define each beat interval.
- Bass is placed relative to the distance between two consecutive snares.

Let:

- `S0` = current snare sample
- `S1` = next snare sample
- `G = S1 - S0`

## Groove Pattern

The groove alternates like this:

1. one bass, then snare
2. three bass, then snare
3. one bass, then snare
4. three bass, then snare
5. repeat

Implemented as:

- Before the first snare: one bass at `S0 - 4/8 * G_first`
- In a `three-bass` interval (`S0 -> S1`): bass at
  - `S0 + 3/8 * G`
  - `S0 + 5/8 * G`
  - `S0 + 6/8 * G`
- In a `one-bass` interval (`S0 -> S1`): bass at
  - `S0 + 4/8 * G`

The script alternates interval types across snare pairs:

- interval 0: three bass
- interval 1: one bass
- interval 2: three bass
- interval 3: one bass
- ...

## Hits

- Every snare marker also includes `hit`.
- Additional hit markers between snare pairs are placed at:
  - `1/4` of the snare gap
  - `1/2` of the snare gap
  - `3/4` of the snare gap

## Practical Meaning

This keeps the beat locked to snare timing while preserving the swing/groove feel from the song start, instead of using evenly quarter-spaced bass placements.
