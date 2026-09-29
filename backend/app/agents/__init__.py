"""
VeriAI Multi-Agent Evaluation Pipeline
Milestone 2 / Milestone 3 Compliance Architecture:
  RetrieverAgent → [RelevanceJudgeAgent, AccuracyAgent, HallucinationAgent,
                    CompletenessJudgeAgent] → VerdictAgent
"""
from backend.app.agents.retriever import RetrieverAgent, EvidenceChunk, RetrieverResult
from backend.app.agents.relevance import RelevanceJudgeAgent, RelevanceResult
from backend.app.agents.accuracy import AccuracyAgent, AccuracyResult, ClaimResult
from backend.app.agents.hallucination import HallucinationAgent, HallucinationResult, FlaggedClaim
from backend.app.agents.completeness import CompletenessJudgeAgent, CompletenessResult
from backend.app.agents.verdict import VerdictAgent, VerdictResult, Reason

__all__ = [
    "RetrieverAgent",
    "EvidenceChunk",
    "RetrieverResult",
    "RelevanceJudgeAgent",
    "RelevanceResult",
    "AccuracyAgent",
    "AccuracyResult",
    "ClaimResult",
    "HallucinationAgent",
    "HallucinationResult",
    "FlaggedClaim",
    "CompletenessJudgeAgent",
    "CompletenessResult",
    "VerdictAgent",
    "VerdictResult",
    "Reason",
]
