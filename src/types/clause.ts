export interface Clause {
  id: string;
  clause_type: string;
  clause_no: string | null;  // The clause number/title (e.g., "8. Services for Others")
  subtags: string[];  // Array of subtags specific to clause type (e.g., ["termination for convenience", "mutual"])
  contract_type: string | null;
  document_name: string | null;  // The source document file name
  party_role: string | null;
  industry: string | null;
  clause_text: string;
  preferred_position: string | null;
  acceptable_alternatives: string | null;
  approval_required: string | null;
  complexity: number | null;
  balance: number | null;
  created_at: string;
  updated_at: string;
}

export interface ClauseFormData {
  clause_type: string;
  clause_no?: string | null;  // The clause number/title (e.g., "8. Services for Others")
  subtags?: string[];  // Array of subtags specific to clause type
  contract_type: string | null;
  document_name?: string | null;  // The source document file name
  party_role?: string | null;
  industry: string | null;
  clause_text: string;
  preferred_position?: string | null;
  acceptable_alternatives?: string | null;
  approval_required?: string | null;
  complexity?: number | null;
  balance?: number | null;
}

export interface ClauseAnalysis {
  risks: string[];
  improvements: string[];
  alternatives: string[];
  balanceAssessment: {
    score: number;
    explanation: string;
  };
}
