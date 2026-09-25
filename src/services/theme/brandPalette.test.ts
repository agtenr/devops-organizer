import { describe, expect, it } from 'vitest';
import { brandRamp } from './brandPalette';

const EXPECTED_SHADE_KEYS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160];

describe('brandRamp', () => {
  it('has all 16 shade keys Fluent theme builders require', () => {
    expect(
      Object.keys(brandRamp)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual(EXPECTED_SHADE_KEYS);
  });

  it('gives every shade a valid hex color', () => {
    for (const key of EXPECTED_SHADE_KEYS) {
      expect(brandRamp[key as keyof typeof brandRamp]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
