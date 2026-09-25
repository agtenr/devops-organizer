import type { BrandVariants } from '@fluentui/react-components';

/**
 * The app's color scheme (story 124), sourced from the palette image attached to the story:
 * a primary blue, and three accent colors sampled as exact pixel hex values from that image.
 *
 * `brandRamp` is the 16-shade ramp Fluent's `createLightTheme`/`createDarkTheme` need to build a
 * custom-colored theme. Fluent's own ramp-generator tool isn't runnable outside its web app, so
 * this ramp is an approximation: same hue as the blue swatch, stepped lightness. Good enough for
 * "visually attractive and consistent" — the story does not require an exact match to Microsoft's
 * generator output.
 */
export const brandRamp: BrandVariants = {
  10: '#040C11',
  20: '#071821',
  30: '#0B2432',
  40: '#0F3043',
  50: '#123B54',
  60: '#164764',
  70: '#1A5375',
  80: '#2C8EC7',
  90: '#2983B8',
  100: '#3699D3',
  110: '#58AADA',
  120: '#79BBE1',
  130: '#9BCCE9',
  140: '#BCDDF0',
  150: '#DEEEF8',
  160: '#F2F9FC',
};

/** The top bar's background, sampled from the palette image's dark-navy swatch. */
export const topBarBackground = '#083C5D';

/** The item-counter badge background, sampled from the palette image's orange swatch. */
export const accentBadgeBackground = '#D98310';

/** The item-counter badge text color, sampled from the palette image's near-black swatch. */
export const accentBadgeForeground = '#1D2731';
