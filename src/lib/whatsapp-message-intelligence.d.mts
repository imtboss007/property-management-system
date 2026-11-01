export type WhatsAppCommitmentExtraction = {
  description: string;
  amount: string;
  promisedDate: string;
  promisedTime: string;
  responseType: "WhatsApp";
};
export function extractWhatsAppCommitment(message: string, today?: string): WhatsAppCommitmentExtraction;
