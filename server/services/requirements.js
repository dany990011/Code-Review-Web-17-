const fs = require('fs/promises');
const path = require('path');
const { PDFParse } = require('pdf-parse');

async function extractPdfText(filePath) {
  const data = await fs.readFile(filePath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return (result.text || '').trim();
  } finally {
    await parser.destroy();
  }
}

async function extractRequirementsText(filePath, originalName = '') {
  const ext = path.extname(originalName || filePath).toLowerCase();

  if (ext === '.pdf') {
    const text = await extractPdfText(filePath);
    if (!text) {
      throw new Error('Could not extract text from this PDF. Please upload a text-based PDF, TXT, or MD file.');
    }
    return text;
  }

  return fs.readFile(filePath, 'utf8');
}

module.exports = { extractRequirementsText };
