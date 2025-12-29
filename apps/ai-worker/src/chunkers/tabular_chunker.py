# apps/ai-worker/src/chunkers/tabular_chunker.py

from typing import Any, Dict, List


class TabularChunker:
    """
    Split tabular content by rows or maintain as single chunks for small tables.
    """

    def __init__(self, rows_per_chunk: int = 20):
        self.rows_per_chunk = rows_per_chunk

    def chunk(self, text: str) -> List[Dict[str, Any]]:
        if not text or not text.strip():
            return []

        # 1. Split by --- (multiple sheets)
        delimiter = "\n\n---\n\n"
        if delimiter in text:
            sections = [s.strip() for s in text.split(delimiter) if s.strip()]
        else:
            sections = [text.strip()]

        final_chunks = []

        for section in sections:
            # 2. Extract breadcrumbs (Sheet Name from H1)
            lines = section.split("\n")
            breadcrumbs = []
            content_start_idx = 0

            # Check if first line is a H1 Header (Sheet Name)
            if lines and lines[0].startswith("# "):
                sheet_name = lines[0][2:].strip()
                breadcrumbs.append(sheet_name)
                content_start_idx = 1

            # Clean content (exclude the extracted header line)
            content_lines = lines[content_start_idx:]
            content_text = "\n".join(content_lines).strip()

            if not content_text:
                continue

            # 3. Determine Format Strategy
            # Check for Markdown Table syntax (| col | col | + separator |---|)
            is_markdown_table = (
                "|" in content_text
                and "\n|-" in content_text
                and content_text.count("|") > 2
            )

            if is_markdown_table:
                # STRATEGY A: Markdown Table -> Keep as single chunk
                final_chunks.append(
                    {
                        "content": section,  # Keep full context (Heading + Table)
                        "metadata": {
                            "breadcrumbs": breadcrumbs,
                            "chunk_type": "tabular",
                            "index": len(final_chunks),
                        },
                    }
                )
            else:
                # STRATEGY B: Sentence Format -> Split by rows
                # Assumes rows are separated by double newlines (from converter)
                rows = [r.strip() for r in content_text.split("\n\n") if r.strip()]

                if not rows:
                    continue

                # Batch rows into chunks
                for i in range(0, len(rows), self.rows_per_chunk):
                    batch = rows[i : i + self.rows_per_chunk]
                    batch_text = "\n\n".join(batch)

                    if breadcrumbs:
                        header_line = f"# {breadcrumbs[0]}"
                        chunk_display_text = f"{header_line}\n\n{batch_text}"
                    else:
                        chunk_display_text = batch_text

                    final_chunks.append(
                        {
                            "content": chunk_display_text,
                            "metadata": {
                                "breadcrumbs": breadcrumbs,
                                "chunk_type": "tabular",
                                "index": len(final_chunks),
                            },
                        }
                    )

        return final_chunks
