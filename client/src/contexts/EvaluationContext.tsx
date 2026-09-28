import React, { createContext, useContext, useState } from "react";
import {
  evaluateResponse,
  getEvaluation,
  type EvidenceItem,
  type EvaluationRecord,
  type ClaimItem,
} from "@/services/api";

export type { ClaimItem, EvaluationRecord };

export const PRESET_EVALUATIONS: Record<string, EvaluationRecord> = {
  photosynthesis: {
    id: "eval-01",
    title: "Photosynthesis (Pass)",
    question: "What is photosynthesis and how do plants store energy?",
    aiResponse:
      "Photosynthesis is the process by which green plants convert light energy into chemical energy stored as glucose. Chlorophyll absorbs sunlight to synthesize organic molecules from carbon dioxide and water.",
    referenceAnswer:
      "Photosynthesis is the biological process where light energy is transformed into chemical energy stored in carbohydrates like glucose, utilizing carbon dioxide and water.",
    overallScore: 91,
    verdict: "PASS",
    confidence: "high",
    scores: {
      relevance: 96,
      accuracy: 94,
      hallucinationRisk: 6,
      completeness: 86,
    },
    claims: [
      {
        id: "c1",
        claim: "Photosynthesis occurs in green plants.",
        status: "supported",
        evidenceText: "Photosynthesis is observed in plants, algae, and certain cyanobacteria.",
        source: "SQuAD 2.0 Biology Corpus",
        relevance: 98,
        note: "Directly verified against reference biology knowledge base.",
      },
      {
        id: "c2",
        claim: "Light energy is converted into chemical energy stored as glucose.",
        status: "supported",
        evidenceText: "Light reactions generate ATP and NADPH, which power glucose synthesis in the Calvin cycle.",
        source: "NCBI Science Reference",
        relevance: 95,
        note: "Strong corroboration across primary reference passages.",
      },
      {
        id: "c3",
        claim: "Chlorophyll absorbs sunlight to synthesize organic molecules.",
        status: "supported",
        evidenceText: "Chlorophyll pigment absorbs light in the blue and red portions of the electromagnetic spectrum.",
        source: "OpenStax Biology v2",
        relevance: 91,
        note: "Accurate description of light harvesting mechanism.",
      },
      {
        id: "c4",
        claim: "Synthesis consumes carbon dioxide and water.",
        status: "partial",
        evidenceText: "Water is oxidized releasing oxygen, while CO2 is fixed into 3-phosphoglycerate.",
        source: "General Plant Biochemistry",
        relevance: 84,
        note: "Valid claim, but response omits the oxygen byproduct detail.",
      },
    ],
    reasons: [
      { text: "Directly and thoroughly answers the core question", positive: true },
      { text: "All core scientific claims are supported by verified evidence", positive: true },
      { text: "Zero critical or unsupported statements detected", positive: true },
      { text: "Minor completeness omission: oxygen generation byproduct", positive: false },
    ],
    evaluatedAt: "Just now",
    relevance: {
      score: 96,
      label: "fully_relevant",
      label_display: "Fully Relevant",
      reasoning: "The response directly and comprehensively explains the biological mechanism of photosynthesis and cellular energy storage.",
      signals: {
        semantic_similarity: 0.94,
        keyword_coverage: 1.0,
        topic_alignment: "high",
        matched_concepts: ["photosynthesis", "plants", "store", "energy"],
        missing_concepts: [],
      },
    },
    accuracy: {
      score: 94,
      status: "Verified Correct",
      reasoning: "High accuracy score (94/100). All factual claims are corroborated by biology reference ground truth with strong semantic corroboration.",
      supported_count: 3,
      partial_count: 1,
      unsupported_count: 0,
      contradicted_count: 0,
      claims: [
        { claim: "Photosynthesis occurs in green plants.", status: "SUPPORTED", similarity: 0.98, evidence: "Photosynthesis is observed in plants, algae, and certain cyanobacteria." },
        { claim: "Light energy is converted into chemical energy stored as glucose.", status: "SUPPORTED", similarity: 0.95, evidence: "Light reactions generate ATP and NADPH, which power glucose synthesis." },
        { claim: "Chlorophyll absorbs sunlight to synthesize organic molecules.", status: "SUPPORTED", similarity: 0.91, evidence: "Chlorophyll pigment absorbs light in the blue and red portions of spectrum." },
        { claim: "Synthesis consumes carbon dioxide and water.", status: "PARTIAL", similarity: 0.84, evidence: "Water is oxidized releasing oxygen, while CO2 is fixed into carbohydrates." },
      ],
    },
    hallucination: {
      risk_score: 6,
      status: "low",
      reasoning: "Low hallucination risk (6%). All 4 factual claims align with verified botanical science without any fabricated assertions.",
      flagged_claims: [],
    },
    completeness: {
      score: 86,
      reasoning: "The response comprehensively addresses 86% of the core question inquiry scope, with minor omission of the oxygen gas release byproduct.",
      covered_aspects: ["photosynthesis", "glucose", "chlorophyll", "plants"],
      missing_aspects: ["oxygen byproduct"],
    },
    verdict_detail: {
      overall_score: 91,
      label: "PASS",
      reasoning: "The response is directly relevant and factually accurate, with all key claims strongly supported by verified evidence, resulting in low hallucination risk (6%). Final verdict is PASS with an overall score of 91/100 (high confidence).",
    },
  },
  penicillin: {
    id: "eval-02",
    title: "Penicillin Discovery (Review)",
    question: "Who discovered penicillin and who won the Nobel Prize for it?",
    aiResponse:
      "Alexander Fleming discovered penicillin in 1928 at St. Mary's Hospital. He was the sole recipient of the 1945 Nobel Prize in Medicine for developing mass production techniques.",
    referenceAnswer:
      "Alexander Fleming discovered penicillin in September 1928. The 1945 Nobel Prize in Physiology or Medicine was awarded jointly to Alexander Fleming, Ernst Boris Chain, and Howard Florey.",
    overallScore: 68,
    verdict: "REVIEW",
    confidence: "medium",
    scores: {
      relevance: 89,
      accuracy: 64,
      hallucinationRisk: 32,
      completeness: 72,
    },
    claims: [
      {
        id: "p1",
        claim: "Alexander Fleming discovered penicillin in 1928 at St. Mary's Hospital.",
        status: "supported",
        evidenceText: "Fleming observed the antibacterial properties of Penicillium notatum in September 1928 at St. Mary's Hospital, London.",
        source: "Nobel Prize Official Archives",
        relevance: 99,
        note: "Factual statement corroborated by historical records.",
      },
      {
        id: "p2",
        claim: "Fleming was the sole recipient of the 1945 Nobel Prize.",
        status: "unsupported",
        evidenceText: "The 1945 Nobel Prize was shared between Alexander Fleming, Ernst Chain, and Howard Florey.",
        source: "Nobel Prize in Physiology or Medicine 1945 Citation",
        relevance: 97,
        note: "Factually incorrect: Florey and Chain shared the prize.",
      },
      {
        id: "p3",
        claim: "Fleming developed mass production techniques.",
        status: "partial",
        evidenceText: "Howard Florey and Ernst Chain led the Oxford team that purified and mass-produced penicillin in the 1940s.",
        source: "Medical History Archives",
        relevance: 88,
        note: "Misattribution: purification and mass yield were engineered by Florey & Chain.",
      },
    ],
    reasons: [
      { text: "Accurately identifies initial discovery date and location", positive: true },
      { text: "Fails on Nobel Prize co-recipients (attributed to Fleming exclusively)", positive: false },
      { text: "Misattributes chemical purification and manufacturing to Fleming", positive: false },
      { text: "Hallucination risk flagged at 32% (requires human inspection)", positive: false },
    ],
    evaluatedAt: "2 mins ago",
    relevance: {
      score: 89,
      label: "mostly_relevant",
      label_display: "Mostly Relevant",
      reasoning: "The response addresses the question of who discovered penicillin and won the Nobel Prize, though it contains inaccurate claims regarding co-recipients.",
      signals: {
        semantic_similarity: 0.88,
        keyword_coverage: 0.90,
        topic_alignment: "high",
        matched_concepts: ["discovered", "penicillin", "nobel", "prize"],
        missing_concepts: [],
      },
    },
    accuracy: {
      score: 64,
      status: "Partially Correct",
      reasoning: "Moderate accuracy score (64/100). The response contains 1 SUPPORTED and 1 PARTIAL claim, but has 1 UNSUPPORTED claim contradicting official Nobel Prize citations.",
      supported_count: 1,
      partial_count: 1,
      unsupported_count: 1,
      contradicted_count: 0,
      claims: [
        { claim: "Alexander Fleming discovered penicillin in 1928 at St. Mary's Hospital.", status: "SUPPORTED", similarity: 0.99, evidence: "Fleming observed the antibacterial properties in Sept 1928 at St. Mary's Hospital, London." },
        { claim: "Fleming was the sole recipient of the 1945 Nobel Prize.", status: "UNSUPPORTED", similarity: 0.42, evidence: "The 1945 Nobel Prize was shared between Alexander Fleming, Ernst Chain, and Howard Florey." },
        { claim: "Fleming developed mass production techniques.", status: "PARTIAL", similarity: 0.88, evidence: "Howard Florey and Ernst Chain led the Oxford team that purified and mass-produced penicillin." },
      ],
    },
    hallucination: {
      risk_score: 32,
      status: "moderate",
      reasoning: "Moderate hallucination risk (32%). 1 of 3 claims contradicts historical prize co-recipient records.",
      flagged_claims: [
        {
          claim: "Fleming was the sole recipient of the 1945 Nobel Prize.",
          status: "UNSUPPORTED",
          reasoning: "This statement is contradicted by the 1945 Nobel Prize citation showing Florey and Chain were co-recipients.",
          evidence: "The 1945 Nobel Prize was shared between Alexander Fleming, Ernst Chain, and Howard Florey.",
        },
      ],
    },
    completeness: {
      score: 72,
      reasoning: "The response partially covers 72% of the inquiry scope but omits co-discoverers Florey and Chain.",
      covered_aspects: ["fleming", "penicillin", "nobel"],
      missing_aspects: ["co-recipients", "chain", "florey"],
    },
    verdict_detail: {
      overall_score: 68,
      label: "REVIEW",
      reasoning: "The response is relevant and mostly accurate, but some claims lack sufficient supporting evidence, resulting in moderate hallucination risk (32%). Final verdict is REVIEW with an overall score of 68/100 (medium confidence).",
    },
  },
  finance: {
    id: "eval-03",
    title: "Interest Rate Decision (Fail)",
    question: "What did the US Federal Reserve decide regarding interest rates in March 2024?",
    aiResponse:
      "In March 2024, the Federal Reserve cut the benchmark interest rate by 75 basis points in response to sudden labor market weakness and declared an end to quantitative tightening.",
    referenceAnswer:
      "In March 2024, the FOMC voted unanimously to hold the federal funds rate steady in the range of 5.25% to 5.50%, noting inflation remained elevated.",
    overallScore: 38,
    verdict: "FAIL",
    confidence: "high",
    scores: {
      relevance: 92,
      accuracy: 25,
      hallucinationRisk: 75,
      completeness: 40,
    },
    claims: [
      {
        id: "f1",
        claim: "The Federal Reserve cut interest rates by 75 basis points in March 2024.",
        status: "unsupported",
        evidenceText: "FOMC Statement (March 20, 2024): The Committee decided to maintain the target range for the federal funds rate at 5-1/4 to 5-1/2 percent.",
        source: "Federal Reserve Board Press Release",
        relevance: 100,
        note: "Critical factual hallucination: rates were kept unchanged, not cut.",
      },
      {
        id: "f2",
        claim: "The move was triggered by sudden labor market weakness.",
        status: "unsupported",
        evidenceText: "The Committee noted that economic activity had been expanding at a solid pace, with strong job gains and low unemployment.",
        source: "FOMC March 2024 Minutes",
        relevance: 94,
        note: "Contradicts official labor market indicators from meeting minutes.",
      },
      {
        id: "f3",
        claim: "The Fed declared an end to quantitative tightening in March 2024.",
        status: "unsupported",
        evidenceText: "The Committee will continue reducing its holdings of Treasury securities and agency debt as previously announced.",
        source: "Federal Reserve Balance Sheet Operations Report",
        relevance: 91,
        note: "Balance sheet runoff continued; no halt was declared.",
      },
    ],
    reasons: [
      { text: "Addresses the correct agency and meeting date", positive: true },
      { text: "Direct inversion of reality: reported 75bps rate cut instead of rate hold", positive: false },
      { text: "Fabricated macroeconomic justifications contrary to official records", positive: false },
      { text: "Critical hallucination alert: response should be rejected", positive: false },
    ],
    evaluatedAt: "10 mins ago",
    relevance: {
      score: 92,
      label: "fully_relevant",
      label_display: "Fully Relevant",
      reasoning: "The response addresses the Federal Reserve March 2024 interest rate decision topic directly, despite severe factual inversion.",
      signals: {
        semantic_similarity: 0.91,
        keyword_coverage: 0.85,
        topic_alignment: "high",
        matched_concepts: ["federal", "reserve", "interest", "rates", "march"],
        missing_concepts: [],
      },
    },
    accuracy: {
      score: 25,
      status: "Factual Inaccuracies Detected",
      reasoning: "Low accuracy score (25/100) due to severe factual discrepancy. Found 3 contradicted claims directly conflicting with FOMC official statements.",
      supported_count: 0,
      partial_count: 0,
      unsupported_count: 3,
      contradicted_count: 3,
      claims: [
        { claim: "The Federal Reserve cut interest rates by 75 basis points in March 2024.", status: "CONTRADICTED", similarity: 0.35, evidence: "FOMC maintained target rate at 5.25-5.50%." },
        { claim: "The move was triggered by sudden labor market weakness.", status: "UNSUPPORTED", similarity: 0.40, evidence: "Committee noted economic activity expanding at solid pace." },
        { claim: "The Fed declared an end to quantitative tightening in March 2024.", status: "CONTRADICTED", similarity: 0.38, evidence: "Runoff operations continued as scheduled." },
      ],
    },
    hallucination: {
      risk_score: 75,
      status: "critical",
      reasoning: "Critical hallucination risk (75%). Direct factual inversion: asserted 75bps rate cut when interest rates were held steady.",
      flagged_claims: [
        {
          claim: "The Federal Reserve cut interest rates by 75 basis points in March 2024.",
          status: "CONTRADICTED",
          reasoning: "Direct contradiction against FOMC ground truth statement.",
          evidence: "FOMC Statement: The Committee decided to maintain the target range for the federal funds rate at 5.25 to 5.50 percent.",
        },
        {
          claim: "The move was triggered by sudden labor market weakness.",
          status: "UNSUPPORTED",
          reasoning: "Contradicts official labor market indicators from meeting minutes.",
          evidence: "FOMC Minutes noted job gains remained strong and unemployment remained low.",
        },
      ],
    },
    completeness: {
      score: 40,
      reasoning: "The response addresses 40% of the inquiry scope, but fabricates macroeconomic justifications contrary to official records.",
      covered_aspects: ["interest rates", "federal reserve"],
      missing_aspects: ["rate hold", "inflation status"],
    },
    verdict_detail: {
      overall_score: 38,
      label: "FAIL",
      reasoning: "The response contains factual contradictions or incorrect assertions directly conflicting with verified ground truth, resulting in an elevated hallucination risk (75%). Final verdict is FAIL with an overall score of 38/100 (high confidence).",
    },
  },
};

interface EvaluationContextType {
  currentEvaluation: EvaluationRecord;
  setCurrentEvaluation: (record: EvaluationRecord) => void;
  selectedPresetKey: string;
  selectPreset: (key: string) => void;
  isEvaluating: boolean;
  evaluationStep: number;
  evaluationStepText: string;
  runCustomEvaluation: (params: {
    question: string;
    aiResponse: string;
    referenceAnswer?: string;
    sourceDocument?: string;
    dataset?: string;
  }) => Promise<EvaluationRecord>;
  loadEvaluationById: (id: string) => Promise<EvaluationRecord>;
  userProfile: {
    email: string;
    name: string;
    isLoggedIn: boolean;
    tier: string;
  };
  loginUser: (email: string, name?: string) => void;
  logoutUser: () => void;
}

const EvaluationContext = createContext<EvaluationContextType | null>(null);

export function EvaluationProvider({ children }: { children: React.ReactNode }) {
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>("photosynthesis");
  const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationRecord>(
    PRESET_EVALUATIONS.photosynthesis
  );
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationStep, setEvaluationStep] = useState(0);
  const [evaluationStepText, setEvaluationStepText] = useState("");

  const [userProfile, setUserProfile] = useState(() => {
    try {
      const stored = localStorage.getItem("veriai_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.isLoggedIn && parsed.email) {
          return parsed;
        }
      }
    } catch {
      // ignore invalid stored value
    }
    return {
      email: "",
      name: "",
      isLoggedIn: false,
      tier: "Pro Evaluation",
    };
  });

  const loginUser = (email: string, name?: string) => {
    const profile = {
      email,
      name: name || email.split("@")[0].replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      isLoggedIn: true,
      tier: "Pro Evaluation",
    };
    setUserProfile(profile);
    try {
      localStorage.setItem("veriai_user", JSON.stringify(profile));
    } catch {
      // ignore storage errors
    }
  };

  const logoutUser = () => {
    const cleared = { email: "", name: "", isLoggedIn: false, tier: "Pro Evaluation" };
    setUserProfile(cleared);
    try {
      localStorage.removeItem("veriai_user");
    } catch {
      // ignore
    }
  };

  const selectPreset = (key: string) => {
    if (PRESET_EVALUATIONS[key]) {
      setSelectedPresetKey(key);
      setCurrentEvaluation(PRESET_EVALUATIONS[key]);
    }
  };

  const runCustomEvaluation = async (params: {
    question: string;
    aiResponse: string;
    referenceAnswer?: string;
    sourceDocument?: string;
    dataset?: string;
  }): Promise<EvaluationRecord> => {
    setIsEvaluating(true);
    setEvaluationStepText("VeriAI is evaluating your response against the knowledge base...");

    try {
      const newRecord = await evaluateResponse({
        question: params.question,
        ai_response: params.aiResponse,
        reference_answer: params.referenceAnswer || undefined,
        source_document: params.sourceDocument || undefined,
        dataset: params.dataset || undefined,
      });

      setCurrentEvaluation(newRecord);
      return newRecord;
    } catch (err: any) {
      console.error("[VeriAI] Evaluation API error:", err);
      throw err;
    } finally {
      setIsEvaluating(false);
      setEvaluationStep(0);
      setEvaluationStepText("");
    }
  };

  const loadEvaluationById = async (id: string): Promise<EvaluationRecord> => {
    const record = await getEvaluation(id);
    setCurrentEvaluation(record);
    return record;
  };

  return (
    <EvaluationContext.Provider
      value={{
        currentEvaluation,
        setCurrentEvaluation,
        selectedPresetKey,
        selectPreset,
        isEvaluating,
        evaluationStep,
        evaluationStepText,
        runCustomEvaluation,
        loadEvaluationById,
        userProfile,
        loginUser,
        logoutUser,
      }}
    >
      {children}
    </EvaluationContext.Provider>
  );
}

export function useEvaluation() {
  const context = useContext(EvaluationContext);
  if (!context) {
    throw new Error("useEvaluation must be used within an EvaluationProvider");
  }
  return context;
}
