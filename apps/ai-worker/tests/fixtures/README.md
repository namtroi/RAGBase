# Fixtures Directory

This directory contains test fixtures for the AI Worker tests.

## Files

- `sample.pdf` - A sample PDF file for integration testing (to be added)

## Usage

To add test fixtures:

1. Place PDF files in this directory
2. Use the `fixtures_dir` and `sample_pdf_path` fixtures from `conftest.py`

## Notes

- Keep fixture files small (< 1MB recommended)
- Include a variety of PDF types for comprehensive testing:
  - Text PDFs
  - Scanned PDFs (for OCR testing)
  - Multi-page PDFs
  - PDFs with tables and images
