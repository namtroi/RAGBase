# apps/ai-worker/src/chunkers/tabular_chunker.py
"""
Tabular chunker optimized for CSV/XLSX output.
Handles Markdown tables and row-based sentence format.
"""

from typing import Any, Dict, List


class TabularChunker:
    """
    Split tabular content by rows or maintain as single chunks for small tables.
    """

    def __init__(self, rows_per_chunk: int = 20):
        self.rows_per_chunk = rows_per_chunk

    def chunk(self, text: str) -> List[Dict[str, Any]]:
        """
        Split tabular Markdown into chunks.
        """
        if not text or not text.strip():
            return []

        # 1. Split by --- (multiple sheets)
        sections = [s.strip() for s in text.split("\n\n---\n\n") if s.strip()]
        if not sections and "---" in text:
            sections = [s.strip() for s in text.split("---") if s.strip()]

        if not sections:
            sections = [text.strip()]

        final_chunks = []
        cumulative_pos = 0  # Track position for charStart/charEnd

        for section in sections:
            # 2. Extract breadcrumbs (Sheet Name)
            lines = section.split("\n")
            breadcrumbs = []
            content_start_idx = 0

            if lines[0].startswith("# "):
                breadcrumbs.append(lines[0][2:].strip())
                content_start_idx = 1

            # Clean content (remaining lines)
            content_lines = lines[content_start_idx:]
            content_text = "\n".join(content_lines).strip()
            if not content_text:
                continue

            # 3. Determine Format
            if (
                "|" in content_text
                and "---" in content_text
                and content_text.count("|") > 2
            ):
                # Markdown Table: Keep together as one chunk
                final_chunks.append(
                    {
                        "content": section,
                        "metadata": {
                            "breadcrumbs": breadcrumbs,
                            "chunk_type": "tabular",
                            "index": len(final_chunks),
                            "charStart": cumulative_pos,
                            "charEnd": cumulative_pos + len(section),
                        },
                    }
                )
                cumulative_pos += len(section)
            else:
                # Sentence Format: Split by rows
                # Rows are separated by \n\n
                rows = [r.strip() for r in content_text.split("\n\n") if r.strip()]

                if not rows:
                    # Fallback if split failed or unexpected format
                    final_chunks.append(
                        {
                            "content": section,
                            "metadata": {
                                "breadcrumbs": breadcrumbs,
                                "chunk_type": "tabular",
                                "index": len(final_chunks),
                                "charStart": cumulative_pos,
                                "charEnd": cumulative_pos + len(section),
                            },
                        }
                    )
                    cumulative_pos += len(section)
                    continue

                # Batch rows into chunks
                for i in range(0, len(rows), self.rows_per_chunk):
                    batch = rows[i : i + self.rows_per_chunk]
                    batch_text = "\n\n".join(batch)

                    # Prepend title for context if not the first chunk
                    chunk_display_text = (
                        section.split("\n")[0] + "\n\n" + batch_text
                        if breadcrumbs
                        else batch_text
                    )

                    final_chunks.append(
                        {
                            "content": chunk_display_text,
                            "metadata": {
                                "breadcrumbs": breadcrumbs,
                                "chunk_type": "tabular",
                                "index": len(final_chunks),
                                "charStart": cumulative_pos,
                                "charEnd": cumulative_pos + len(chunk_display_text),
                            },
                        }
                    )
                    cumulative_pos += len(chunk_display_text)

        return final_chunks
