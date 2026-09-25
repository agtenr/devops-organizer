import type { BrandVariants } from '@fluentui/react-components';

/**
 * The app's color scheme (story 124), sourced from the palette image attached to the story:
 * a primary blue, and three accent colors sampled as exact pixel hex values from that image.
 *
 * `brandRamp` is the 16-shade ramp Fluent's `createLightTheme`/`createDarkTheme` need to build a
 * custom-colored theme. Fluent's own ramp-generator tool isn't runnable outside its web app, so
 * this ramp is an approximation: same hue as the blue swatch, lightness stepped from dark (10) to
 * light (160), each shade checked for at least 4.5:1 (WCAG AA) contrast against white where
 * Fluent pairs a shade with white text (e.g. shade 80, the default button background).
 */
export const brandRamp: BrandVariants = {
  10: '#040C11',
  20: '#071821',
  30: '#0B2432',
  40: '#0F3043',
  50: '#123B54',
  60: '#164764',
  70: '#1A5375',
  80: '#1E5F86',
  90: '#23719F',
  100: '#2983B8',
  110: '#2E95D1',
  120: '#50A6D8',
  130: '#71B7E0',
  140: '#9BCCE9',
  150: '#C5E1F2',
  160: '#EAF4FA',
};

/** The top bar's background, sampled from the palette image's dark-navy swatch. */
export const topBarBackground = '#083C5D';

/** The item-counter badge background, sampled from the palette image's orange swatch. */
export const accentBadgeBackground = '#D98310';

/** The item-counter badge text color, sampled from the palette image's near-black swatch. */
export const accentBadgeForeground = '#1D2731';
