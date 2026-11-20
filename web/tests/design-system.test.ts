import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const webTokens = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const androidTokens = readFileSync(
  new URL('../../android/app/src/main/java/com/kaveh/avenger/ui/theme/KavehTokens.kt', import.meta.url),
  'utf8',
);
const androidTheme = readFileSync(
  new URL('../../android/app/src/main/java/com/kaveh/avenger/ui/theme/Theme.kt', import.meta.url),
  'utf8',
);

describe('Kaveh cross-platform design token contract', () => {
  it('defines the shared spacing scale on web and Android', () => {
    for (const [token, value] of [['1', '4'], ['2', '8'], ['3', '12'], ['4', '16'], ['5', '20'], ['6', '24'], ['8', '32'], ['10', '40']]) {
      expect(webTokens).toContain(`--space-${token}:${value}px`);
      expect(androidTokens).toContain(`x${token}: Dp = ${value}.dp`);
    }
  });

  it('defines responsive surface radii and applies native Material 3 shapes', () => {
    expect(webTokens).toContain('--radius-sm:8px');
    expect(webTokens).toContain('--radius-2xl:26px');
    expect(androidTokens).toContain('val small: Dp = 8.dp');
    expect(androidTokens).toContain('val extraLarge: Dp = 26.dp');
    expect(androidTheme).toContain('shapes = Shapes(');
    expect(androidTheme).toContain('RoundedCornerShape(KavehRadius.large)');
  });

  it('keeps reduced-motion and forced-colors support in the web shell', () => {
    expect(webTokens).toContain('@media (prefers-reduced-motion:reduce)');
    expect(webTokens).toContain('@media (forced-colors:active)');
  });
});
