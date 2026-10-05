import { Injectable, HttpException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import AdmZip from 'adm-zip';
import { extname } from 'node:path';

export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
export const RESUME_MAX_TEXT = 30000;
export type ResumeFile = Pick<
  Express.Multer.File,
  'originalname' | 'mimetype' | 'size' | 'buffer'
>;
function fail(message: string, status = 422): never {
  throw new HttpException(message, status);
}
@Injectable()
export class ResumeExtractionService {
  async extract(
    file?: ResumeFile,
  ): Promise<{ text: string; format: 'pdf' | 'docx'; sizeBytes: number }> {
    if (!file) fail('Choose a PDF or DOCX resume.', 400);
    if (file.size > RESUME_MAX_BYTES || file.buffer.length > RESUME_MAX_BYTES)
      fail('Resume must be at most 5 MB.', 413);
    const extension = extname(file.originalname).toLowerCase();
    const format =
      extension === '.pdf' ? 'pdf' : extension === '.docx' ? 'docx' : null;
    const expectedMime =
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!format || file.mimetype !== expectedMime)
      fail('Only PDF and DOCX resumes are supported.', 415);
    if (
      (format === 'pdf' && file.buffer.subarray(0, 5).toString() !== '%PDF-') ||
      (format === 'docx' &&
        !file.buffer
          .subarray(0, 4)
          .equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])))
    )
      fail('The document contents do not match its file type.', 415);
    let raw: string;
    try {
      if (format === 'pdf') {
        const parser = new PDFParse({ data: file.buffer });
        try {
          const info = await parser.getInfo();
          if (info.total > 50)
            fail('Resume PDFs must contain at most 50 pages.');
          raw = (await parser.getText({ pageJoiner: '\n' })).text;
        } finally {
          await parser.destroy();
        }
      } else {
        // Inspect central-directory sizes before Mammoth decompresses the archive.
        const entries = new AdmZip(file.buffer).getEntries();
        if (
          entries.length > 1000 ||
          entries.reduce((n, e) => n + e.header.size, 0) > 20 * 1024 * 1024 ||
          !entries.some((e) => e.entryName === 'word/document.xml') ||
          !entries.some((e) => e.entryName === '[Content_Types].xml') ||
          entries.some(
            (e) =>
              e.entryName.includes('..') ||
              /vbaProject|\.bin$/i.test(e.entryName),
          )
        )
          fail('This DOCX document is unsupported or too complex.');
        raw = (await mammoth.extractRawText({ buffer: file.buffer })).value;
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      fail(
        'Could not extract this document. Upload a readable, unencrypted PDF or DOCX.',
      );
    }
    const text = raw
      .normalize('NFKC')
      // Strip document control characters while preserving line breaks.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    // pdf-parse adds page separator labels; they are not readable resume content.
    if (text.replace(/--\s*\d+\s*of\s*\d+\s*--/g, '').trim().length < 20)
      fail(
        'No readable resume text found. Scanned/image-only PDFs are not supported.',
      );
    if (text.length > RESUME_MAX_TEXT)
      fail(
        'Extracted resume text exceeds 30,000 characters. Upload a shorter resume.',
      );
    return { text, format, sizeBytes: file.size };
  }
}
