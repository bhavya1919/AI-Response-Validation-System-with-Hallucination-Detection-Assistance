import re
from typing import Any, Dict, List
from backend.app.config import settings

class ChunkingService:
    def __init__(self, chunk_size: int = None, chunk_overlap: int = None):
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    def split_text(self, text: str) -> List[str]:
        """
        Splits text into chunks respecting sentence and paragraph boundaries where possible.
        """
        cleaned = text.strip()
        if not cleaned:
            return []
        
        if len(cleaned) <= self.chunk_size:
            return [cleaned]

        chunks = []
        start = 0
        text_len = len(cleaned)

        while start < text_len:
            end = min(start + self.chunk_size, text_len)

            # If we're not at the very end of text, try to find a natural boundary
            if end < text_len:
                # Look backwards for a paragraph, newline, or sentence end
                boundary = -1
                for punct in ["\n\n", "\n", ". ", "? ", "! ", "; "]:
                    idx = cleaned.rfind(punct, start + self.chunk_overlap, end)
                    if idx != -1:
                        boundary = idx + len(punct)
                        break
                
                if boundary != -1 and boundary > start:
                    end = boundary

            chunk = cleaned[start:end].strip()
            if chunk:
                chunks.append(chunk)

            if end >= text_len:
                break
            
            # Slide window with overlap
            start = max(end - self.chunk_overlap, start + 1)

        return chunks

    def create_chunks_for_document(
        self,
        document_id: str,
        content: str,
        source_name: str,
        dataset_name: str,
        extra_metadata: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """
        Takes document text, chunks it, and attaches standard metadata for indexing.
        """
        raw_chunks = self.split_text(content)
        chunk_objects = []

        base_meta = extra_metadata.copy() if extra_metadata else {}
        base_meta.update({
            "source": source_name,
            "dataset": dataset_name,
            "document_id": document_id
        })

        for idx, text in enumerate(raw_chunks):
            meta = base_meta.copy()
            meta["chunk_index"] = idx
            meta["character_length"] = len(text)
            
            chunk_objects.append({
                "chunk_index": idx,
                "content": text,
                "metadata": meta
            })

        return chunk_objects

chunking_service = ChunkingService()
