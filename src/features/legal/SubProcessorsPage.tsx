import React from 'react';
import { useGetPlatformLegalQuery } from '../../api/legalEndpoints';
import { initialMenuLanguage } from '../../utils/menuLanguage';
import { legalCopy } from '../../utils/legalCopy';

const SubProcessorsPage: React.FC = () => {
  const lang = initialMenuLanguage(navigator.language) === 'de' ? 'de' : 'en';
  const copy = legalCopy(lang);
  const { data, isLoading, isError } = useGetPlatformLegalQuery();

  return (
    <main className="w-full max-w-3xl mx-auto px-6 py-8 space-y-6">
      <h1 className="text-2xl font-semibold">{copy.subProcessors}</h1>
      {isLoading && <p>{copy.loading}</p>}
      {isError && <p>{copy.loadError}</p>}
      {data && (
        <ul className="space-y-3">
          {data.subProcessors.map((sp) => (
            <li key={sp.id}>
              {sp.name} — {sp.purpose[lang]} ({sp.location[lang]})
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default SubProcessorsPage;
