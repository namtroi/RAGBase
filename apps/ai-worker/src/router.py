# apps/ai-worker/src/router.py
"""Format routing: maps file formats to converters and categories."""

from typing import Dict, Type

from .converters import (
    CsvConverter,
    EpubConverter,
    FormatConverter,
    HtmlConverter,
    JsonConverter,
    PdfConverter,
    PptxConverter,
    TextConverter,
    XlsxConverter,
)

# Format → Converter class mapping
FORMAT_CONVERTERS: Dict[str, Type[FormatConverter]] = {
    "pdf": PdfConverter,
    "docx": PdfConverter,  # Docling handles both
    "txt": TextConverter,
    "md": TextConverter,
    "json": JsonConverter,
    "csv": CsvConverter,
    "html": HtmlConverter,
    "xlsx": XlsxConverter,
    "epub": EpubConverter,
    "pptx": PptxConverter,
}

# Format → Category mapping
FORMAT_CATEGORIES: Dict[str, str] = {
    "pdf": "document",
    "docx": "document",
    "txt": "document",
    "md": "document",
    "html": "document",
    "epub": "document",
    "json": "document",  # Treat JSON as document, not tabular
    "pptx": "presentation",
    "xlsx": "tabular",
    "csv": "tabular",
}


def get_converter(file_format: str) -> FormatConverter:
    """
    Get converter instance for a file format.

    Args:
        file_format: File format (e.g., "pdf", "csv", "html")

    Returns:
        FormatConverter instance

    Raises:
        ValueError: If format is not supported
    """
    file_format = file_format.lower()
    converter_cls = FORMAT_CONVERTERS.get(file_format)

    if converter_cls is None:
        raise ValueError(f"Unsupported format: {file_format}")

    return converter_cls()


def get_category(file_format: str) -> str:
    """
    Get format category for a file format.

    Args:
        file_format: File format (e.g., "pdf", "csv", "html")

    Returns:
        Category string ("document", "presentation", "tabular")
    """
    return FORMAT_CATEGORIES.get(file_format.lower(), "document")


def is_supported_format(file_format: str) -> bool:
    """Check if a format is supported."""
    return file_format.lower() in FORMAT_CONVERTERS
