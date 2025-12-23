from typing import Any, Dict, List

import structlog
from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.config import settings

logger = structlog.get_logger()


class Chunker:
    def __init__(self, chunk_size: int = None, chunk_overlap: int = None):
        self.chunk_size = chunk_size or settings.chunk_size
        self.chunk_overlap = chunk_overlap or settings.chunk_overlap

        # We use RecursiveCharacterTextSplitter for generic markdown/text chunking
        # It handles code blocks, paragraphs, etc better than simple split
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            separators=["\n\n", "\n", " ", ""],
            length_function=len,
        )

    def chunk(self, text: str) -> List[Dict[str, Any]]:
        """
        Chunks text and returns structured data
        """
        if not text:
            return []

        try:
            lc_docs = self.splitter.create_documents([text])
            chunks = []

            # Since create_documents doesn't give absolute char positions easily relating to original text
            # nicely without some effort, we will approximate or calculate if needed.
            # But for simple RAG, content + metadata is usually enough.
            # However, our API spec demands charStart/charEnd.
            # We can find them by searching, but duplicates are tricky.
            # For now, let's implement a simple verify-scan logic to find positions.

            current_pos = 0
            for idx, doc in enumerate(lc_docs):
                content = doc.page_content
                # Find content in original text starting from current_pos
                start = text.find(content, current_pos)
                if start == -1:
                    # Fallback if normalization happened or something
                    start = current_pos

                end = start + len(content)
                current_pos = (
                    start + 1
                )  # Advance minimally to avoid overlap confusion if possible, but overlaps mean we might step back?
                # Actually recursive splitter repeats text. So 'start' of next chunk is BEFORE 'end' of this chunk.
                # So searching from 'current_pos' where current_pos matches approx expectation is better.
                # Let's simple search from 0 or heuristic.
                # Better: track position.

                chunks.append(
                    {
                        "content": content,
                        "index": idx,
                        "metadata": {
                            "charStart": start,
                            "charEnd": end,
                            # Heading can be extracted if we used MarkdownHeaderTextSplitter before this
                            # For now, simple implementation.
                        },
                    }
                )

            return chunks
        except Exception as e:
            logger.error("chunking_failed", error=str(e))
            raise e
