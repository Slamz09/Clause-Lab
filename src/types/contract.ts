export interface Contract {
  id: string;
  contract_no?: number; // Sequential contract number for display
  contract_name: string;
  contract_type: string;
  industry: string | null;
  governing_law: string | null;
  date_added: string;
  contract_attachment: string; // URL or base64 representation
  file_name?: string;
  file_content?: string; // Stored for extraction
  created_at: string;
  updated_at: string;
}

export interface ContractFormData {
  contract_name: string;
  contract_type: string;
  industry?: string | null;
  governing_law?: string | null;
  date_added?: string;
  contract_attachment: string;
  file_name?: string;
  file_content?: string;
}
