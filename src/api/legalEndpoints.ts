// Hand-written endpoints for the legal pack. Kept out of endpoints.ts because
// that file is generated; shapes mirror the backend's src/application/legal/dtos.ts.
import { api } from './endpoints';

export type LegalLanguage = 'de' | 'en';

export interface LegalTextDto {
  text: string;
  revision: number;
  updatedAt: string;
}

export interface ImpressumLine {
  label: string;
  value: string;
}

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface PrivacyNotice {
  templateVersion: string;
  isDraft: boolean;
  sections: LegalSection[];
}

export interface PublicLegalPackDto {
  slug: string;
  shopName: string;
  language: LegalLanguage;
  impressum: { lines: ImpressumLine[] } | null;
  terms: LegalTextDto | null;
  withdrawal: LegalTextDto | null;
  privacyNotice: PrivacyNotice | null;
  seller: { legalName: string; phone: string | null };
  platform: { name: string; salesSiteUrl: string | null };
}

export interface SubProcessor {
  id: 'azure' | 'entra' | 'acs';
  name: string;
  purpose: Record<LegalLanguage, string>;
  location: Record<LegalLanguage, string>;
}

export interface PlatformLegalPublicDto {
  platformName: string;
  salesSiteUrl: string | null;
  operator: { legalName: string; address: string; email: string };
  euRepresentative: { name: string; address: string; email: string } | null;
  subProcessors: SubProcessor[];
  currentDpaVersion: string;
  currentDpaIsDraft: boolean;
}

export const legalApi = api.injectEndpoints({
  endpoints: (b) => ({
    getShopLegal: b.query<PublicLegalPackDto, { slug: string; lang: string }>({
      query: ({ slug, lang }) => ({ url: `/shops/slug/${slug}/legal`, params: { lang } }),
    }),
    getPlatformLegal: b.query<PlatformLegalPublicDto, void>({
      query: () => ({ url: '/legal/platform' }),
    }),
  }),
});

export const { useGetShopLegalQuery, useGetPlatformLegalQuery } = legalApi;
