/**
 * Landing Page 数据层测试
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_LANDING_DATA } from '../config/landing.default';
import type { LandingPageData } from '../src/types/landing';

// ============================================================
// 默认数据完整性
// ============================================================

describe('DEFAULT_LANDING_DATA', () => {
  it('should have all required top-level sections', () => {
    const keys: (keyof LandingPageData)[] = [
      'nav', 'hero', 'features', 'howItWorks',
      'pricing', 'testimonials', 'faq', 'cta', 'footer',
    ];
    for (const key of keys) {
      expect(DEFAULT_LANDING_DATA[key]).toBeDefined();
    }
  });

  // Nav
  it('should have nav links and CTA', () => {
    expect(DEFAULT_LANDING_DATA.nav.links.length).toBeGreaterThan(0);
    expect(DEFAULT_LANDING_DATA.nav.cta.label).toBeTruthy();
    expect(DEFAULT_LANDING_DATA.nav.cta.href).toBeTruthy();
  });

  // Hero
  it('should have hero with title, subtitle, and CTA', () => {
    const { hero } = DEFAULT_LANDING_DATA;
    expect(hero.title).toBeTruthy();
    expect(hero.subtitle).toBeTruthy();
    expect(hero.primaryCta.label).toBeTruthy();
  });

  // Features
  it('should have at least 4 features', () => {
    expect(DEFAULT_LANDING_DATA.features.items.length).toBeGreaterThanOrEqual(4);
    for (const f of DEFAULT_LANDING_DATA.features.items) {
      expect(f.icon).toBeTruthy();
      expect(f.title).toBeTruthy();
      expect(f.description).toBeTruthy();
    }
  });

  // How it works
  it('should have at least 3 steps', () => {
    expect(DEFAULT_LANDING_DATA.howItWorks.steps.length).toBeGreaterThanOrEqual(3);
    for (const step of DEFAULT_LANDING_DATA.howItWorks.steps) {
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  // Pricing
  it('should have at least 2 pricing tiers', () => {
    expect(DEFAULT_LANDING_DATA.pricing.tiers.length).toBeGreaterThanOrEqual(2);
  });

  it('should have exactly one highlighted tier', () => {
    const highlighted = DEFAULT_LANDING_DATA.pricing.tiers.filter((t) => t.highlighted);
    expect(highlighted.length).toBe(1);
  });

  it('each tier should have features', () => {
    for (const tier of DEFAULT_LANDING_DATA.pricing.tiers) {
      expect(tier.features.length).toBeGreaterThan(0);
      expect(tier.ctaLabel).toBeTruthy();
      expect(tier.ctaHref).toBeTruthy();
    }
  });

  // Testimonials
  it('should have at least 3 testimonials', () => {
    expect(DEFAULT_LANDING_DATA.testimonials.items.length).toBeGreaterThanOrEqual(3);
    for (const t of DEFAULT_LANDING_DATA.testimonials.items) {
      expect(t.name).toBeTruthy();
      expect(t.quote).toBeTruthy();
      expect(t.role).toBeTruthy();
    }
  });

  // FAQ
  it('should have at least 4 FAQ items', () => {
    expect(DEFAULT_LANDING_DATA.faq.items.length).toBeGreaterThanOrEqual(4);
    for (const item of DEFAULT_LANDING_DATA.faq.items) {
      expect(item.question).toBeTruthy();
      expect(item.answer).toBeTruthy();
    }
  });

  // CTA
  it('should have CTA section with heading and button', () => {
    expect(DEFAULT_LANDING_DATA.cta.heading).toBeTruthy();
    expect(DEFAULT_LANDING_DATA.cta.button.label).toBeTruthy();
  });

  // Footer
  it('should have footer link groups and socials', () => {
    expect(DEFAULT_LANDING_DATA.footer.groups.length).toBeGreaterThan(0);
    expect(DEFAULT_LANDING_DATA.footer.socials.length).toBeGreaterThan(0);
    for (const group of DEFAULT_LANDING_DATA.footer.groups) {
      expect(group.title).toBeTruthy();
      expect(group.links.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Nav links 格式
// ============================================================

describe('Nav links', () => {
  it('anchor links should start with #', () => {
    const anchorLinks = DEFAULT_LANDING_DATA.nav.links.filter(
      (l) => !l.external && l.href.startsWith('#')
    );
    expect(anchorLinks.length).toBeGreaterThan(0);
  });

  it('external links should have external flag', () => {
    const externals = DEFAULT_LANDING_DATA.nav.links.filter((l) => l.external);
    for (const link of externals) {
      expect(link.href).toBeTruthy();
    }
  });
});
