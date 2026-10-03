/**
 * Contratos y tipos para la capa de generación y almacenamiento de PDFs
 * Fuente: PDFS.md y DATA_MODEL.md (Sección 58)
 */

import type { DocumentType, RendererType, GenerationStatus } from '@/database/types';

export interface DocumentPayloadSnapshot {
  documentType: DocumentType;
  sourceId: string;
  sourceCode: string;
  generatedDate: string;
  data: Record<string, unknown>;
}

export interface GeneratedDocumentResult {
  id: string;
  documentType: DocumentType;
  sourceType: string;
  sourceId: string;
  rendererType: RendererType;
  templateKey: string;
  templateVersion: string;
  generationStatus: GenerationStatus;
  fileReference?: string | null;
  fileSizeBytes?: number | null;
  errorMessage?: string | null;
}

export interface IPdfGenerator {
  generateDocument(payload: DocumentPayloadSnapshot): Promise<GeneratedDocumentResult>;
}

export interface IPdfStorageService {
  uploadPdf(documentId: string, pdfBuffer: Uint8Array): Promise<string>;
  getDownloadUrl(fileReference: string): Promise<string>;
}
