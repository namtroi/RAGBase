# apps/ai-worker/src/chunkers/document_chunker.py
"""
Document chunker based on Markdown header structure.
Preserves hierarchy via breadcrumbs.
"""

from typing import Any, Dict, List
from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)


class DocumentChunker:
    """
    Split Markdown documents by headers while maintaining hierarchy context.
    """

    # All supported header levels (H1-H6)
    ALL_HEADERS = [
        ("#", "Header 1"),
        ("##", "Header 2"),
        ("###", "Header 3"),
        ("####", "Header 4"),
        ("#####", "Header 5"),
        ("######", "Header 6"),
    ]

    def __init__(
        self, chunk_size: int = 1000, chunk_overlap: int = 100, header_levels: int = 3
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.header_levels = min(max(header_levels, 1), 6)  # Clamp to 1-6

        # Build headers_to_split_on based on configured levels
        headers_to_split_on = self.ALL_HEADERS[: self.header_levels]
        self.header_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=headers_to_split_on
        )
        self.recursive_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    def _create_chunk(
        self, content: str, breadcrumbs: List[str], index: int
    ) -> Dict[str, Any]:
        """Create a chunk dict with content and metadata."""
        return {
            "content": content,
            "metadata": {
                "breadcrumbs": breadcrumbs,
                "index": index,
            },
        }

    def chunk(self, text: str) -> List[Dict[str, Any]]:
        """
        Split Markdown text into chunks with breadcrumbs metadata.
        """
        if not text or not text.strip():
            return []

        # 1. Split by headers
        header_splits = self.header_splitter.split_text(text)

        final_chunks = []

        for split in header_splits:
            # Extract headers from metadata to build breadcrumbs
            breadcrumbs = []
            for i in range(1, self.header_levels + 1):
                key = f"Header {i}"
                if key in split.metadata:
                    breadcrumbs.append(split.metadata[key])

            # 2. Format breadcrumbs as a context header
            context_prefix = ""
            if breadcrumbs:
                context_prefix = "> " + " > ".join(breadcrumbs) + "\n\n"

            chunk_content = context_prefix + split.page_content

            # 3. Check if this split is too large
            if len(chunk_content) > self.chunk_size:
                # Sub-split large section recursively
                sub_chunks = self.recursive_splitter.split_text(split.page_content)
                for sub_text in sub_chunks:
                    content = context_prefix + sub_text
                    final_chunks.append(
                        self._create_chunk(content, breadcrumbs, len(final_chunks))
                    )
            else:
                final_chunks.append(
                    self._create_chunk(chunk_content, breadcrumbs, len(final_chunks))
                )

        return final_chunks
