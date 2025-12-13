# PDF Fixtures

These PDF files will be created manually or using a PDF generation tool.
For now, we'll create placeholder files that can be replaced with real PDFs.

## Required PDFs:
1. simple-digital.pdf - 1 page, text only
2. multi-page.pdf - 5 pages
3. password-protected.pdf - Should reject
4. scanned-image.pdf - Needs OCR
5. corrupt.pdf - Invalid file

## Note:
Real PDF files should be added before running integration tests.
For unit tests, we can mock the file reading and processing.
