import React from 'react';
import { Info } from 'lucide-react';
import { useGetPlatformLegalQuery } from '../../api/legalEndpoints';
import PlatformHeader from '../../shared/PlatformHeader';
import { useAppSelector } from '../../store/hooks';
import { currentChoice, pageLanguageOf } from '../../utils/pageLanguage';
import { siteCopy, PLATFORM_NAME } from '../../utils/siteCopy';

const label = 'text-xs font-bold uppercase tracking-wider text-[#6b6058]';

/**
 * SubProcessorsPage — the platform's list of sub-processors: a table (provider, purpose, where)
 * from sm up and a list on phones, then the operator and the data processing agreement version.
 */
const SubProcessorsPage: React.FC = () => {
  const storedLanguage = useAppSelector((state) => state.shop.menuLanguage);
  const lang = pageLanguageOf(currentChoice(storedLanguage, navigator.language));
  const copy = siteCopy(lang);
  const { data, isLoading, isError } = useGetPlatformLegalQuery();
  const platform = data?.platformName || PLATFORM_NAME;
  const operator = data?.operator;
  const hasOperator = !!(operator && (operator.legalName || operator.address || operator.email));

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <PlatformHeader />
      <section className="border-b border-[#efe7de] bg-[#faf6f1]">
        <div className="mx-auto max-w-5xl px-4 pb-5 pt-5 sm:px-6 sm:pb-[26px] sm:pt-6">
          <div className={`hidden sm:block ${label} text-[13px]`}>
            {platform} · {copy.subEyebrow}
          </div>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-tight [hyphens:auto] sm:text-[38px]" lang={lang}>
            {copy.subTitle}
          </h1>
          <p className="mt-2 max-w-[600px] text-sm leading-relaxed text-[#5c524b] sm:mt-2.5 sm:text-[15px]">{copy.subLead(platform)}</p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12 pt-2 sm:px-6 sm:pt-6">
        {isLoading && <p className="pt-4 text-gray-500">{copy.loading}</p>}
        {isError && <p className="pt-4">{copy.loadError}</p>}
        {data && (
          <>
            {/* A table from sm up; on phones the same rows stack as a list */}
            <table className="w-full border-collapse text-[15px] max-sm:block">
              <thead className="max-sm:hidden">
                <tr className={`text-left ${label}`}>
                  <th scope="col" className="border-b border-[#efe7de] pb-2.5 pr-3 font-bold">{copy.subProvider}</th>
                  <th scope="col" className="border-b border-[#efe7de] px-3 pb-2.5 font-bold">{copy.subPurpose}</th>
                  <th scope="col" className="border-b border-[#efe7de] pb-2.5 pl-3 font-bold">{copy.subLocation}</th>
                </tr>
              </thead>
              <tbody className="max-sm:block">
                {data.subProcessors.map((sp) => (
                  <tr key={sp.id} className="max-sm:flex max-sm:flex-col max-sm:gap-1 max-sm:border-b max-sm:border-[#f1ebe4] max-sm:py-3.5">
                    <td className="py-3.5 pr-3 align-top font-bold sm:border-b sm:border-[#f1ebe4] max-sm:p-0 max-sm:text-base">{sp.name}</td>
                    <td className="px-3 py-3.5 align-top text-[#3a322d] sm:border-b sm:border-[#f1ebe4] max-sm:p-0 max-sm:text-sm max-sm:text-[#5c524b]">
                      {sp.purpose[lang]}
                    </td>
                    <td className="py-3.5 pl-3 align-top sm:border-b sm:border-[#f1ebe4] max-sm:p-0 max-sm:pt-1">
                      <span className="inline-flex rounded-full bg-[#f6f1eb] px-2.5 py-0.5 text-xs text-[#4a413b] sm:text-[13px]">
                        {sp.location[lang]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 grid gap-3.5 sm:grid-cols-2">
              {hasOperator && (
                <div className="rounded-[14px] border border-[#efe7de] px-[18px] py-4 text-sm leading-normal text-[#4a413b]">
                  <div className={`${label} mb-1.5`}>{copy.subOperator}</div>
                  {operator!.legalName && <div className="font-semibold text-gray-900">{operator!.legalName}</div>}
                  {operator!.address && <div className="whitespace-pre-line">{operator!.address}</div>}
                  {operator!.email && (
                    <a href={`mailto:${operator!.email}`} className="font-semibold text-gray-900 underline underline-offset-[3px]">
                      {operator!.email}
                    </a>
                  )}
                  {data.euRepresentative && (
                    <div className="mt-3">
                      <div className={`${label} mb-1`}>{copy.subEuRep}</div>
                      <div>{data.euRepresentative.name}</div>
                      <div className="whitespace-pre-line">{data.euRepresentative.address}</div>
                    </div>
                  )}
                </div>
              )}
              <div className="rounded-[14px] border border-[#efe7de] px-[18px] py-4 text-sm leading-normal text-[#4a413b]">
                <div className={`${label} mb-1.5`}>{copy.subDpa}</div>
                <div>{copy.subDpaVersion(data.currentDpaVersion)}</div>
                {data.currentDpaIsDraft && (
                  <div className="mt-2 flex items-start gap-2 text-[13px] text-[#5c3c00]">
                    <Info className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                    {copy.subDraft}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default SubProcessorsPage;
