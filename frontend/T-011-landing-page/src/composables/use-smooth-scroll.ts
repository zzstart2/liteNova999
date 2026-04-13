/**
 * useSmoothScroll - 平滑滚动到锚点
 *
 * 处理导航栏内部锚点链接的平滑滚动，考虑固定导航栏高度偏移
 */

import { onMounted, onUnmounted } from 'vue';

export interface SmoothScrollOptions {
  /** 固定头部偏移量 (px) */
  offset?: number;
  /** 滚动行为 */
  behavior?: ScrollBehavior;
}

/**
 * 滚动到指定锚点
 */
export function scrollToAnchor(
  hash: string,
  options: SmoothScrollOptions = {}
): void {
  const { offset = 80, behavior = 'smooth' } = options;

  const id = hash.startsWith('#') ? hash.slice(1) : hash;
  const el = document.getElementById(id);

  if (el) {
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior });
  }
}

/**
 * 自动拦截锚点链接点击并平滑滚动
 */
export function useSmoothScroll(options: SmoothScrollOptions = {}) {
  function handleClick(e: MouseEvent) {
    const target = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
    if (!target) return;

    const hash = target.getAttribute('href');
    if (!hash || hash === '#') return;

    e.preventDefault();
    scrollToAnchor(hash, options);

    // 更新 URL hash（不触发滚动）
    history.pushState(null, '', hash);
  }

  onMounted(() => {
    document.addEventListener('click', handleClick);

    // 页面加载时如果有 hash，也平滑滚动过去
    if (window.location.hash) {
      // 小延迟确保 DOM 已渲染
      requestAnimationFrame(() => {
        scrollToAnchor(window.location.hash, options);
      });
    }
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClick);
  });
}
