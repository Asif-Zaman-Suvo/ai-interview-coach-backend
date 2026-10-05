import AdmZip from 'adm-zip';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ResumeExtractionService,
  RESUME_MAX_BYTES,
} from './resume-extraction.service';
const load = (name: string, mime: string) => {
  const buffer = readFileSync(join(__dirname, '../../test/fixtures', name));
  return { originalname: name, mimetype: mime, size: buffer.length, buffer };
};
describe('resume extraction', () => {
  const service = new ResumeExtractionService();
  it('extracts actual PDF text', async () => {
    const result = await service.extract(load('resume.pdf', 'application/pdf'));
    expect(result.text).toContain('Frontend Engineer');
    expect(result.format).toBe('pdf');
  });
  it('extracts actual DOCX text', async () => {
    const result = await service.extract(
      load(
        'resume.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    );
    expect(result.text).toContain('React, TypeScript');
    expect(result.format).toBe('docx');
  });
  it('rejects legacy DOC and extension/MIME mismatches', async () => {
    await expect(
      service.extract({
        ...load('resume.pdf', 'application/pdf'),
        originalname: 'resume.doc',
      }),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      service.extract(load('resume.pdf', 'application/msword')),
    ).rejects.toMatchObject({ status: 415 });
  });
  it('rejects disguised binary types', async () => {
    await expect(
      service.extract({
        ...load('resume.pdf', 'application/pdf'),
        buffer: Buffer.from('not PDF'),
      }),
    ).rejects.toMatchObject({ status: 415 });
  });
  it('rejects oversized files', async () => {
    await expect(
      service.extract({
        ...load('resume.pdf', 'application/pdf'),
        size: RESUME_MAX_BYTES + 1,
      }),
    ).rejects.toMatchObject({ status: 413 });
  });
  it('rejects empty/image-only PDF', async () => {
    await expect(
      service.extract(load('empty.pdf', 'application/pdf')),
    ).rejects.toThrow('No readable resume text');
  });
  it('rejects excessive extracted DOCX text', async () => {
    const file = load(
      'resume.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    const zip = new AdmZip(file.buffer);
    zip.addFile(
      'word/document.xml',
      Buffer.from(
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' +
          'x'.repeat(30001) +
          '</w:t></w:r></w:p></w:body></w:document>',
      ),
    );
    const buffer = zip.toBuffer();
    await expect(
      service.extract({ ...file, buffer, size: buffer.length }),
    ).rejects.toThrow('30,000 characters');
  });
  it('handles broken PDFs safely', async () => {
    await expect(
      service.extract({
        originalname: 'broken.pdf',
        mimetype: 'application/pdf',
        size: 10,
        buffer: Buffer.from('%PDF-broken'),
      }),
    ).rejects.toThrow('Could not extract');
  });
});
