declare module "pdf-parse" {
  interface PdfInfo {
    Title?: string;
    [key: string]: unknown;
  }

  interface PdfResult {
    numpages: number;
    numrender: number;
    info?: PdfInfo;
    metadata?: unknown;
    text: string;
    version?: string;
  }

  export default function pdfParse(dataBuffer: Buffer): Promise<PdfResult>;
}
