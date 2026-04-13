/**
 * 默认品牌配置
 *
 * 提供开箱即用的完整品牌配置，项目可在此基础上覆盖任意字段
 */

import type { BrandConfig } from '../types/brand';

export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  meta: {
    id: 'default',
    version: '1.0.0',
  },

  color: {
    colors: {
      primary: '#3b82f6',    // Blue-500
      secondary: '#8b5cf6',  // Violet-500
      accent: '#f59e0b',     // Amber-500
      success: '#22c55e',    // Green-500
      warning: '#f97316',    // Orange-500
      danger: '#ef4444',     // Red-500
      info: '#06b6d4',       // Cyan-500
      neutral: '#6b7280',    // Gray-500
    },
    light: {
      background: '#ffffff',
      surface: '#f9fafb',
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      textDisabled: '#d1d5db',
      border: '#e5e7eb',
      divider: '#f3f4f6',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
    dark: {
      background: '#0f172a',
      surface: '#1e293b',
      textPrimary: '#f1f5f9',
      textSecondary: '#94a3b8',
      textDisabled: '#475569',
      border: '#334155',
      divider: '#1e293b',
      overlay: 'rgba(0, 0, 0, 0.7)',
    },
    borderRadius: 8,
    generatePalettes: true,
  },

  logo: {
    full: {
      src: '/logo.svg',
      type: 'url',
      alt: 'Brand Logo',
    },
    icon: {
      src: '/icon.svg',
      type: 'url',
      alt: 'Brand Icon',
    },
  },

  text: {
    brandName: 'Lite999',
    slogan: 'Lightweight Solutions, Infinite Possibilities',
    copyright: '© {year} {brandName}. All rights reserved.',
    appName: 'Lite999 Platform',
    appDescription: 'A modern, configurable web platform.',
    texts: {
      nav: {
        home: 'Home',
        about: 'About',
        contact: 'Contact',
      },
      footer: {
        copyright: '© {year} {brandName}. All rights reserved.',
        terms: 'Terms of Service',
        privacy: 'Privacy Policy',
      },
      auth: {
        login: 'Sign In',
        logout: 'Sign Out',
        register: 'Create Account',
        forgotPassword: 'Forgot Password?',
      },
      common: {
        loading: 'Loading...',
        error: 'Something went wrong',
        retry: 'Try Again',
        confirm: 'Confirm',
        cancel: 'Cancel',
      },
    },
  },

  themeMode: 'light',
};
