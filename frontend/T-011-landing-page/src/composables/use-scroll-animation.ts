/**
 * useScrollAnimation - 滚动入场动画
 *
 * 基于 IntersectionObserver，元素进入视口时添加动画 class
 * 零依赖，纯 CSS 驱动动画
 */

import { onMounted, onUnmounted, type Ref } from 'vue';

export interface ScrollAnimationOptions {
  /** 触发阈值 (0-1), 元素可见比例达到此值时触发 */
  threshold?: number;
  /** rootMargin，提前触发距离 */
  rootMargin?: string;
  /** 动画 CSS class */
  animateClass?: string;
  /** 是否只触发一次 */
  once?: boolean;
  /** 子元素选择器（批量动画，逐个延迟） */
  childSelector?: string;
  /** 子元素延迟间隔 (ms) */
  staggerDelay?: number;
}

const DEFAULT_OPTIONS: Required<ScrollAnimationOptions> = {
  threshold: 0.15,
  rootMargin: '0px 0px -40px 0px',
  animateClass: 'animate-in',
  once: true,
  childSelector: '',
  staggerDelay: 80,
};

/**
 * 在 ref 元素上启用滚动入场动画
 *
 * @example
 * const sectionRef = ref<HTMLElement>();
 * useScrollAnimation(sectionRef, { childSelector: '.feature-card', staggerDelay: 100 });
 */
export function useScrollAnimation(
  target: Ref<HTMLElement | undefined | null>,
  options?: ScrollAnimationOptions
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let observer: IntersectionObserver | null = null;

  function handleIntersect(entries: IntersectionObserverEntry[]) {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const el = entry.target as HTMLElement;

        if (opts.childSelector) {
          // 逐个子元素动画（stagger）
          const children = el.querySelectorAll(opts.childSelector);
          children.forEach((child, idx) => {
            (child as HTMLElement).style.transitionDelay = `${idx * opts.staggerDelay}ms`;
            child.classList.add(opts.animateClass);
          });
        } else {
          el.classList.add(opts.animateClass);
        }

        if (opts.once && observer) {
          observer.unobserve(el);
        }
      } else if (!opts.once) {
        const el = entry.target as HTMLElement;
        if (opts.childSelector) {
          const children = el.querySelectorAll(opts.childSelector);
          children.forEach((child) => child.classList.remove(opts.animateClass));
        } else {
          el.classList.remove(opts.animateClass);
        }
      }
    }
  }

  onMounted(() => {
    if (!target.value) return;

    observer = new IntersectionObserver(handleIntersect, {
      threshold: opts.threshold,
      rootMargin: opts.rootMargin,
    });

    observer.observe(target.value);
  });

  onUnmounted(() => {
    observer?.disconnect();
    observer = null;
  });
}

/**
 * 全局滚动动画 CSS
 *
 * 在 App.vue 或全局样式中引入：
 *
 * ```css
 * [data-animate] {
 *   opacity: 0;
 *   transform: translateY(24px);
 *   transition: opacity 0.5s ease, transform 0.5s ease;
 * }
 * [data-animate].animate-in {
 *   opacity: 1;
 *   transform: translateY(0);
 * }
 * ```
 */
export const SCROLL_ANIMATION_CSS = `
[data-animate] {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
[data-animate].animate-in {
  opacity: 1;
  transform: translateY(0);
}
/* 预设效果 */
[data-animate="fade"] {
  transform: none;
}
[data-animate="slide-left"] {
  transform: translateX(-24px);
}
[data-animate="slide-left"].animate-in {
  transform: translateX(0);
}
[data-animate="slide-right"] {
  transform: translateX(24px);
}
[data-animate="slide-right"].animate-in {
  transform: translateX(0);
}
[data-animate="scale"] {
  transform: scale(0.95);
}
[data-animate="scale"].animate-in {
  transform: scale(1);
}
`;
