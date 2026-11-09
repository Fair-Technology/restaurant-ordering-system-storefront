// Hand-written legal-pack types; the endpoints are generated in endpoints.ts.
// Shapes mirror the backend's src/application/legal/dtos.ts.
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

// The endpoints are generated (endpoints.ts). The diner-facing legal pack is
// `getPublicLegalPack` (GET /shops/slug/{slug}/legal). Do NOT use the generated
// `getShopLegal` — that is the owner-only GET /shops/{shopId}/legal.
export const { useGetPublicLegalPackQuery, useGetPlatformLegalQuery } = api;
