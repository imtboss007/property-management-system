export type IntelligenceReportRow = {
  title: string;
  module: string;
  location?: string;
  value?: string;
  srRate?: string;
  marketRate?: string;
  settlementValue?: string;
  area?: string;
  primaryContact?: string;
  followUpContact?: string;
  primaryGroup?: string;
  followUpGroup?: string;
  contactSummary?: string;
  followUpSummary?: string;
};
export function downloadIntelligencePdf(title: string, subtitle: string, rows: IntelligenceReportRow[]): void;
export function downloadIntelligencePptx(title: string, subtitle: string, rows: IntelligenceReportRow[]): void;
