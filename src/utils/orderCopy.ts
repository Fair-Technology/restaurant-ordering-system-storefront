import type { OrderDocument, RejectReason } from '../api/orderEndpoints';

export interface OrderCopy {
  modeCollection: (min: number) => string;
  modeCollectionShort: string;
  modeDelivery: string;
  modeDineIn: string;
  chooseMode: string;
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
  reservationBankNote: string;
  rejectReason: Record<RejectReason, string>;
  cancelOrder: string;
  cancelConfirm: string;
  cancelFailed: string;
  callRestaurant: (phone: string) => string;
  orderNotFound: string;
  total: string;
  loading: string;
  continueToPayment: string;
  payOnlineInfo: string;
  placeOrderCard: string;
  paying: string;
  paymentTitle: string;
  backToDetails: string;
  backToCheckout: string;
  paymentFailed: string;
  noOnlinePayment: string;
  addressTitleOptional: string;
  addressTitleRequired: string;
  addressStreet: string;
  addressPostcode: string;
  addressCity: string;
  addressCountry: string;
  addressIncomplete: string;
  addressNeeded: string;
  confirmingPayment: string;
  reservePromise: string;
  refundInProgress: (amount: string) => string;
  refunded: (amount: string) => string;
  partlyRefunded: (amount: string) => string;
  reservedOnline: string;
  paidOnline: string;
  downloadDocument: Record<OrderDocument['kind'], string>;
  invoiceFailed: string;
  cancelConfirmTitle: string;
  cancelConfirmYes: string;
  cancelConfirmNo: string;
  addonChooseAtLeast: (n: number) => string;
  tableBanner: (label: string) => string;
  leaveTable: string;
  tableInvalid: string;
  orderingForTable: (label: string) => string;
  tableExpired: string;
  dineInOff: string;
  tableLine: (label: string) => string;
  statusAcceptedDineIn: (time: string) => string;
  statusReadyDineIn: string;
  statusCompletedDineIn: string;
  orderingPaused: string;
}

const en: OrderCopy = {
  modeCollection: (min) => `Collection · ready in about ${min} min`,
  modeCollectionShort: 'Collection',
  modeDelivery: 'Delivery',
  modeDineIn: 'Dine in',
  chooseMode: 'How would you like your order?',
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
  notCharged: 'You have not been charged. The reservation on your card has been released.',
  reservationBankNote: 'Depending on your bank, the reservation may still show as pending for a few days.',
  rejectReason: {
    too_busy: 'The restaurant is too busy right now.',
    item_unavailable: 'An item in your order is no longer available.',
    closing_soon: 'The restaurant is about to close.',
    other: 'The restaurant could not take your order.',
    no_response: 'The restaurant did not confirm your order in time.',
    payment_failed: 'The payment could not be completed when the restaurant accepted.',
  },
  cancelOrder: 'Cancel order',
  cancelConfirm: 'This cannot be undone. Nothing is charged.',
  cancelFailed: 'This order can no longer be cancelled. Please call the restaurant.',
  callRestaurant: (p) => `Questions? Call ${p}.`,
  orderNotFound: 'We could not find this order. Please use the link from your email.',
  total: 'Total',
  loading: 'Loading…',
  continueToPayment: 'Continue to payment',
  payOnlineInfo:
    'You pay online now — by card, Apple Pay or Google Pay. The amount is only reserved; you are charged when the restaurant accepts.',
  placeOrderCard: 'Order with obligation to pay',
  paying: 'Processing payment…',
  paymentTitle: 'Payment',
  backToDetails: 'Back to details',
  backToCheckout: 'Back to checkout',
  paymentFailed: 'The payment did not go through. You have not been charged — please try again.',
  noOnlinePayment: 'This restaurant cannot take online orders yet.',
  addressTitleOptional: 'Billing address (optional, printed on your invoice)',
  addressTitleRequired: 'Billing address (required for orders over €250)',
  addressStreet: 'Street and number',
  addressPostcode: 'Postcode',
  addressCity: 'City',
  addressCountry: 'Country',
  addressIncomplete: 'Please fill in the whole address or leave it empty.',
  addressNeeded: 'For orders over €250 we need your billing address for the invoice.',
  confirmingPayment: 'Your payment is being confirmed…',
  reservePromise:
    'The amount is reserved on your card. You are only charged when the restaurant accepts — if it declines or you cancel, the reservation is released.',
  refundInProgress: (a) => `We are refunding the full amount of ${a}.`,
  refunded: (a) => `The full amount of ${a} has been refunded.`,
  partlyRefunded: (a) => `${a} has been refunded to you.`,
  reservedOnline: 'Reserved online',
  paidOnline: 'Paid online',
  downloadDocument: {
    invoice: 'Download invoice',
    cancellation: 'Download cancellation invoice',
    correction: 'Download correction invoice',
  },
  invoiceFailed: 'The document could not be downloaded.',
  cancelConfirmTitle: 'Cancel this order?',
  cancelConfirmYes: 'Yes, cancel order',
  cancelConfirmNo: 'Keep order',
  addonChooseAtLeast: (n) => `Choose at least ${n}`,
  tableBanner: (l) => `Table ${l} · Dine in`,
  leaveTable: 'Not at this table? Order for collection instead',
  tableInvalid: 'This table QR code is not valid. Please ask a member of staff.',
  orderingForTable: (l) => `Ordering for table ${l}`,
  tableExpired: 'Your table session has expired. Please scan the QR code on your table again.',
  dineInOff: 'This restaurant is not taking table orders right now. You can order for collection.',
  tableLine: (l) => `Table ${l}`,
  statusAcceptedDineIn: (t) => `Confirmed — ready at ${t}`,
  statusReadyDineIn: 'Your order is ready',
  statusCompletedDineIn: 'Enjoy your meal!',
  orderingPaused:
    'Online ordering is paused at the moment. Please try again later or contact the restaurant directly.',
};

const de: OrderCopy = {
  modeCollection: (min) => `Abholung · fertig in ca. ${min} Min.`,
  modeCollectionShort: 'Abholung',
  modeDelivery: 'Lieferung',
  modeDineIn: 'Vor Ort',
  chooseMode: 'Wie möchten Sie bestellen?',
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
  notCharged: 'Es wurde nichts abgebucht. Die Reservierung auf Ihrer Karte wurde aufgehoben.',
  reservationBankNote:
    'Je nach Bank kann die Reservierung noch einige Tage als vorgemerkt angezeigt werden.',
  rejectReason: {
    too_busy: 'Das Restaurant ist gerade zu ausgelastet.',
    item_unavailable: 'Ein Artikel Ihrer Bestellung ist nicht mehr verfügbar.',
    closing_soon: 'Das Restaurant schließt in Kürze.',
    other: 'Das Restaurant konnte Ihre Bestellung nicht annehmen.',
    no_response: 'Das Restaurant hat Ihre Bestellung nicht rechtzeitig bestätigt.',
    payment_failed: 'Die Zahlung konnte bei der Annahme nicht abgeschlossen werden.',
  },
  cancelOrder: 'Bestellung stornieren',
  cancelConfirm: 'Das kann nicht rückgängig gemacht werden. Es wird nichts abgebucht.',
  cancelFailed:
    'Diese Bestellung kann nicht mehr storniert werden. Bitte rufen Sie das Restaurant an.',
  callRestaurant: (p) => `Fragen? Rufen Sie ${p} an.`,
  orderNotFound:
    'Diese Bestellung wurde nicht gefunden. Bitte nutzen Sie den Link aus Ihrer E-Mail.',
  total: 'Summe',
  loading: 'Wird geladen…',
  continueToPayment: 'Weiter zur Zahlung',
  payOnlineInfo:
    'Sie bezahlen jetzt online – mit Karte, Apple Pay oder Google Pay. Der Betrag wird nur reserviert und erst abgebucht, wenn das Restaurant annimmt.',
  placeOrderCard: 'Zahlungspflichtig bestellen',
  paying: 'Zahlung läuft…',
  paymentTitle: 'Zahlung',
  backToDetails: 'Zurück zu den Angaben',
  backToCheckout: 'Zurück zur Kasse',
  paymentFailed:
    'Die Zahlung hat nicht geklappt. Es wurde nichts abgebucht – bitte versuchen Sie es erneut.',
  noOnlinePayment: 'Dieses Restaurant kann noch keine Online-Bestellungen annehmen.',
  addressTitleOptional: 'Rechnungsadresse (optional, steht auf Ihrer Rechnung)',
  addressTitleRequired: 'Rechnungsadresse (bei Bestellungen über 250 € erforderlich)',
  addressStreet: 'Straße und Hausnummer',
  addressPostcode: 'PLZ',
  addressCity: 'Ort',
  addressCountry: 'Land',
  addressIncomplete: 'Bitte füllen Sie die Adresse vollständig aus oder lassen Sie sie leer.',
  addressNeeded: 'Für Bestellungen über 250 € benötigen wir Ihre Rechnungsadresse.',
  confirmingPayment: 'Ihre Zahlung wird bestätigt…',
  reservePromise:
    'Der Betrag ist auf Ihrer Karte reserviert. Abgebucht wird erst, wenn das Restaurant annimmt – lehnt es ab oder stornieren Sie, wird die Reservierung aufgehoben.',
  refundInProgress: (a) => `Wir erstatten Ihnen den vollen Betrag von ${a}.`,
  refunded: (a) => `Der volle Betrag von ${a} wurde erstattet.`,
  partlyRefunded: (a) => `${a} wurde Ihnen erstattet.`,
  reservedOnline: 'Online reserviert',
  paidOnline: 'Online bezahlt',
  downloadDocument: {
    invoice: 'Rechnung herunterladen',
    cancellation: 'Stornorechnung herunterladen',
    correction: 'Rechnungskorrektur herunterladen',
  },
  invoiceFailed: 'Das Dokument konnte nicht heruntergeladen werden.',
  cancelConfirmTitle: 'Bestellung stornieren?',
  cancelConfirmYes: 'Ja, stornieren',
  cancelConfirmNo: 'Bestellung behalten',
  addonChooseAtLeast: (n) => `Mindestens ${n} wählen`,
  tableBanner: (l) => `Tisch ${l} · Vor Ort`,
  leaveTable: 'Nicht an diesem Tisch? Stattdessen abholen',
  tableInvalid: 'Dieser Tisch-QR-Code ist ungültig. Bitte wenden Sie sich an das Personal.',
  orderingForTable: (l) => `Bestellung für Tisch ${l}`,
  tableExpired: 'Ihre Tischsitzung ist abgelaufen. Bitte scannen Sie den QR-Code auf Ihrem Tisch erneut.',
  dineInOff: 'Dieses Restaurant nimmt gerade keine Tischbestellungen an. Sie können zur Abholung bestellen.',
  tableLine: (l) => `Tisch ${l}`,
  statusAcceptedDineIn: (t) => `Bestätigt – fertig um ${t}`,
  statusReadyDineIn: 'Ihre Bestellung ist fertig',
  statusCompletedDineIn: 'Guten Appetit!',
  orderingPaused:
    'Online-Bestellungen sind im Moment pausiert. Bitte versuchen Sie es später erneut oder wenden Sie sich direkt an das Restaurant.',
};

export function orderCopy(lang: string): OrderCopy {
  return lang === 'de' ? de : en;
}
