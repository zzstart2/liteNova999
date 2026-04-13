/**
 * 文案解析器测试
 */

import { describe, it, expect } from 'vitest';
import { createTextResolver, getByPath, interpolate } from '../src/brand/text-resolver';
import type { BrandTextConfig } from '../src/types/brand';

// ============================================================
// getByPath
// ============================================================

describe('getByPath', () => {
  const obj = {
    nav: {
      home: 'Home',
      sub: {
        deep: 'Deep Value',
      },
    },
    flat: 'Flat Value',
  };

  it('should access top-level key', () => {
    expect(getByPath(obj, 'flat')).toBe('Flat Value');
  });

  it('should access nested key', () => {
    expect(getByPath(obj, 'nav.home')).toBe('Home');
  });

  it('should access deeply nested key', () => {
    expect(getByPath(obj, 'nav.sub.deep')).toBe('Deep Value');
  });

  it('should return undefined for missing key', () => {
    expect(getByPath(obj, 'missing')).toBeUndefined();
    expect(getByPath(obj, 'nav.missing')).toBeUndefined();
    expect(getByPath(obj, 'nav.sub.missing')).toBeUndefined();
  });

  it('should return undefined for object values (not strings)', () => {
    expect(getByPath(obj, 'nav')).toBeUndefined();
    expect(getByPath(obj, 'nav.sub')).toBeUndefined();
  });

  it('should return undefined for undefined input', () => {
    expect(getByPath(undefined, 'any')).toBeUndefined();
  });
});

// ============================================================
// interpolate
// ============================================================

describe('interpolate', () => {
  it('should replace variables', () => {
    expect(interpolate('Hello, {name}!', { name: 'Alice' })).toBe('Hello, Alice!');
  });

  it('should replace multiple variables', () => {
    expect(interpolate('© {year} {brandName}', { year: '2024', brandName: 'Acme' })).toBe(
      '© 2024 Acme'
    );
  });

  it('should leave unknown variables as-is', () => {
    expect(interpolate('{known} and {unknown}', { known: 'yes' })).toBe('yes and {unknown}');
  });

  it('should handle empty template', () => {
    expect(interpolate('', { foo: 'bar' })).toBe('');
  });

  it('should handle no variables', () => {
    expect(interpolate('plain text', {})).toBe('plain text');
  });
});

// ============================================================
// createTextResolver
// ============================================================

describe('createTextResolver', () => {
  const config: BrandTextConfig = {
    brandName: 'TestBrand',
    slogan: 'Test all the things',
    copyright: '© {year} {brandName}',
    appName: 'TestApp',
    appDescription: 'A test application',
    texts: {
      nav: {
        home: 'Home',
        about: 'About Us',
      },
      footer: {
        copyright: '© {year} {brandName}. All rights reserved.',
      },
      greeting: 'Hello, {name}!',
    },
  };

  it('should resolve top-level shortcut keys', () => {
    const resolver = createTextResolver(config);
    expect(resolver.t('brandName')).toBe('TestBrand');
    expect(resolver.t('slogan')).toBe('Test all the things');
    expect(resolver.t('appName')).toBe('TestApp');
    expect(resolver.t('appDescription')).toBe('A test application');
  });

  it('should resolve copyright with interpolation', () => {
    const resolver = createTextResolver(config);
    const result = resolver.t('copyright');
    const year = new Date().getFullYear().toString();
    expect(result).toBe(`© ${year} TestBrand`);
  });

  it('should resolve nested text keys', () => {
    const resolver = createTextResolver(config);
    expect(resolver.t('nav.home')).toBe('Home');
    expect(resolver.t('nav.about')).toBe('About Us');
  });

  it('should resolve nested with interpolation', () => {
    const resolver = createTextResolver(config);
    const year = new Date().getFullYear().toString();
    expect(resolver.t('footer.copyright')).toBe(`© ${year} TestBrand. All rights reserved.`);
  });

  it('should support extra variables', () => {
    const resolver = createTextResolver(config);
    expect(resolver.t('greeting', { name: 'Alice' })).toBe('Hello, Alice!');
  });

  // Fallback behavior
  it('should return key as fallback by default', () => {
    const resolver = createTextResolver(config);
    expect(resolver.t('missing.key')).toBe('missing.key');
  });

  it('should return empty for fallback=empty', () => {
    const resolver = createTextResolver(config, { fallback: 'empty' });
    expect(resolver.t('missing.key')).toBe('');
  });

  it('should throw for fallback=throw', () => {
    const resolver = createTextResolver(config, { fallback: 'throw' });
    expect(() => resolver.t('missing.key')).toThrow('[BrandText] Key not found');
  });

  // has()
  it('should check existence with has()', () => {
    const resolver = createTextResolver(config);
    expect(resolver.has('brandName')).toBe(true);
    expect(resolver.has('slogan')).toBe(true);
    expect(resolver.has('nav.home')).toBe(true);
    expect(resolver.has('missing')).toBe(false);
  });

  // keys()
  it('should list all custom text keys', () => {
    const resolver = createTextResolver(config);
    const allKeys = resolver.keys();
    expect(allKeys).toContain('nav.home');
    expect(allKeys).toContain('nav.about');
    expect(allKeys).toContain('footer.copyright');
    expect(allKeys).toContain('greeting');
  });

  // Custom variables
  it('should support custom variables option', () => {
    const resolver = createTextResolver(config, {
      variables: { name: 'DefaultUser' },
    });
    expect(resolver.t('greeting')).toBe('Hello, DefaultUser!');
    // Extra vars override
    expect(resolver.t('greeting', { name: 'Override' })).toBe('Hello, Override!');
  });
});
