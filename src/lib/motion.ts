/**
 * Centralized motion system for the Neon Console.
 *
 * Provides reusable animation variants, class helpers, and utilities
 * to ensure consistent, fast, and smooth animations across the application.
 */

// ── CSS Class Helpers ──

/** Apply a subtle enter animation to new elements */
export const animateEnter = "animate-card-enter";

/** Apply a page-level enter animation */
export const animatePageEnter = "animate-page-enter";

/** Apply a dropdown enter animation */
export const animateDropdownEnter = "animate-dropdown-enter";

/** Apply a modal enter animation */
export const animateModalEnter = "animate-modal-enter";

/** Apply a toast enter animation */
export const animateToastEnter = "animate-toast-enter";

/** Apply a toast exit animation */
export const animateToastExit = "animate-toast-exit";

/** Apply a fade-in animation */
export const animateFadeIn = "animate-fade-in";

/** Apply a slide-in from right animation */
export const animateSlideInRight = "animate-slide-in-right";

/** Apply a slide-in from bottom animation */
export const animateSlideInUp = "animate-slide-in-up";

/** Apply a row highlight animation after update */
export const animateRowHighlight = "animate-row-highlight";

// ── Transition Class Helpers ──

/** Fast transition for hover/focus states (100ms) */
export const transitionFast = "transition-all duration-[var(--motion-fast)] ease-[var(--ease-standard)]";

/** Normal transition for structural changes (180ms) */
export const transitionNormal = "transition-all duration-[var(--motion-normal)] ease-[var(--ease-standard)]";

/** Slow transition for complex animations (250ms) */
export const transitionSlow = "transition-all duration-[var(--motion-slow)] ease-[var(--ease-standard)]";

/** Transition for color changes only */
export const transitionColors = "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)]";

/** Transition for transform/position changes */
export const transitionTransform = "transition-transform duration-[var(--motion-fast)] ease-[var(--ease-standard)]";

/** Transition for opacity changes */
export const transitionOpacity = "transition-opacity duration-[var(--motion-fast)] ease-[var(--ease-standard)]";

// ── Stagger Delay Helpers ──

/** Get stagger delay class for nth child (0-indexed) */
export function staggerDelay(index: number): string {
  return `animation-delay: ${index * 30}ms`;
}

/** Get stagger delay style for nth child (0-indexed) */
export function staggerDelayStyle(index: number): React.CSSProperties {
  return { animationDelay: `${index * 30}ms` };
}

// ── Animation Orchestrator ──

/**
 * Orchestrates a sequence of animations with proper timing.
 * Useful for enter/exit sequences.
 */
export function orchestrateSequence(
  steps: Array<{ element: string; animation: string; delay?: number }>
): void {
  steps.forEach((step) => {
    const el = document.querySelector(step.element);
    if (el) {
      setTimeout(() => {
        el.classList.add(step.animation);
      }, step.delay || 0);
    }
  });
}

// ── Theme Transition Helper ──

/**
 * Apply a temporary theme transition class to enable smooth
 * color transitions when switching themes.
 */
export function withThemeTransition(callback: () => void, durationMs = 200): void {
  if (typeof document === "undefined") {
    callback();
    return;
  }
  const root = document.documentElement;
  root.classList.add("theme-transitioning");
  callback();
  setTimeout(() => {
    root.classList.remove("theme-transitioning");
  }, durationMs);
}

// ── Scroll into View Helper ──

/**
 * Smoothly scroll an element into view with animation.
 */
export function smoothScrollIntoView(
  element: HTMLElement,
  options?: { block?: "start" | "end" | "nearest" | "center"; inline?: "start" | "end" | "nearest" | "center" }
): void {
  element.scrollIntoView({
    behavior: "smooth",
    block: options?.block ?? "nearest",
    inline: options?.inline ?? "nearest",
  });
}

// ── Intersection Observer Animation ──

/**
 * Create an observer that adds an animation class when elements enter the viewport.
 */
export function createScrollRevealObserver(
  animationClass = "animate-card-enter",
  options?: IntersectionObserverInit
): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;

  return new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add(animationClass);
          entry.target.removeAttribute("data-reveal");
        }
      });
    },
    { threshold: 0.1, ...options }
  );
}
