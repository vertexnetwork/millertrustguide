// Shared client-side logic for every email-capture surface: the bottom-of-page
// form, the mid-page inline form, the engagement slide-in, and the desktop
// exit-intent modal. Centralizing it here guarantees three invariants across
// all four surfaces (the "zero nagging" contract):
//
//   1. Once a visitor subscribes anywhere, no surface ever prompts them again
//      (hasSubscribed). Set in localStorage, so it holds across visits.
//   2. At most ONE *interruptive* prompt (slide-in OR exit-intent) is ever
//      shown to a visitor — whichever fires first claims the single budget
//      (interruptivePromptShown). Passive inline forms don't count.
//   3. When any form succeeds, a `mtg:subscribed` event closes any open
//      interruptive prompt immediately.
//
// Every localStorage access is guarded — Safari private mode / storage-disabled
// browsers must degrade to "prompt shows normally", never throw.

import { trackEvent } from '~/lib/analytics-client';

const SUBSCRIBED_KEY = 'mtg_lead_subscribed';
const PROMPT_SHOWN_KEY = 'mtg_lead_prompt_shown';

/** Dispatched on `document` when any capture form succeeds. */
export const SUBSCRIBED_EVENT = 'mtg:subscribed';

/** Dispatched on `document` the instant an interruptive prompt is shown, so the
 *  other interruptive surface tears itself down (belt-and-suspenders with the
 *  localStorage budget: guarantees the two can't both fire in one session). */
export const PROMPT_SHOWN_EVENT = 'mtg:prompt-shown';

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage disabled — degrade gracefully */
  }
}

/** True once the visitor has subscribed on any surface, ever. */
export function hasSubscribed(): boolean {
  return safeGet(SUBSCRIBED_KEY) === '1';
}

function markSubscribed(): void {
  safeSet(SUBSCRIBED_KEY, '1');
}

/**
 * True once an interruptive prompt (slide-in or exit-intent) has been shown.
 * Both prompts consult this before showing so a visitor sees at most one, ever.
 */
export function interruptivePromptShown(): boolean {
  return safeGet(PROMPT_SHOWN_KEY) === '1';
}

/** Claim the single interruptive-prompt budget. Call the moment a prompt is
 *  shown — NOT on dismiss — so ignoring it still burns the budget (no re-nag). */
export function markInterruptivePromptShown(): void {
  safeSet(PROMPT_SHOWN_KEY, '1');
  try {
    document.dispatchEvent(new CustomEvent(PROMPT_SHOWN_EVENT));
  } catch {
    /* no-op */
  }
}

/** A prompt should show only if the visitor hasn't subscribed AND no
 *  interruptive prompt has fired yet. */
export function canShowInterruptivePrompt(): boolean {
  return !hasSubscribed() && !interruptivePromptShown();
}

interface WireOpts {
  /** Analytics label for which surface converted: 'main' | 'inline' | 'slidein' | 'exit'. */
  source: string;
  /** Optional callback after a successful subscribe (e.g. auto-dismiss a modal). */
  onSuccess?: () => void;
}

/**
 * Wire a single capture form: validation, POST to /api/subscribe, inline
 * feedback, success state (with an instant link to the checklist when the
 * state is known), the subscribed flag, the cross-surface close event, and
 * source-tagged analytics.
 *
 * The form must contain: input[name="email"], button[type="submit"], and an
 * element with [data-feedback]. `data-state-slug` on the form selects the
 * welcome-email copy and the checklist deep-link.
 */
export function wireLeadForm(form: HTMLFormElement, opts: WireOpts): void {
  const emailInput = form.querySelector<HTMLInputElement>('input[name="email"]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const feedback = form.querySelector<HTMLElement>('[data-feedback]');
  if (!emailInput || !button || !feedback) return;

  const stateSlug = form.dataset.stateSlug ?? '';
  const buttonDefault = button.textContent;

  const setFeedback = (html: string, ok: boolean) => {
    feedback.innerHTML = html;
    feedback.classList.remove('hidden');
    feedback.classList.toggle('text-error', !ok);
    feedback.classList.toggle('text-success', ok);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email || !emailInput.checkValidity()) {
      setFeedback('Please enter a valid email address.', false);
      emailInput.focus();
      return;
    }

    button.disabled = true;
    button.textContent = 'Sending…';
    feedback.classList.add('hidden');

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, stateSlug }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; note?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      form.reset();
      markSubscribed();
      trackEvent('lead_submit', {
        source: opts.source,
        ...(stateSlug ? { state: stateSlug } : {}),
      });

      // Instant gratification: when we know the state, link straight to the
      // checklist so the promised artifact is one tap away — the email is the
      // backup copy, not the only path to it. stateSlug is a known content
      // slug (server-set), so this interpolation is safe.
      const link = stateSlug
        ? ` <a class="underline font-semibold" href="/checklist/${encodeURIComponent(stateSlug)}">Open your checklist →</a>`
        : '';
      setFeedback(
        (data.note || "You're on the list — your first email is on its way.") + link,
        true
      );
      button.textContent = 'Sent ✓';

      document.dispatchEvent(new CustomEvent(SUBSCRIBED_EVENT));
      opts.onSuccess?.();
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        false
      );
      button.disabled = false;
      button.textContent = buttonDefault;
    }
  });
}
