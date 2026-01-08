import { useState, useEffect } from 'react';
import { database } from '@/services/database';
import { Contract, ContractFormData } from '@/types/contract';

export function useContracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchContracts = () => {
    setIsLoading(true);
    const data = database.getContracts();
    setContracts(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const createContract = async (formData: ContractFormData) => {
    const newContract = database.createContract(formData);
    setContracts(prev => [newContract, ...prev]);
    return newContract;
  };

  const updateContract = async (id: string, updates: Partial<ContractFormData>) => {
    const updated = database.updateContract(id, updates);
    if (updated) {
      setContracts(prev => prev.map(c => c.id === id ? updated : c));
    }
    return updated;
  };

  const deleteContract = async (id: string) => {
    const success = database.deleteContract(id);
    if (success) {
      setContracts(prev => prev.filter(c => c.id !== id));
    }
    return success;
  };

  return {
    contracts,
    isLoading,
    createContract,
    updateContract,
    deleteContract,
    refetch: fetchContracts,
  };
}