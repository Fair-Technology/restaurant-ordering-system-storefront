import type { Page } from '@playwright/test';

/** What the page recorded about its dealings with the fake Stripe. */
export interface FakeStripeCalls {
  init: { key: string; options: { stripeAccount?: string } } | null;
  confirmParams: { return_url?: string } | null;
  createOptions: { defaultValues?: { billingDetails?: { address?: { country?: string } } } } | null;
}

// Runs inside the page. Stands in for Stripe.js so no test ever reaches the real Stripe.
function installFakeStripe(): void {
  type Handler = () => void;
  const w = window as unknown as Record<string, unknown>;
  const element = {
    handlers: {} as Record<string, Handler[]>,
    mount(node: HTMLElement) {
      node.innerHTML = '<div data-testid="fake-card">Card details</div>';
      setTimeout(() => (element.handlers.ready ?? []).forEach((h) => h()), 30);
    },
    on(event: string, handler: Handler) {
      (element.handlers[event] ??= []).push(handler);
    },
    off() {},
    update() {},
    destroy() {},
    unmount() {},
  };
  const stripe = {
    elements: () => ({
      create: (_type: string, options: unknown) => {
        w.__createOptions = options;
        return element;
      },
      getElement: () => element,
      update() {},
    }),
    createToken: async () => ({}),
    createPaymentMethod: async () => ({}),
    confirmCardPayment: async () => ({}),
    confirmPayment: async (args: { confirmParams: unknown }) => {
      w.__confirmParams = args.confirmParams;
      return { paymentIntent: { id: 'pi_test', status: 'requires_capture' } };
    },
    _registerWrapper() {},
    registerAppInfo() {},
  };
  w.Stripe = (key: string, options: unknown) => {
    w.__stripeInit = { key, options };
    return stripe;
  };
}

/** Serves a fake Stripe.js for every request to js.stripe.com. */
export async function fakeStripe(page: Page): Promise<void> {
  await page.route('https://js.stripe.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `(${installFakeStripe.toString()})();`,
    }),
  );
}

export async function fakeStripeCalls(page: Page): Promise<FakeStripeCalls> {
  return page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    return {
      init: (w.__stripeInit as FakeStripeCalls['init']) ?? null,
      confirmParams: (w.__confirmParams as FakeStripeCalls['confirmParams']) ?? null,
      createOptions: (w.__createOptions as FakeStripeCalls['createOptions']) ?? null,
    };
  });
}
