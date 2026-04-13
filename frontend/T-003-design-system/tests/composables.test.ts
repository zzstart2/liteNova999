/**
 * Composable Tests
 *
 * Tests for useToast and useModal composables.
 * (useTheme and useReducedMotion require DOM/lifecycle mocking and are tested via theme-manager.)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── useToast ────────────────────────────────────────────────

describe('useToast', () => {
  // Re-import fresh each test to reset shared state
  let useToast: typeof import('../src/composables/use-toast').useToast;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../src/composables/use-toast');
    useToast = mod.useToast;
  });

  it('starts with empty toast list', () => {
    const { toasts } = useToast();
    expect(toasts.value).toHaveLength(0);
  });

  it('adds a toast and returns its id', () => {
    const { toasts, add } = useToast();
    const id = add({ type: 'success', title: 'Done!' });
    expect(id).toBeTruthy();
    expect(toasts.value).toHaveLength(1);
    expect(toasts.value[0].title).toBe('Done!');
    expect(toasts.value[0].type).toBe('success');
  });

  it('removes a toast by id', () => {
    const { toasts, add, remove } = useToast();
    const id = add({ type: 'info', title: 'Test' });
    expect(toasts.value).toHaveLength(1);
    remove(id);
    expect(toasts.value).toHaveLength(0);
  });

  it('clears all toasts', () => {
    const { toasts, add, clear } = useToast();
    add({ type: 'success', title: 'A' });
    add({ type: 'error', title: 'B' });
    add({ type: 'info', title: 'C' });
    expect(toasts.value).toHaveLength(3);
    clear();
    expect(toasts.value).toHaveLength(0);
  });

  it('provides shorthand methods', () => {
    const { toasts, success, error, warning, info } = useToast();
    success('S');
    error('E');
    warning('W');
    info('I');
    expect(toasts.value).toHaveLength(4);
    expect(toasts.value[0].type).toBe('success');
    expect(toasts.value[1].type).toBe('error');
    expect(toasts.value[2].type).toBe('warning');
    expect(toasts.value[3].type).toBe('info');
  });

  it('auto-dismisses non-error toasts', async () => {
    vi.useFakeTimers();
    const { toasts, add } = useToast();
    add({ type: 'success', title: 'Auto', duration: 100 });
    expect(toasts.value).toHaveLength(1);
    vi.advanceTimersByTime(150);
    expect(toasts.value).toHaveLength(0);
    vi.useRealTimers();
  });

  it('does not auto-dismiss error toasts by default', async () => {
    vi.useFakeTimers();
    const { toasts, error } = useToast();
    error('Oops');
    expect(toasts.value).toHaveLength(1);
    vi.advanceTimersByTime(10000);
    expect(toasts.value).toHaveLength(1); // still there
    vi.useRealTimers();
  });

  it('includes optional message', () => {
    const { toasts, success } = useToast();
    success('Title', 'Description');
    expect(toasts.value[0].message).toBe('Description');
  });

  it('shares state across multiple useToast calls', () => {
    const a = useToast();
    const b = useToast();
    a.add({ type: 'info', title: 'Shared' });
    expect(b.toasts.value).toHaveLength(1);
  });
});

// ─── useModal ────────────────────────────────────────────────

describe('useModal', () => {
  let useModal: typeof import('../src/composables/use-modal').useModal;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../src/composables/use-modal');
    useModal = mod.useModal;
  });

  it('starts closed', () => {
    const { isOpen } = useModal();
    expect(isOpen.value).toBe(false);
  });

  it('opens and closes', () => {
    const { isOpen, open, close } = useModal();
    open();
    expect(isOpen.value).toBe(true);
    close();
    expect(isOpen.value).toBe(false);
  });

  it('toggles', () => {
    const { isOpen, toggle } = useModal();
    toggle();
    expect(isOpen.value).toBe(true);
    toggle();
    expect(isOpen.value).toBe(false);
  });

  it('calls onClose callback', () => {
    const onClose = vi.fn();
    const { close, open } = useModal({ onClose });
    open();
    close();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
