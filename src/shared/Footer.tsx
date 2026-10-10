import { Link } from 'react-router-dom';
import { useGetShopLegalQuery } from '../api/legalEndpoints';
import { useAppSelector } from '../store/hooks';
import { initialMenuLanguage } from '../utils/menuLanguage';
import { legalCopy } from '../utils/legalCopy';

// flush: sits right under another footer block (the shop info), so no top gap
const Footer = ({ slug, flush = false }: { slug?: string; flush?: boolean }) => {
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const lang = storedLanguage ?? initialMenuLanguage(navigator.language);
  const { data } = useGetShopLegalQuery({ slug: slug ?? '', lang }, { skip: !slug });
  const copy = legalCopy(data?.language ?? lang);

  const links = [
    { doc: 'impressum', label: copy.footerImpressum },
    { doc: 'terms', label: copy.footerTerms },
    { doc: 'withdrawal', label: copy.footerWithdrawal },
    { doc: 'privacy', label: copy.footerPrivacy },
  ];

  return (
    <footer className={`w-full bg-gray-50 border-t border-gray-200 ${flush ? '' : 'mt-12'}`}>
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        {slug && (
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
            {links.map(({ doc, label }) => (
              <Link
                key={doc}
                to={`/shops/${slug}/legal/${doc}`}
                className="hover:text-gray-900 transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
        {data && (
          <p className="text-xs text-gray-400">
            {data.platform.salesSiteUrl ? (
              <a
                href={data.platform.salesSiteUrl}
                className="hover:text-gray-600 transition-colors"
              >
                {copy.orderingBy(data.platform.name)}
              </a>
            ) : (
              copy.orderingBy(data.platform.name)
            )}
          </p>
        )}
      </div>
    </footer>
  );
};

export default Footer;
