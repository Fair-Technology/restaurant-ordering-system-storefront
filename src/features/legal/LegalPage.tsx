import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, FileText, Info } from 'lucide-react';
import NavBar from '../../shared/NavBar';
import Footer from '../../shared/Footer';
import NotFound from '../../pages/NotFound';
import { useAppSelector } from '../../store/hooks';
import { useGetShopLegalQuery, type PublicLegalPackDto } from '../../api/legalEndpoints';
import { useGetShopBySlugQuery } from '../../api/endpoints';
import { useBrandingStyle } from '../../hooks/useBrandingStyle';
import { resolveShopBranding, type ShopWithBranding } from '../../utils/branding';
import { telHref } from '../../utils/openingHours';
import { currentChoice, pageLanguageOf } from '../../utils/pageLanguage';
import { legalCopy, type LegalCopy, type LegalDoc } from '../../utils/legalCopy';

const DOCS: readonly LegalDoc[] = ['impressum', 'terms', 'withdrawal', 'privacy'];

function isLegalDoc(value: string | undefined): value is LegalDoc {
  return DOCS.includes(value as LegalDoc);
}

/** Short labels for the document switcher (the footer's wording). */
function docLabel(doc: LegalDoc, copy: LegalCopy): string {
  return {
    impressum: copy.footerImpressum,
    terms: copy.footerTerms,
    withdrawal: copy.footerWithdrawal,
    privacy: copy.footerPrivacy,
  }[doc];
}

// "§ 3 Preise", "3. Zahlung", "3) Lieferung": a short first line like this reads as a heading
const HEADING_LINE = /^(§\s*\d+|\d{1,2}[.)])\s+\S/;

/** Plain text from the admin, as paragraphs; numbered short lines become headings. */
function textBlocks(text: string): Array<{ kind: 'h' | 'p'; text: string }> {
  const blocks: Array<{ kind: 'h' | 'p'; text: string }> = [];
  for (const para of text.split(/\n\s*\n/)) {
    const lines = para.split('\n');
    const first = lines[0].trim();
    if (first && HEADING_LINE.test(first) && first.length <= 90) {
      blocks.push({ kind: 'h', text: first });
      const rest = lines.slice(1).join('\n').trim();
      if (rest) blocks.push({ kind: 'p', text: rest });
    } else if (para.trim()) {
      blocks.push({ kind: 'p', text: para.trim() });
    }
  }
  return blocks;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s/()-]{6,}$/;

const linkClass = 'font-semibold text-gray-900 underline underline-offset-[3px] hover:decoration-2';

/** A value from the Impressum: email and phone numbers become links. */
const ImpressumValue: React.FC<{ value: string }> = ({ value }) => {
  const v = value.trim();
  if (EMAIL.test(v)) return <a href={`mailto:${v}`} className={linkClass}>{v}</a>;
  if (PHONE.test(v) && /\d{5,}/.test(v.replace(/\D/g, ''))) return <a href={telHref(v)} className={linkClass}>{v}</a>;
  return <span className="whitespace-pre-line">{value}</span>;
};

const h2Class = 'mb-2 mt-7 text-[18px] font-bold text-gray-900 first:mt-0 sm:text-[19px]';

const NotPublished: React.FC<{ copy: LegalCopy; phone: string | null }> = ({ copy, phone }) => (
  <div className="flex flex-col items-start gap-3 rounded-[18px] border border-[#efe7de] bg-[#faf6f1] p-6 sm:p-7">
    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#efe7de] bg-white text-[#8a7f77]">
      <FileText className="h-[22px] w-[22px]" aria-hidden="true" />
    </span>
    <strong className="text-lg text-gray-900">{copy.notPublishedTitle}</strong>
    <p className="text-[15px] leading-relaxed text-gray-600">
      {copy.notPublished}
      {phone && (
        <>
          {' '}
          {copy.notPublishedCall}{' '}
          <a href={telHref(phone)} className={linkClass}>
            {phone}
          </a>
          .
        </>
      )}
    </p>
  </div>
);

const DocumentBody: React.FC<{ doc: LegalDoc; data: PublicLegalPackDto; copy: LegalCopy }> = ({ doc, data, copy }) => {
  const phone = data.seller.phone;
  if (doc === 'impressum') {
    if (!data.impressum) return <NotPublished copy={copy} phone={phone} />;
    return (
      <dl className="grid grid-cols-1 border-t border-[#efe7de] sm:grid-cols-[200px_minmax(0,1fr)]">
        {data.impressum.lines.map((line) => (
          <div key={line.label} className="contents">
            <dt className="pt-3.5 text-[13px] font-semibold text-[#6b6058] sm:border-b sm:border-[#efe7de] sm:py-3.5 sm:text-sm">
              {line.label}
            </dt>
            <dd className="border-b border-[#efe7de] pb-3.5 pt-0.5 text-gray-900 sm:py-3.5">
              <ImpressumValue value={line.value} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  if (doc === 'privacy') {
    const notice = data.privacyNotice;
    if (!notice) return <NotPublished copy={copy} phone={phone} />;
    return (
      <div>
        {notice.isDraft && (
          <div role="note" className="mb-6 flex items-start gap-2.5 rounded-xl border border-[#f1dfae] bg-[#fff6e0] px-3.5 py-3 text-sm leading-snug text-[#5c3c00]">
            <Info className="mt-px h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <span>{copy.draftNotice}</span>
          </div>
        )}
        {notice.sections.map((section, i) => (
          <section key={section.heading} id={`section-${i + 1}`} className="scroll-mt-24">
            <h2 className={h2Class}>{section.heading}</h2>
            {section.paragraphs.map((p, j) => (
              <p key={j} className="mb-3.5 whitespace-pre-line">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    );
  }
  const text = doc === 'terms' ? data.terms : data.withdrawal;
  if (!text) return <NotPublished copy={copy} phone={phone} />;
  return (
    <div>
      {textBlocks(text.text).map((b, i) =>
        b.kind === 'h' ? (
          <h2 key={i} className={h2Class}>
            {b.text}
          </h2>
        ) : (
          <p key={i} className="mb-3.5 whitespace-pre-line">
            {b.text}
          </p>
        ),
      )}
    </div>
  );
};

/**
 * LegalPage — the restaurant's Impressum, AGB, Widerrufsbelehrung and Datenschutz.
 *
 * The shop's own top bar, then a beige head (back to the menu, "<shop> · Legal", title, last
 * updated). From md up the four documents are a side menu (privacy adds "On this page"); on phones
 * they are swipeable pills under the title. Text is kept to a readable line length.
 */
const LegalPage: React.FC = () => {
  const { slug, doc } = useParams<{ slug: string; doc: string }>();
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const lang = currentChoice(storedLanguage, navigator.language);
  const pageLang = pageLanguageOf(lang);
  const { data, isLoading, isError } = useGetShopLegalQuery(
    { slug: slug ?? '', lang },
    { skip: !slug || !isLegalDoc(doc) },
  );
  const { data: shop } = useGetShopBySlugQuery(slug ?? '', { skip: !slug });
  const branding = resolveShopBranding((shop as ShopWithBranding | undefined)?.branding);
  const brandStyle = useBrandingStyle(branding);

  if (!isLegalDoc(doc)) return <NotFound />;
  const copy = legalCopy(pageLang);
  const shopName = data?.shopName ?? shop?.name ?? '';

  const updatedAt = doc === 'terms' ? data?.terms?.updatedAt : doc === 'withdrawal' ? data?.withdrawal?.updatedAt : undefined;
  const updated = updatedAt
    ? new Date(updatedAt).toLocaleDateString(pageLang === 'de' ? 'de-DE' : 'en-GB', {
        day: pageLang === 'de' ? '2-digit' : 'numeric',
        month: pageLang === 'de' ? '2-digit' : 'long',
        year: 'numeric',
      })
    : null;
  const sections = doc === 'privacy' ? (data?.privacyNotice?.sections ?? []) : [];

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900" style={brandStyle}>
      <NavBar shopName={shopName} shopId={slug ?? ''} logoUrl={branding.logoUrl} />

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
              {shopName} · {copy.legalEyebrow}
            </div>
          )}
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-[1.1] sm:text-[44px] sm:leading-[1.05]">
            {copy.heading[doc]}
          </h1>
          {updated && <p className="mt-1.5 text-[13px] text-[#6b6058] sm:mt-2.5 sm:text-sm">{copy.updatedOn(updated)}</p>}

          {/* Phones: the documents as swipeable pills */}
          <nav
            aria-label={copy.legalEyebrow}
            className="-mx-4 mt-3.5 flex gap-1.5 overflow-x-auto px-4 pb-3.5 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
          >
            {DOCS.map((d) => (
              <Link
                key={d}
                to={`/shops/${slug}/legal/${d}`}
                aria-current={d === doc ? 'page' : undefined}
                className={`flex h-10 shrink-0 items-center rounded-full border-[1.5px] px-4 text-sm font-semibold ${
                  d === doc ? 'border-gray-900 bg-gray-900 text-white' : 'border-[#e3d9ce] bg-white text-gray-900'
                }`}
              >
                {docLabel(d, copy)}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl flex-1 px-5 pb-12 pt-6 sm:px-6 md:grid md:grid-cols-[230px_minmax(0,1fr)] md:gap-12 md:pb-16 md:pt-9 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-14">
        {/* md+: side menu */}
        <aside className="hidden md:block">
          <div className="sticky top-6 flex flex-col gap-6">
            <nav aria-label={copy.legalEyebrow} className="flex flex-col gap-0.5">
              {DOCS.map((d) => {
                const on = d === doc;
                return (
                  <Link
                    key={d}
                    to={`/shops/${slug}/legal/${d}`}
                    aria-current={on ? 'page' : undefined}
                    className={`flex min-h-11 items-center rounded-[10px] px-3.5 text-[15px] transition-colors ${
                      on
                        ? 'bg-[#faf6f1] font-bold text-gray-900 shadow-[inset_3px_0_0_var(--brand-accent)]'
                        : 'font-medium text-[#5c524b] hover:bg-[#faf6f1] hover:text-gray-900'
                    }`}
                  >
                    {docLabel(d, copy)}
                  </Link>
                );
              })}
            </nav>
            {sections.length > 1 && (
              <nav aria-label={copy.onThisPage} className="flex flex-col gap-1 border-t border-[#efe7de] pt-[18px]">
                <div className="pb-1 text-xs font-bold uppercase tracking-wider text-[#6b6058]">{copy.onThisPage}</div>
                {sections.map((s, i) => (
                  <a key={s.heading} href={`#section-${i + 1}`} className="py-1 text-sm text-[#5c524b] hover:text-gray-900">
                    {s.heading}
                  </a>
                ))}
              </nav>
            )}
          </div>
        </aside>

        <article className="max-w-[680px] text-base leading-[1.7] text-[#3a322d]">
          {isLoading && <p className="text-gray-500">{copy.loading}</p>}
          {isError && <p>{copy.loadError}</p>}
          {data && <DocumentBody doc={doc} data={data} copy={copy} />}
        </article>
      </div>

      <Footer slug={slug} flush current={doc} />
    </div>
  );
};

export default LegalPage;
