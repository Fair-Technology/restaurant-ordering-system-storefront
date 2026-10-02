import type { RejectReason } from '../api/orderEndpoints';

export interface OrderCopy {
  modeCollection: (min: number) => string;
  modeCollectionShort: string;
  modeDelivery: string;
  modeDineIn: string;
  chooseMode: string;
  payCashInfo: string;
  placeOrderCash: string;
  continueToCard: string;
  basketChangedTitle: string;
  lineUnavailable: (name: string) => string;
  lineInvalidOptions: (name: string) => string;
  linePriceChanged: (name: string, now: string, was: string) => string;
  updateBasket: string;
  closedNow: string;
  belowMinimum: (min: string) => string;
  termsChanged: string;
  orderFailed: string;
  yourOrder: (ref: string) => string;
  statusPlaced: (shop: string) => string;
  statusPlacedHint: string;
  statusAccepted: (time: string) => string;
  statusReady: string;
  statusCompleted: string;
  statusRejected: string;
  statusCancelled: string;
  notCharged: string;
  rejectReason: Record<RejectReason, string>;
  cancelOrder: string;
  cancelConfirm: string;
  cancelFailed: string;
  callRestaurant: (phone: string) => string;
  orderNotFound: string;
  total: string;
  paymentCash: string;
  loading: string;
  addonChooseAtLeast: (n: number) => string;
}

const en: OrderCopy = {
  modeCollection: (min) => `Collection · ready in about ${min} min`,
  modeCollectionShort: 'Collection',
  modeDelivery: 'Delivery',
  modeDineIn: 'Eat in',
  chooseMode: 'How would you like your order?',
  payCashInfo: 'You pay at the restaurant when you collect your order.',
  placeOrderCash: 'Order with obligation to pay',
  continueToCard: 'Continue to payment',
  basketChangedTitle: 'Your basket has changed',
  lineUnavailable: (n) => `${n} is no longer available and will be removed.`,
  lineInvalidOptions: (n) => `${n} needs a different choice of extras — please add it again.`,
  linePriceChanged: (n, now, was) => `${n} now costs ${now} (was ${was}).`,
  updateBasket: 'Update my basket',
  closedNow: 'This restaurant is not taking orders right now.',
  belowMinimum: (m) => `The minimum order is ${m}.`,
  termsChanged:
    'The restaurant has updated its terms. Please read them again, then place your order.',
  orderFailed: 'Your order could not be sent. Please try again.',
  yourOrder: (r) => `Order ${r}`,
  statusPlaced: (s) => `Waiting for ${s} to confirm your order`,
  statusPlacedHint:
    'We have emailed you a copy. You can cancel until the restaurant confirms.',
  statusAccepted: (t) => `Confirmed — ready for collection at ${t}`,
  statusReady: 'Ready for collection',
  statusCompleted: 'Collected — enjoy your meal!',
  statusRejected: 'Your order was declined',
  statusCancelled: 'Cancelled',
  notCharged: 'You have not been charged.',
  rejectReason: {
    too_busy: 'The restaurant is too busy right now.',
    item_unavailable: 'An item in your order is no longer available.',
    closing_soon: 'The restaurant is about to close.',
    other: 'The restaurant could not take your order.',
    no_response: 'The restaurant did not confirm your order in time.',
  },
  cancelOrder: 'Cancel order',
  cancelConfirm: 'Cancel this order? This cannot be undone.',
  cancelFailed: 'This order can no longer be cancelled. Please call the restaurant.',
  callRestaurant: (p) => `Questions? Call ${p}.`,
  orderNotFound: 'We could not find this order. Please use the link from your email.',
  total: 'Total',
  paymentCash: 'Payment: on collection',
  loading: 'Loading…',
  addonChooseAtLeast: (n) => `Choose at least ${n}`,
};

const de: OrderCopy = {
  modeCollection: (min) => `Abholung · fertig in ca. ${min} Min.`,
  modeCollectionShort: 'Abholung',
  modeDelivery: 'Lieferung',
  modeDineIn: 'Vor Ort',
  chooseMode: 'Wie möchten Sie bestellen?',
  payCashInfo: 'Sie bezahlen bei der Abholung im Restaurant.',
  placeOrderCash: 'Zahlungspflichtig bestellen',
  continueToCard: 'Weiter zur Zahlung',
  basketChangedTitle: 'Ihr Warenkorb hat sich geändert',
  lineUnavailable: (n) => `${n} ist nicht mehr verfügbar und wird entfernt.`,
  lineInvalidOptions: (n) => `Für ${n} ist eine andere Auswahl nötig – bitte erneut hinzufügen.`,
  linePriceChanged: (n, now, was) => `${n} kostet jetzt ${now} (vorher ${was}).`,
  updateBasket: 'Warenkorb aktualisieren',
  closedNow: 'Dieses Restaurant nimmt gerade keine Bestellungen an.',
  belowMinimum: (m) => `Der Mindestbestellwert beträgt ${m}.`,
  termsChanged:
    'Das Restaurant hat seine Bedingungen aktualisiert. Bitte lesen Sie sie erneut und bestellen Sie dann.',
  orderFailed: 'Ihre Bestellung konnte nicht gesendet werden. Bitte versuchen Sie es erneut.',
  yourOrder: (r) => `Bestellung ${r}`,
  statusPlaced: (s) => `Warten auf Bestätigung durch ${s}`,
  statusPlacedHint:
    'Wir haben Ihnen eine Kopie per E-Mail geschickt. Bis zur Bestätigung können Sie stornieren.',
  statusAccepted: (t) => `Bestätigt – abholbereit um ${t}`,
  statusReady: 'Abholbereit',
  statusCompleted: 'Abgeholt – guten Appetit!',
  statusRejected: 'Ihre Bestellung wurde abgelehnt',
  statusCancelled: 'Storniert',
  notCharged: 'Es wurde nichts berechnet.',
  rejectReason: {
    too_busy: 'Das Restaurant ist gerade zu ausgelastet.',
    item_unavailable: 'Ein Artikel Ihrer Bestellung ist nicht mehr verfügbar.',
    closing_soon: 'Das Restaurant schließt in Kürze.',
    other: 'Das Restaurant konnte Ihre Bestellung nicht annehmen.',
    no_response: 'Das Restaurant hat Ihre Bestellung nicht rechtzeitig bestätigt.',
  },
  cancelOrder: 'Bestellung stornieren',
  cancelConfirm: 'Diese Bestellung stornieren? Das kann nicht rückgängig gemacht werden.',
  cancelFailed:
    'Diese Bestellung kann nicht mehr storniert werden. Bitte rufen Sie das Restaurant an.',
  callRestaurant: (p) => `Fragen? Rufen Sie ${p} an.`,
  orderNotFound:
    'Diese Bestellung wurde nicht gefunden. Bitte nutzen Sie den Link aus Ihrer E-Mail.',
  total: 'Summe',
  paymentCash: 'Zahlung: bei Abholung',
  loading: 'Wird geladen…',
  addonChooseAtLeast: (n) => `Mindestens ${n} wählen`,
};

export function orderCopy(lang: string): OrderCopy {
  return lang === 'de' ? de : en;
}
