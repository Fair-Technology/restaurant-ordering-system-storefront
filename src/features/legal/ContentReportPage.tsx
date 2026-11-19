import SkipLink from '../../shared/SkipLink';
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import NavBar from '../../shared/NavBar';
import Footer from '../../shared/Footer';
import NotFound from '../../pages/NotFound';
import { useAppSelector } from '../../store/hooks';
import { useGetShopBySlugQuery } from '../../api/endpoints';
import {
  useSubmitContentReportMutation,
  REPORT_REASON_MAX_LENGTH,
  REPORT_URL_MAX_LENGTH,
  REPORTER_NAME_MAX_LENGTH,
  REPORTER_EMAIL_MAX_LENGTH,
  type ReportField,
  type SubmitContentReportRequest,
  type SubmitContentReportResponse,
} from '../../api/reportEndpoints';
import { useBrandingStyle } from '../../hooks/useBrandingStyle';
import { resolveShopBranding, type ShopWithBranding } from '../../utils/branding';
import { currentChoice, pageLanguageOf } from '../../utils/pageLanguage';
import { isBlank } from '../../utils/formValidation';
import { REPORT_CATEGORIES, reportCopy, type ReportCategory } from '../../utils/reportCopy';

const isHttpUrl = (value: string): boolean => {
  // Reject obviously bad schemes (ftp:, javascript:, data:, ...) before constructing the URL.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const labelClass = 'block text-sm font-semibold text-gray-900';
const inputClass =
  'mt-1 w-full rounded-[12px] border border-[#e3d9ce] bg-white px-3.5 py-2.5 text-[15px] text-gray-900 outline-none transition-colors focus:border-gray-900';

/**
 * ContentReportPage — the diner's anonymous notice-and-action form at
 * /shops/:slug/report. It resolves the shop from the slug and posts a
 * content report to the platform. On success the form is replaced by a
 * receipt showing the returned report id; API validation messages are shown
 * under the field they belong to.
 */
const ContentReportPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const lang = currentChoice(storedLanguage, navigator.language);
  const pageLang = pageLanguageOf(lang);
  const copy = reportCopy(pageLang);

  const {
    data: shop,
    isLoading: shopLoading,
    error: shopError,
  } = useGetShopBySlugQuery(slug ?? '', { skip: !slug });
  const branding = resolveShopBranding((shop as ShopWithBranding | undefined)?.branding);
  const brandStyle = useBrandingStyle(branding);

  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  const [contentUrl, setContentUrl] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ReportField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmitContentReportResponse | null>(null);
  const [submit, { isLoading: submitting }] = useSubmitContentReportMutation();

  if (shopError && 'status' in shopError && shopError.status === 404) {
    return <NotFound kind="shop" />;
  }

  const shopName = shop?.name ?? '';

  const clearField = (field: ReportField) =>
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const fieldError = (field: ReportField) => {
    const message = fieldErrors[field];
    if (!message) return null;
    return (
      <p id={`error-${field}`} role="alert" data-testid={`error-${field}`} className="mt-1 text-sm text-red-700">
        {message}
      </p>
    );
  };

  const describedBy = (field: ReportField) => (fieldErrors[field] ? `error-${field}` : undefined);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop?.id) return;
    setFieldErrors({});
    setFormError(null);

    // Client-side validation, in field order: category -> reason -> contentUrl.
    const errors: Partial<Record<ReportField, string>> = {};
    const invalidOrder: { field: ReportField; id: string }[] = [];
    const trimmedUrl = contentUrl.trim();
    if (!category || !(REPORT_CATEGORIES as readonly string[]).includes(category)) {
      errors.category = copy.categoryRequiredError;
      invalidOrder.push({ field: 'category', id: 'report-category' });
    }
    if (isBlank(reason)) {
      errors.reason = copy.reasonRequiredError;
      invalidOrder.push({ field: 'reason', id: 'report-reason' });
    }
    if (trimmedUrl && !isHttpUrl(trimmedUrl)) {
      errors.contentUrl = copy.urlInvalidError;
      invalidOrder.push({ field: 'contentUrl', id: 'report-url' });
    }
    if (invalidOrder.length > 0) {
      setFieldErrors(errors);
      const first = document.getElementById(invalidOrder[0].id);
      if (first) {
        first.focus();
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Send clean data: the backend treats an empty string as absent, but omit blank optional fields.
    const body: SubmitContentReportRequest = {
      shopId: shop.id,
      category: category as ReportCategory,
      reason: reason.trim(),
    };
    const url = contentUrl.trim();
    if (url) body.contentUrl = url;
    const name = reporterName.trim();
    if (name) body.reporterName = name;
    const email = reporterEmail.trim();
    if (email) body.reporterEmail = email;

    try {
      const result = await submit(body).unwrap();
      setReceipt(result);
    } catch {
      // Never surface the raw backend message; show the translated generic error.
      setFormError(copy.genericSubmitError);
    }
  };

  const receivedDate = receipt
    ? new Date(receipt.receivedAt).toLocaleDateString(pageLang === 'de' ? 'de-DE' : 'en-GB', {
        day: pageLang === 'de' ? '2-digit' : 'numeric',
        month: pageLang === 'de' ? '2-digit' : 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900" style={brandStyle}>
      <SkipLink />
      <NavBar
        shopName={shopName}
        shopId={slug ?? ''}
        logoUrl={branding.logoUrl}
        hideCart
        fallbackLabel={copy.backToMenu}
      />

      <section className="border-b border-[#efe7de] bg-[#faf6f1]">
        <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 sm:pb-[30px] sm:pt-[22px]">
          <Link
            to={`/shops/${slug}`}
            className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#5c524b] hover:text-gray-900"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
            {copy.backToMenu}
          </Link>
          {shopName && (
            <div className="mt-2.5 hidden text-[13px] font-semibold uppercase tracking-wider text-[#6b6058] sm:block">
              {shopName} · {copy.eyebrow}
            </div>
          )}
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-[1.1] sm:text-[44px] sm:leading-[1.05]">
            {copy.title}
          </h1>
        </div>
      </section>

      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-5 pb-12 pt-6 sm:px-6">
        <article className="max-w-[680px] text-base leading-[1.7] text-[#3a322d]">
          {receipt ? (
            <div
              data-testid="report-receipt"
              className="rounded-[18px] border border-[#efe7de] bg-[#faf6f1] p-6 sm:p-7"
            >
              <h2 className="text-lg font-bold text-gray-900">{copy.receiptTitle}</h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-[#3a322d]">{copy.receiptBody}</p>
              <div className="mt-4">
                <div className="text-[13px] font-semibold uppercase tracking-wider text-[#6b6058]">
                  {copy.receiptIdLabel}
                </div>
                <code
                  data-testid="report-id"
                  className="mt-1 inline-block select-all rounded-lg border border-[#efe7de] bg-white px-2.5 py-1 font-mono text-[15px] text-gray-900"
                >
                  {receipt.reportId}
                </code>
              </div>
              <p className="mt-3 text-sm text-[#6b6058]">{copy.receiptReceivedAt(receivedDate)}</p>
              <p className="mt-1 text-sm text-[#6b6058]">{copy.receiptKeep}</p>
              <Link
                to={`/shops/${slug}`}
                className="mt-5 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#5c524b] hover:text-gray-900"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                {copy.backToMenu}
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-2">{copy.lead}</p>
              <p className="mb-6 text-sm text-[#6b6058]">{copy.privacyNote}</p>

              <form
                noValidate
                onSubmit={onSubmit}
                className="rounded-[18px] border border-[#efe7de] bg-[#faf6f1] p-6 sm:p-7"
              >
                {formError && (
                  <p
                    role="alert"
                    data-testid="report-error"
                    className="mb-5 rounded-xl border border-[#f1dfae] bg-[#fff6e0] px-3.5 py-3 text-sm leading-snug text-[#5c3c00]"
                  >
                    <strong className="block font-bold">{copy.formErrorTitle}</strong>
                    {formError}
                  </p>
                )}

                {!shopLoading && !shop && <p className="mb-4 text-sm text-red-700">{copy.shopUnknown}</p>}

                <div>
                  <label htmlFor="report-category" className={labelClass}>
                    {copy.categoryLabel}
                  </label>
                  <select
                    id="report-category"
                    data-testid="report-category"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      clearField('category');
                    }}
                    aria-invalid={fieldErrors.category ? true : undefined}
                    aria-describedby={describedBy('category')}
                    className={inputClass}
                  >
                    <option value="">{copy.categoryPlaceholder}</option>
                    {REPORT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {copy.categoryOptions[c]}
                      </option>
                    ))}
                  </select>
                  {fieldError('category')}
                </div>

                <div className="mt-5">
                  <label htmlFor="report-reason" className={labelClass}>
                    {copy.reasonLabel}
                  </label>
                  <textarea
                    id="report-reason"
                    data-testid="report-reason"
                    rows={6}
                    maxLength={REPORT_REASON_MAX_LENGTH}
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      clearField('reason');
                    }}
                    aria-invalid={fieldErrors.reason ? true : undefined}
                    aria-describedby={describedBy('reason')}
                    className={inputClass}
                  />
                  <p className="mt-1 text-sm text-[#6b6058]">{copy.reasonHint}</p>
                  {fieldError('reason')}
                </div>

                <p className="mt-6 text-sm text-[#6b6058]">{copy.optionalNote}</p>

                <div className="mt-5">
                  <label htmlFor="report-url" className={labelClass}>
                    {copy.contentUrlLabel}
                  </label>
                  <input
                    id="report-url"
                    type="text"
                    data-testid="report-url"
                    maxLength={REPORT_URL_MAX_LENGTH}
                    value={contentUrl}
                    onChange={(e) => {
                      setContentUrl(e.target.value);
                      clearField('contentUrl');
                    }}
                    aria-invalid={fieldErrors.contentUrl ? true : undefined}
                    aria-describedby={describedBy('contentUrl')}
                    className={inputClass}
                  />
                  {fieldError('contentUrl')}
                </div>

                <div className="mt-5">
                  <label htmlFor="report-name" className={labelClass}>
                    {copy.reporterNameLabel}
                  </label>
                  <input
                    id="report-name"
                    type="text"
                    data-testid="report-name"
                    maxLength={REPORTER_NAME_MAX_LENGTH}
                    value={reporterName}
                    onChange={(e) => {
                      setReporterName(e.target.value);
                      clearField('reporterName');
                    }}
                    aria-invalid={fieldErrors.reporterName ? true : undefined}
                    aria-describedby={describedBy('reporterName')}
                    className={inputClass}
                  />
                  {fieldError('reporterName')}
                </div>

                <div className="mt-5">
                  <label htmlFor="report-email" className={labelClass}>
                    {copy.reporterEmailLabel}
                  </label>
                  <input
                    id="report-email"
                    type="email"
                    data-testid="report-email"
                    maxLength={REPORTER_EMAIL_MAX_LENGTH}
                    value={reporterEmail}
                    onChange={(e) => {
                      setReporterEmail(e.target.value);
                      clearField('reporterEmail');
                    }}
                    aria-invalid={fieldErrors.reporterEmail ? true : undefined}
                    aria-describedby={describedBy('reporterEmail')}
                    className={inputClass}
                  />
                  {fieldError('reporterEmail')}
                </div>

                <button
                  type="submit"
                  disabled={submitting || !shop?.id}
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-gray-900 px-6 text-sm font-bold text-white transition-colors hover:bg-black disabled:opacity-60"
                >
                  {submitting ? copy.submitting : copy.submit}
                </button>
              </form>
            </>
          )}
        </article>
      </main>

      <Footer slug={slug} flush />
    </div>
  );
};

export default ContentReportPage;
