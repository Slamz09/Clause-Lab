import { Clause, ClauseFormData } from "@/types/clause";
import { Contract, ContractFormData } from "@/types/contract";
import { googleSync } from "./googleSync";

const CLAUSE_STORAGE_KEY = 'clause-lab-clauses';
const CONTRACT_STORAGE_KEY = 'clause-lab-contracts';

// Schedule auto-sync after data changes
const scheduleAutoSync = () => {
  googleSync.scheduleSync(
    () => database.getClauses(),
    () => database.getContracts()
  );
};

export const database = {
  // Clause operations
  getClauses: (): Clause[] => {
    const data = localStorage.getItem(CLAUSE_STORAGE_KEY);
    if (!data) {
      // Check legacy key
      const legacyData = localStorage.getItem('clause-lab-data');
      if (legacyData) {
        localStorage.setItem(CLAUSE_STORAGE_KEY, legacyData);
        localStorage.removeItem('clause-lab-data');
        const parsed = JSON.parse(legacyData);
        // Migrate subtag to subtags array
        return parsed.map((c: any) => ({
          ...c,
          subtags: c.subtags || (c.subtag ? [c.subtag] : []),
        }));
      }
      return [];
    }
    try {
      const clauses = JSON.parse(data);
      // Migrate old clauses: subtag -> subtags array
      return clauses.map((c: any) => ({
        ...c,
        subtags: c.subtags || (c.subtag ? [c.subtag] : []),
      }));
    } catch (e) {
      console.error('Error parsing clauses from localStorage', e);
      return [];
    }
  },

  getClauseById: (id: string): Clause | undefined => {
    const clauses = database.getClauses();
    return clauses.find(c => c.id === id);
  },

  createClause: (formData: ClauseFormData): Clause => {
    const clauses = database.getClauses();
    const newClause: Clause = {
      ...formData,
      id: crypto.randomUUID(),
      subtags: formData.subtags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updatedClauses = [newClause, ...clauses];
    localStorage.setItem(CLAUSE_STORAGE_KEY, JSON.stringify(updatedClauses));
    scheduleAutoSync();
    return newClause;
  },

  updateClause: (id: string, updates: Partial<ClauseFormData>): Clause | null => {
    const clauses = database.getClauses();
    const index = clauses.findIndex(c => c.id === id);
    if (index === -1) return null;

    const updatedClause = {
      ...clauses[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    clauses[index] = updatedClause;
    localStorage.setItem(CLAUSE_STORAGE_KEY, JSON.stringify(clauses));
    scheduleAutoSync();
    return updatedClause;
  },

  deleteClause: (id: string): boolean => {
    const clauses = database.getClauses();
    const filteredClauses = clauses.filter(c => c.id !== id);
    if (clauses.length === filteredClauses.length) return false;

    localStorage.setItem(CLAUSE_STORAGE_KEY, JSON.stringify(filteredClauses));
    scheduleAutoSync();
    return true;
  },

  // Contract operations
  getContracts: (): Contract[] => {
    const data = localStorage.getItem(CONTRACT_STORAGE_KEY);
    if (!data) return [];
    try {
      const contracts = JSON.parse(data);
      // Migrate old contracts: date_executed -> date_added, add governing_law
      const migratedContracts = contracts.map((c: any) => ({
        ...c,
        date_added: c.date_added || c.date_executed || c.created_at,
        governing_law: c.governing_law || null,
      }));

      // Sort by created_at to assign sequential contract numbers (oldest first = #1)
      const sortedByCreation = [...migratedContracts].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      // Assign contract_no based on creation order
      const contractNoMap = new Map<string, number>();
      sortedByCreation.forEach((c, index) => {
        contractNoMap.set(c.id, index + 1);
      });

      // Return contracts with their assigned numbers (in original order)
      return migratedContracts.map((c: any) => ({
        ...c,
        contract_no: contractNoMap.get(c.id),
      }));
    } catch (e) {
      console.error('Error parsing contracts from localStorage', e);
      return [];
    }
  },

  getContractById: (id: string): Contract | undefined => {
    const contracts = database.getContracts();
    return contracts.find(c => c.id === id);
  },

  getContractByDocumentName: (documentName: string): Contract | undefined => {
    const contracts = database.getContracts();
    return contracts.find(c =>
      c.file_name === documentName ||
      c.contract_name === documentName ||
      c.file_name?.replace(/\.[^/.]+$/, "") === documentName
    );
  },

  createContract: (formData: ContractFormData): Contract => {
    const contracts = database.getContracts();
    const newContract: Contract = {
      ...formData,
      id: crypto.randomUUID(),
      industry: formData.industry || null,
      governing_law: formData.governing_law || null,
      date_added: formData.date_added || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updatedContracts = [newContract, ...contracts];
    localStorage.setItem(CONTRACT_STORAGE_KEY, JSON.stringify(updatedContracts));
    scheduleAutoSync();
    return newContract;
  },

  updateContract: (id: string, updates: Partial<ContractFormData>): Contract | null => {
    const contracts = database.getContracts();
    const index = contracts.findIndex(c => c.id === id);
    if (index === -1) return null;

    const updatedContract = {
      ...contracts[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    contracts[index] = updatedContract;
    localStorage.setItem(CONTRACT_STORAGE_KEY, JSON.stringify(contracts));
    scheduleAutoSync();
    return updatedContract;
  },

  deleteContract: (id: string): boolean => {
    const contracts = database.getContracts();
    const filteredContracts = contracts.filter(c => c.id !== id);
    if (contracts.length === filteredContracts.length) return false;

    localStorage.setItem(CONTRACT_STORAGE_KEY, JSON.stringify(filteredContracts));
    scheduleAutoSync();
    return true;
  },

  searchClauses: (query: string): Clause[] => {
    const clauses = database.getClauses();
    const lowerQuery = query.toLowerCase();
    return clauses.filter(c =>
      c.clause_text.toLowerCase().includes(lowerQuery) ||
      c.clause_type.toLowerCase().includes(lowerQuery) ||
      (c.contract_type?.toLowerCase().includes(lowerQuery))
    );
  },

  // Export all data to JSON
  exportAllData: (): string => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      clauses: database.getClauses(),
      contracts: database.getContracts(),
    };
    return JSON.stringify(data, null, 2);
  },

  // Export clauses only
  exportClauses: (): string => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      clauses: database.getClauses(),
    };
    return JSON.stringify(data, null, 2);
  },

  // Export contracts only
  exportContracts: (): string => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      contracts: database.getContracts(),
    };
    return JSON.stringify(data, null, 2);
  },

  // Import data from JSON (merges with existing data)
  importData: (jsonString: string, options: { replace?: boolean } = {}): { clauses: number; contracts: number } => {
    const data = JSON.parse(jsonString);
    let clausesImported = 0;
    let contractsImported = 0;

    if (data.clauses && Array.isArray(data.clauses)) {
      const existingClauses = options.replace ? [] : database.getClauses();
      const existingIds = new Set(existingClauses.map(c => c.id));

      const newClauses = data.clauses.filter((c: Clause) => !existingIds.has(c.id));
      const mergedClauses = [...existingClauses, ...newClauses];
      localStorage.setItem(CLAUSE_STORAGE_KEY, JSON.stringify(mergedClauses));
      clausesImported = newClauses.length;
    }

    if (data.contracts && Array.isArray(data.contracts)) {
      const existingContracts = options.replace ? [] : database.getContracts();
      const existingIds = new Set(existingContracts.map(c => c.id));

      const newContracts = data.contracts.filter((c: Contract) => !existingIds.has(c.id));
      const mergedContracts = [...existingContracts, ...newContracts];
      localStorage.setItem(CONTRACT_STORAGE_KEY, JSON.stringify(mergedContracts));
      contractsImported = newContracts.length;
    }

    if (clausesImported > 0 || contractsImported > 0) {
      scheduleAutoSync();
    }

    return { clauses: clausesImported, contracts: contractsImported };
  },

  // Download helper
  downloadAsFile: (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

export default database;
