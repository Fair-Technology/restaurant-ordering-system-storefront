import { Link } from 'react-router-dom';
import { useGetPublicLegalPackQuery } from '../api/legalEndpoints';
import { useAppSelector } from '../store/hooks';
import { currentChoice, pageLanguageOf } from '../utils/pageLanguage';
import { legalCopy, type LegalDoc } from '../utils/legalCopy';

/**
 * Footer — the restaurant's four legal links and "Ordering by <platform>".
 * The four legal links sit in a row from sm up (two columns on phones), with the
 * "Report illegal content" link on its own line beneath them; platform right from sm up.
 * On a legal page the open document is marked (current).
 */
// flush: sits right under another footer block (the shop info), so no top gap
// language: an authoritative language for the surrounding page (the order page passes the order's own);
// it wins over the stored storefront choice and the browser language.
const Footer = ({
  slug,
  flush = false,
  current,
  language,
}: {
  slug?: string;
  flush?: boolean;
  current?: LegalDoc;
  language?: string;
}) => {
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const lang = language ?? currentChoice(storedLanguage, navigator.language);
  const { data } = useGetPublicLegalPackQuery({ slug: slug ?? '', lang }, { skip: !slug });
  const copy = legalCopy(pageLanguageOf(lang));

  const links: { doc: LegalDoc; label: string }[] = [
    { doc: 'impressum', label: copy.footerImpressum },
    { doc: 'terms', label: copy.footerTerms },
    { doc: 'withdrawal', label: copy.footerWithdrawal },
    { doc: 'privacy', label: copy.footerPrivacy },
  ];

  // The platform's square mark in front of "Ordering by …"
  const platformLine = data && (
    <span
      aria-hidden="true"
      className="flex h-[18px] w-[18px] items-center justify-center rounded-md bg-gray-900 text-[10px] font-bold text-white"
    >
      {data.platform.name.charAt(0)}
    </span>
  );

  return (
    <footer className={`w-full border-t border-[#efe7de] bg-white ${flush ? '' : 'mt-12'}`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 pb-7 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-[22px]">
        {slug && (
          <nav aria-label={copy.legalEyebrow} className="flex flex-col items-start gap-1">
            <div className="grid grid-cols-2 gap-x-3 sm:flex sm:items-center sm:gap-1">
              {links.map(({ doc, label }) => {
                const on = current === doc;
                return (
                  <Link
                    key={doc}
                    to={`/shops/${slug}/legal/${doc}`}
                    aria-current={on ? 'page' : undefined}
                    className={`flex min-h-10 items-center rounded-lg text-sm transition-colors sm:px-2.5 ${
                      on
                        ? 'font-bold text-gray-900 underline decoration-[var(--brand-accent)] decoration-2 underline-offset-[5px]'
                        : 'font-medium text-[#5c524b] hover:text-gray-900'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
            <Link
              to={`/shops/${slug}/report`}
              className="flex min-h-10 items-center rounded-lg text-sm font-medium text-[#5c524b] transition-colors hover:text-gray-900 sm:px-2.5"
            >
              {copy.footerReport}
            </Link>
          </nav>
        )}
        {data && (
          <p className="flex items-center gap-2 text-[13px] text-[#8a7f77]">
            {data.platform.salesSiteUrl ? (
              <a href={data.platform.salesSiteUrl} className="inline-flex items-center gap-2 hover:text-gray-700">
                {platformLine}
                {copy.orderingBy(data.platform.name)}
              </a>
            ) : (
              <>
                {platformLine}
                {copy.orderingBy(data.platform.name)}
              </>
            )}
          </p>
        )}
      </div>
    </footer>
  );
};

export default Footer;
