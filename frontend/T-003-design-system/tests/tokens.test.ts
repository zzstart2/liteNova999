/**
 * Token Validation Tests
 *
 * Ensures all design tokens are present and have correct values.
 * Cross-references with the design spec to catch drift.
 */

import { describe, it, expect } from 'vitest';
import {
  colors,
  typography,
  spacing,
  radius,
  shadow,
  transition,
  zIndex,
  breakpoint,
  layout,
  iconSize,
  designTokens,
} from '../src/tokens/tokens';

describe('Color Tokens', () => {
  describe('Primary scale', () => {
    const expectedPrimary: Record<string, string> = {
      50: '#EEF2FF',
      100: '#DDE5FF',
      200: '#B3C5FF',
      300: '#809CFF',
      400: '#5673FF',
      500: '#3354FF',
      600: '#2440DB',
      700: '#1A30B7',
      800: '#122393',
      900: '#0C1870',
    };

    it.each(Object.entries(expectedPrimary))('primary.%s = %s', (key, expected) => {
      expect(colors.primary[key as unknown as keyof typeof colors.primary]).toBe(expected);
    });

    it('has all 10 primary shades', () => {
      expect(Object.keys(colors.primary)).toHaveLength(10);
    });
  });

  describe('Secondary colors', () => {
    it('has cyan', () => {
      expect(colors.secondary.cyan).toBe('#00D4AA');
    });

    it('has amber', () => {
      expect(colors.secondary.amber).toBe('#FFB020');
    });
  });

  describe('Semantic colors', () => {
    it('success = #10B981', () => expect(colors.semantic.success).toBe('#10B981'));
    it('warning = #F59E0B', () => expect(colors.semantic.warning).toBe('#F59E0B'));
    it('error = #EF4444', () => expect(colors.semantic.error).toBe('#EF4444'));
    it('info = #3B82F6', () => expect(colors.semantic.info).toBe('#3B82F6'));
    it('has light variants', () => {
      expect(colors.semantic.successLight).toBe('#ECFDF5');
      expect(colors.semantic.warningLight).toBe('#FFFBEB');
      expect(colors.semantic.errorLight).toBe('#FEF2F2');
      expect(colors.semantic.infoLight).toBe('#EFF6FF');
    });
  });

  describe('Neutral scale', () => {
    it('has 11 neutral shades (0-900)', () => {
      expect(Object.keys(colors.neutral)).toHaveLength(11);
    });

    it('neutral.0 is white', () => {
      expect(colors.neutral[0]).toBe('#FFFFFF');
    });

    it('neutral.900 is near-black', () => {
      expect(colors.neutral[900]).toBe('#111827');
    });
  });
});

describe('Typography Tokens', () => {
  it('has sans and mono font families', () => {
    expect(typography.fontFamily.sans).toContain('Inter');
    expect(typography.fontFamily.mono).toContain('JetBrains Mono');
  });

  it('has 9 font sizes (xs through 5xl)', () => {
    expect(Object.keys(typography.fontSize)).toHaveLength(9);
    expect(typography.fontSize.base).toBe('1rem');
    expect(typography.fontSize.xs).toBe('0.75rem');
    expect(typography.fontSize['5xl']).toBe('3rem');
  });

  it('has 5 font weights', () => {
    expect(typography.fontWeight.light).toBe(300);
    expect(typography.fontWeight.regular).toBe(400);
    expect(typography.fontWeight.medium).toBe(500);
    expect(typography.fontWeight.semibold).toBe(600);
    expect(typography.fontWeight.bold).toBe(700);
  });

  it('has 4 line heights', () => {
    expect(Object.keys(typography.lineHeight)).toHaveLength(4);
    expect(typography.lineHeight.normal).toBe(1.5);
  });
});

describe('Spacing Tokens', () => {
  it('has 12 spacing values', () => {
    expect(Object.keys(spacing)).toHaveLength(12);
  });

  it('base unit is 4px (space-1 = 0.25rem)', () => {
    expect(spacing['1']).toBe('0.25rem');
  });

  it('space-4 = 1rem (16px)', () => {
    expect(spacing['4']).toBe('1rem');
  });

  it('largest spacing is space-20 = 5rem (80px)', () => {
    expect(spacing['20']).toBe('5rem');
  });
});

describe('Radius Tokens', () => {
  it('has 7 radius values', () => {
    expect(Object.keys(radius)).toHaveLength(7);
  });

  it('radius.none = 0', () => expect(radius.none).toBe('0'));
  it('radius.md = 8px', () => expect(radius.md).toBe('8px'));
  it('radius.full = 9999px', () => expect(radius.full).toBe('9999px'));
});

describe('Shadow Tokens', () => {
  it('has 5 shadow values', () => {
    expect(Object.keys(shadow)).toHaveLength(5);
  });

  it('shadow.md matches spec', () => {
    expect(shadow.md).toContain('4px 6px');
  });

  it('shadow.inner is inset', () => {
    expect(shadow.inner).toContain('inset');
  });
});

describe('Transition Tokens', () => {
  it('has 4 durations', () => {
    expect(Object.keys(transition.duration)).toHaveLength(4);
    expect(transition.duration.fast).toBe('100ms');
    expect(transition.duration.normal).toBe('200ms');
    expect(transition.duration.slow).toBe('300ms');
    expect(transition.duration.slower).toBe('500ms');
  });

  it('has 4 easings', () => {
    expect(Object.keys(transition.easing)).toHaveLength(4);
    expect(transition.easing.out).toContain('cubic-bezier');
    expect(transition.easing.spring).toContain('1.56');
  });
});

describe('Z-Index Tokens', () => {
  it('has 8 z-index values', () => {
    expect(Object.keys(zIndex)).toHaveLength(8);
  });

  it('follows ascending order', () => {
    expect(zIndex.dropdown).toBeLessThan(zIndex.sticky);
    expect(zIndex.sticky).toBeLessThan(zIndex.modal);
    expect(zIndex.modal).toBeLessThan(zIndex.toast);
  });

  it('toast is highest at 1080', () => {
    expect(zIndex.toast).toBe(1080);
  });
});

describe('Breakpoint Tokens', () => {
  it('has 4 breakpoints', () => {
    expect(Object.keys(breakpoint)).toHaveLength(4);
  });

  it('matches spec values', () => {
    expect(breakpoint.mobile).toBe('640px');
    expect(breakpoint.tablet).toBe('768px');
    expect(breakpoint.desktop).toBe('1024px');
    expect(breakpoint.wide).toBe('1280px');
  });
});

describe('Layout Tokens', () => {
  it('max content width = 1200px', () => {
    expect(layout.maxContentWidth).toBe('1200px');
  });
});

describe('Icon Size Tokens', () => {
  it('has 5 icon sizes', () => {
    expect(Object.keys(iconSize)).toHaveLength(5);
  });

  it('md is 24px with 2px stroke', () => {
    expect(iconSize.md.size).toBe('24px');
    expect(iconSize.md.strokeWidth).toBe('2px');
  });

  it('xs is 16px with 1.5px stroke', () => {
    expect(iconSize.xs.size).toBe('16px');
    expect(iconSize.xs.strokeWidth).toBe('1.5px');
  });
});

describe('Complete Token Set', () => {
  it('has all top-level categories', () => {
    const keys = Object.keys(designTokens);
    expect(keys).toContain('color');
    expect(keys).toContain('typography');
    expect(keys).toContain('spacing');
    expect(keys).toContain('radius');
    expect(keys).toContain('shadow');
    expect(keys).toContain('transition');
    expect(keys).toContain('zIndex');
    expect(keys).toContain('breakpoint');
    expect(keys).toContain('layout');
    expect(keys).toContain('iconSize');
  });
});
