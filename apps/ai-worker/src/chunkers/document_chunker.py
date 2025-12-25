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

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

        # Split by H1, H2, H3
        headers_to_split_on = [
            ("#", "Header 1"),
            ("##", "Header 2"),
            ("###", "Header 3"),
        ]
        self.header_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=headers_to_split_on
        )
        self.recursive_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    def chunk(self, text: str) -> List[Dict[str, Any]]:
        """
        Split Markdown text into chunks with breadcrumbs metadata.
        """
        if not text or not text.strip():
            return []

        # 1. Split by headers
        header_splits = self.header_splitter.split_text(text)

        final_chunks = []
        for i, split in enumerate(header_splits):
            # Extract headers from metadata to build breadcrumbs
            # MarkdownHeaderTextSplitter returns metadata like {"Header 1": "Title", ...}
            breadcrumbs = []
            if "Header 1" in split.metadata:
                breadcrumbs.append(split.metadata["Header 1"])
            if "Header 2" in split.metadata:
                breadcrumbs.append(split.metadata["Header 2"])
            if "Header 3" in split.metadata:
                breadcrumbs.append(split.metadata["Header 3"])

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
                    final_chunks.append(
                        {
                            "content": context_prefix + sub_text,
                            "metadata": {
                                "breadcrumbs": breadcrumbs,
                                "index": len(final_chunks),
                            },
                        }
                    )
            else:
                final_chunks.append(
                    {
                        "content": chunk_content,
                        "metadata": {
                            "breadcrumbs": breadcrumbs,
                            "index": len(final_chunks),
                        },
                    }
                )
        return final_chunks
