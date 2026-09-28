from typing import List
from backend.app.config import settings

class EmbeddingService:
    def __init__(self, model_name: str = None, dimension: int = None):
        self.model_name = model_name or settings.EMBEDDING_MODEL
        self.dimension = dimension or settings.VECTOR_DIMENSION
        self._model = None

    def _get_model(self):
        if self._model is None:
            try:
                from fastembed import TextEmbedding
                # FastEmbed runs via ONNX Runtime on CPU locally, no heavy PyTorch required
                self._model = TextEmbedding(model_name=self.model_name)
            except Exception as e:
                raise RuntimeError(
                    f"Failed to initialize fastembed model '{self.model_name}': {e}. "
                    f"Ensure 'fastembed' is installed in the Python environment."
                )
        return self._model

    def embed_text(self, text: str) -> List[float]:
        """
        Generates a normalized embedding vector for a single query text.
        """
        model = self._get_model()
        # embed returns a generator of numpy arrays
        embeddings = list(model.embed([text]))
        if not embeddings:
            return [0.0] * self.dimension
        return embeddings[0].tolist()

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        Generates normalized embedding vectors for a batch of document texts.
        """
        if not texts:
            return []
        model = self._get_model()
        embeddings = list(model.embed(texts))
        return [vec.tolist() for vec in embeddings]

embedding_service = EmbeddingService()
