import { useState, useEffect, useCallback } from 'react';
import { database } from "@/services/database";
import { useToast } from "@/hooks/use-toast";
import type { Clause, ClauseFormData } from "@/types/clause";
import type { ClauseFiltersState } from "@/components/clauses/ClauseFilters";

export function useClauses() {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchClauses = useCallback(async () => {
    setLoading(true);
    try {
      const data = database.getClauses();
      setClauses(data);
    } catch (error: any) {
      toast({
        title: "Error loading clauses",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchClauses();
  }, [fetchClauses]);

  const createClause = async (formData: ClauseFormData) => {
    try {
      database.createClause(formData);
      toast({
        title: "Clause created",
        description: "Your clause has been saved successfully.",
      });
      fetchClauses();
      return true;
    } catch (error: any) {
      toast({
        title: "Error creating clause",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const updateClause = async (id: string, formData: ClauseFormData) => {
    try {
      database.updateClause(id, formData);
      toast({
        title: "Clause updated",
        description: "Your changes have been saved.",
      });
      fetchClauses();
      return true;
    } catch (error: any) {
      toast({
        title: "Error updating clause",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteClause = async (id: string) => {
    try {
      database.deleteClause(id);
      toast({
        title: "Clause deleted",
        description: "The clause has been removed.",
      });
      fetchClauses();
      return true;
    } catch (error: any) {
      toast({
        title: "Error deleting clause",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const filterClauses = (filters: ClauseFiltersState) => {
    return clauses.filter((clause) => {
      const matchesSearch = !filters.search ||
        clause.clause_text.toLowerCase().includes(filters.search.toLowerCase()) ||
        clause.clause_type.toLowerCase().includes(filters.search.toLowerCase());

      // Check if clause type matches OR if any subclause contains any of the filter values (case-insensitive)
      const clauseTypeFilters = filters.clauseTypes || [];
      const matchesClauseType = clauseTypeFilters.length === 0 ||
        clauseTypeFilters.some(filterType =>
          clause.clause_type === filterType ||
          clause.clause_type.toLowerCase().includes(filterType.toLowerCase()) ||
          (clause.subtags && clause.subtags.some(subtag =>
            subtag.toLowerCase().includes(filterType.toLowerCase())
          ))
        );

      // Contract type multi-select
      const contractTypeFilters = filters.contractTypes || [];
      const matchesContractType = contractTypeFilters.length === 0 ||
        contractTypeFilters.some(filterType =>
          clause.contract_type === filterType ||
          clause.contract_type?.toLowerCase().includes(filterType.toLowerCase())
        );

      const matchesPartyRole = filters.partyRole === 'All' || filters.partyRole === 'Party Role' || clause.party_role === filters.partyRole;

      // Industry multi-select
      const industryFilters = filters.industries || [];
      const matchesIndustry = industryFilters.length === 0 ||
        industryFilters.some(filterInd =>
          clause.industry === filterInd ||
          clause.industry?.toLowerCase().includes(filterInd.toLowerCase())
        );

      return matchesSearch && matchesClauseType && matchesContractType && matchesPartyRole && matchesIndustry;
    });
  };

  return {
    clauses,
    loading,
    createClause,
    updateClause,
    deleteClause,
    filterClauses,
    refetch: fetchClauses,
  };
}
