# apps/ai-worker/src/chunkers/presentation_chunker.py
"""
Presentation chunker that splits by slide markers.
Groups small slides to maintain context.
"""

from typing import Any, Dict, List


class PresentationChunker:
    """
    Split presentation content by slide markers.
    Groups small slides together to avoid tiny fragments.
    """

    def __init__(self, min_chunk_size: int = 200):
        self.min_chunk_size = min_chunk_size
        self.marker = "<!-- slide -->"

    def chunk(self, text: str) -> List[Dict[str, Any]]:
        """
        Split content by slide markers and group small slides.
        """
        if not text or not text.strip():
            return []

        # Split by marker
        raw_slides = text.split(self.marker)

        final_chunks = []
        current_accumulation = []
        current_indices = []
        cumulative_pos = 0  # Track position for charStart/charEnd

        for i, slide_content in enumerate(raw_slides):
            slide_nr = i + 1
            content = slide_content.strip()

            # Skip empty slides (effectively ignoring them)
            if not content:
                continue

            current_accumulation.append(content)
            current_indices.append(slide_nr)

            total_size = sum(len(s) for s in current_accumulation)

            # If we met the minimum size or this is the last slide, emit a chunk
            if total_size >= self.min_chunk_size or i == len(raw_slides) - 1:
                chunk = self._create_chunk(
                    current_accumulation, current_indices, cumulative_pos
                )
                cumulative_pos = chunk["metadata"]["charEnd"]
                final_chunks.append(chunk)
                current_accumulation = []
                current_indices = []

        # If anything is left over (e.g. the last slide was empty but we had an accumulation)
        if current_accumulation:
            chunk = self._create_chunk(
                current_accumulation, current_indices, cumulative_pos
            )
            final_chunks.append(chunk)

        return final_chunks

    def _create_chunk(
        self, contents: List[str], indices: List[int], char_start: int
    ) -> Dict[str, Any]:
        """Helper to format a chunk."""
        # Join slides with extra newline for clarity
        combined_content = "\n\n".join(contents)

        metadata = {
            "location": {
                "slide_number": indices[0] if len(indices) == 1 else None,
                "slide_numbers": indices if len(indices) > 1 else [indices[0]],
            },
            "type": "presentation",
            "charStart": char_start,
            "charEnd": char_start + len(combined_content),
        }

        # Backward compatibility for tests expecting slide_number even if grouped
        if len(indices) > 1:
            metadata["location"]["slide_number"] = indices[0]

        return {"content": combined_content, "metadata": metadata}
