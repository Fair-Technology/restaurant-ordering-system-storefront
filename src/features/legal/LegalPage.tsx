import React from 'react';
import { Link, useParams } from 'react-router-dom';
import NavBar from '../../shared/NavBar';
import Footer from '../../shared/Footer';
import NotFound from '../../pages/NotFound';
import { useAppSelector } from '../../store/hooks';
import { useGetShopLegalQuery, type PublicLegalPackDto } from '../../api/legalEndpoints';
import { currentChoice, pageLanguageOf } from '../../utils/pageLanguage';
import { legalCopy, type LegalCopy, type LegalDoc } from '../../utils/legalCopy';

const DOCS: readonly LegalDoc[] = ['impressum', 'terms', 'withdrawal', 'privacy'];

function isLegalDoc(value: string | undefined): value is LegalDoc {
  return DOCS.includes(value as LegalDoc);
}

const DocumentBody: React.FC<{ doc: LegalDoc; data: PublicLegalPackDto; copy: LegalCopy }> = ({
  doc,
  data,
  copy,
}) => {
  if (doc === 'impressum') {
    if (!data.impressum) return <p>{copy.notPublished}</p>;
    return (
      <dl className="space-y-3">
        {data.impressum.lines.map((line) => (
          <div key={line.label}>
            <dt className="text-sm font-medium text-gray-500">{line.label}</dt>
            <dd className="text-gray-900">{line.value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  if (doc === 'privacy') {
    const notice = data.privacyNotice;
    if (!notice) return <p>{copy.notPublished}</p>;
    return (
      <div className="space-y-4">
        {notice.isDraft && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {copy.draftNotice}
          </div>
        )}
        {notice.sections.map((section) => (
          <section key={section.heading} className="space-y-2">
            <h2 className="text-lg font-semibold">{section.heading}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    );
  }

  const text = doc === 'terms' ? data.terms : data.withdrawal;
  if (!text) return <p>{copy.notPublished}</p>;
  return <p className="whitespace-pre-line">{text.text}</p>;
};

const LegalPage: React.FC = () => {
  const { slug, doc } = useParams<{ slug: string; doc: string }>();
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const lang = currentChoice(storedLanguage, navigator.language);
  const { data, isLoading, isError } = useGetShopLegalQuery(
    { slug: slug ?? '', lang },
    { skip: !slug || !isLegalDoc(doc) },
  );

  if (!isLegalDoc(doc)) return <NotFound />;

  const copy = legalCopy(pageLanguageOf(lang));

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <NavBar shopName={data?.shopName ?? ''} shopId={slug ?? ''} logoUrl={null} />
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-8 space-y-6">
        <h1 className="text-2xl font-semibold">{copy.heading[doc]}</h1>
        {isLoading && <p>{copy.loading}</p>}
        {isError && <p>{copy.loadError}</p>}
        {data && <DocumentBody doc={doc} data={data} copy={copy} />}
        <Link to={`/shops/${slug}`} className="inline-block text-sm text-gray-600 underline">
          {copy.backToMenu}
        </Link>
      </main>
      <Footer slug={slug} />
    </div>
  );
};

export default LegalPage;
