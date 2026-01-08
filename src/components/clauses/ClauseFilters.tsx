import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, X, ChevronDown, Plus, Check } from 'lucide-react';

// Default types (without "All" - that's added separately)
const DEFAULT_CLAUSE_TYPES = ["Net-Payment", "Indemnity", "Confidentiality", "Limitation of Liability", "Termination", "Force Majeure", "Non-Compete", "IP Rights", "Warranty", "Dispute Resolution"];
const DEFAULT_CONTRACT_TYPES = ["SaaS Agreement", "Master Services Agreement", "NDA", "Employment Agreement", "Vendor Agreement", "License Agreement", "Partnership Agreement"];
const DEFAULT_INDUSTRIES = ["Technology", "Healthcare", "Finance", "Manufacturing", "Retail", "Legal", "General"];

// Export for backwards compatibility
export const CLAUSE_TYPES = ["Clause Type", ...DEFAULT_CLAUSE_TYPES];
export const CONTRACT_TYPES = ["Contract Type", ...DEFAULT_CONTRACT_TYPES];
export const PARTY_ROLES = ["Party Role", ...["Customer", "Vendor", "Neutral"].sort((a, b) => a.localeCompare(b))];
export const INDUSTRIES = ["Industry", ...DEFAULT_INDUSTRIES];

// Load custom types from localStorage (same function used in ClauseFormModal)
function loadCustomTypes(key: string, defaults: string[]): string[] {
  try {
    const stored = localStorage.getItem(key);
    const deletedKey = key + '_deleted';
    const deletedStored = localStorage.getItem(deletedKey);
    const deletedTypes = deletedStored ? JSON.parse(deletedStored) : [];

    let allTypes = [...defaults];
    if (stored) {
      const custom = JSON.parse(stored);
      allTypes = [...new Set([...defaults, ...custom])];
    }
    // Filter out deleted types
    return allTypes.filter(t => !deletedTypes.includes(t));
  } catch (e) {
    console.error('Error loading custom types:', e);
  }
  return defaults;
}

export interface ClauseFiltersState {
  search: string;
  clauseTypes: string[];  // Array for multi-select
  contractTypes: string[];  // Array for multi-select
  partyRole: string;
  industries: string[];  // Array for multi-select
}

// Helper to save custom types
function saveCustomType(key: string, newType: string) {
  try {
    const stored = localStorage.getItem(key);
    const existing = stored ? JSON.parse(stored) : [];
    if (!existing.includes(newType)) {
      existing.push(newType);
      localStorage.setItem(key, JSON.stringify(existing));
      window.dispatchEvent(new Event('customTypesUpdated'));
    }
  } catch (e) {
    console.error('Error saving custom type:', e);
  }
}

// Helper to remove custom types
function removeCustomType(key: string, typeToRemove: string, defaults: string[]): boolean {
  try {
    // Remove from custom types if it's there
    const stored = localStorage.getItem(key);
    if (stored) {
      const existing = JSON.parse(stored);
      const filtered = existing.filter((t: string) => t !== typeToRemove);
      localStorage.setItem(key, JSON.stringify(filtered));
    }
    // Add to deleted types list (to prevent default types from coming back)
    const deletedKey = key + '_deleted';
    const deletedStored = localStorage.getItem(deletedKey);
    const deletedTypes = deletedStored ? JSON.parse(deletedStored) : [];
    if (!deletedTypes.includes(typeToRemove)) {
      deletedTypes.push(typeToRemove);
      localStorage.setItem(deletedKey, JSON.stringify(deletedTypes));
    }
    window.dispatchEvent(new Event('customTypesUpdated'));
    return true;
  } catch (e) {
    console.error('Error removing custom type:', e);
  }
  return false;
}

interface ClauseFiltersProps {
  filters: ClauseFiltersState;
  onFilterChange: (key: keyof ClauseFiltersState, value: string | string[]) => void;
  onClearFilters: () => void;
}

export default function ClauseFilters({ filters, onFilterChange, onClearFilters }: ClauseFiltersProps) {
  // Dynamic type lists that include custom types from localStorage (sorted A-Z)
  const [clauseTypes, setClauseTypes] = useState<string[]>(() =>
    loadCustomTypes('customClauseTypes', DEFAULT_CLAUSE_TYPES).sort((a, b) => a.localeCompare(b))
  );
  const [contractTypes, setContractTypes] = useState<string[]>(() =>
    loadCustomTypes('customContractTypes', DEFAULT_CONTRACT_TYPES).sort((a, b) => a.localeCompare(b))
  );
  const [industries, setIndustries] = useState<string[]>(() =>
    loadCustomTypes('customIndustries', DEFAULT_INDUSTRIES).sort((a, b) => a.localeCompare(b))
  );

  // State for adding new types
  const [isAddingClauseType, setIsAddingClauseType] = useState(false);
  const [newClauseTypeName, setNewClauseTypeName] = useState('');
  const [isClauseTypeOpen, setIsClauseTypeOpen] = useState(false);

  const [isAddingContractType, setIsAddingContractType] = useState(false);
  const [newContractTypeName, setNewContractTypeName] = useState('');
  const [isContractTypeOpen, setIsContractTypeOpen] = useState(false);

  const [isAddingIndustry, setIsAddingIndustry] = useState(false);
  const [newIndustryName, setNewIndustryName] = useState('');
  const [isIndustryOpen, setIsIndustryOpen] = useState(false);

  // Refresh types when component regains focus (after modal closes)
  useEffect(() => {
    const refreshTypes = () => {
      setClauseTypes(loadCustomTypes('customClauseTypes', DEFAULT_CLAUSE_TYPES).sort((a, b) => a.localeCompare(b)));
      setContractTypes(loadCustomTypes('customContractTypes', DEFAULT_CONTRACT_TYPES).sort((a, b) => a.localeCompare(b)));
      setIndustries(loadCustomTypes('customIndustries', DEFAULT_INDUSTRIES).sort((a, b) => a.localeCompare(b)));
    };

    window.addEventListener('storage', refreshTypes);
    window.addEventListener('customTypesUpdated', refreshTypes);
    window.addEventListener('focus', refreshTypes);

    return () => {
      window.removeEventListener('storage', refreshTypes);
      window.removeEventListener('customTypesUpdated', refreshTypes);
      window.removeEventListener('focus', refreshTypes);
    };
  }, []);

  // Clause Type handlers
  const handleClauseTypeToggle = (type: string) => {
    const currentTypes = filters.clauseTypes || [];
    if (currentTypes.includes(type)) {
      onFilterChange('clauseTypes', currentTypes.filter(t => t !== type));
    } else {
      onFilterChange('clauseTypes', [...currentTypes, type]);
    }
  };

  const handleAddNewClauseType = () => {
    if (newClauseTypeName.trim()) {
      const trimmed = newClauseTypeName.trim();
      saveCustomType('customClauseTypes', trimmed);
      setClauseTypes(prev => [...prev, trimmed].sort((a, b) => a.localeCompare(b)));
      onFilterChange('clauseTypes', [...(filters.clauseTypes || []), trimmed]);
      setNewClauseTypeName('');
      setIsAddingClauseType(false);
    }
  };

  // Contract Type handlers
  const handleContractTypeToggle = (type: string) => {
    const currentTypes = filters.contractTypes || [];
    if (currentTypes.includes(type)) {
      onFilterChange('contractTypes', currentTypes.filter(t => t !== type));
    } else {
      onFilterChange('contractTypes', [...currentTypes, type]);
    }
  };

  const handleAddNewContractType = () => {
    if (newContractTypeName.trim()) {
      const trimmed = newContractTypeName.trim();
      saveCustomType('customContractTypes', trimmed);
      setContractTypes(prev => [...prev, trimmed].sort((a, b) => a.localeCompare(b)));
      onFilterChange('contractTypes', [...(filters.contractTypes || []), trimmed]);
      setNewContractTypeName('');
      setIsAddingContractType(false);
    }
  };

  // Industry handlers
  const handleIndustryToggle = (type: string) => {
    const currentTypes = filters.industries || [];
    if (currentTypes.includes(type)) {
      onFilterChange('industries', currentTypes.filter(t => t !== type));
    } else {
      onFilterChange('industries', [...currentTypes, type]);
    }
  };

  const handleAddNewIndustry = () => {
    if (newIndustryName.trim()) {
      const trimmed = newIndustryName.trim();
      saveCustomType('customIndustries', trimmed);
      setIndustries(prev => [...prev, trimmed].sort((a, b) => a.localeCompare(b)));
      onFilterChange('industries', [...(filters.industries || []), trimmed]);
      setNewIndustryName('');
      setIsAddingIndustry(false);
    }
  };

  const hasActiveFilters = filters.search ||
    (filters.clauseTypes && filters.clauseTypes.length > 0) ||
    (filters.contractTypes && filters.contractTypes.length > 0) ||
    filters.partyRole !== 'Party Role' ||
    (filters.industries && filters.industries.length > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            placeholder="Search clauses..."
            className="pl-10 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
          />
        </div>

        {/* Clause Type Multi-Select */}
        <Popover open={isClauseTypeOpen} onOpenChange={setIsClauseTypeOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[180px] justify-between bg-background border-border text-foreground hover:bg-accent"
            >
              <span className="truncate">
                {filters.clauseTypes && filters.clauseTypes.length > 0
                  ? `${filters.clauseTypes.length} clause type${filters.clauseTypes.length > 1 ? 's' : ''}`
                  : "Clause Type"}
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0 bg-popover border-border" align="start">
            <div className="p-2 border-b border-border">
              {isAddingClauseType ? (
                <div className="flex gap-1">
                  <Input
                    value={newClauseTypeName}
                    onChange={(e) => setNewClauseTypeName(e.target.value)}
                    placeholder="New clause type..."
                    className="h-8 text-sm bg-background border-border"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddNewClauseType();
                      if (e.key === 'Escape') { setIsAddingClauseType(false); setNewClauseTypeName(''); }
                    }}
                  />
                  <Button size="sm" onClick={handleAddNewClauseType} className="h-8 px-2">
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setIsAddingClauseType(false); setNewClauseTypeName(''); }} className="h-8 px-2">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-primary hover:text-primary"
                  onClick={() => setIsAddingClauseType(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add new type
                </Button>
              )}
            </div>
            <ScrollArea className="h-[200px]">
              <div className="p-2 space-y-1">
                {clauseTypes.map((type) => (
                  <div
                    key={type}
                    className="flex items-center space-x-2 p-2 rounded hover:bg-accent cursor-pointer group"
                    onClick={() => handleClauseTypeToggle(type)}
                  >
                    <Checkbox
                      checked={filters.clauseTypes?.includes(type) || false}
                      onCheckedChange={() => handleClauseTypeToggle(type)}
                    />
                    <span className="text-sm text-foreground flex-1">{type}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (removeCustomType('customClauseTypes', type, DEFAULT_CLAUSE_TYPES)) {
                          setClauseTypes(prev => prev.filter(t => t !== type));
                          onFilterChange('clauseTypes', (filters.clauseTypes || []).filter(t => t !== type));
                        }
                      }}
                      title="Remove type"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {filters.clauseTypes && filters.clauseTypes.length > 0 && (
              <div className="p-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-foreground"
                  onClick={() => onFilterChange('clauseTypes', [])}
                >
                  Clear selection
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Contract Type Multi-Select */}
        <Popover open={isContractTypeOpen} onOpenChange={setIsContractTypeOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[180px] justify-between bg-background border-border text-foreground hover:bg-accent"
            >
              <span className="truncate">
                {filters.contractTypes && filters.contractTypes.length > 0
                  ? `${filters.contractTypes.length} contract type${filters.contractTypes.length > 1 ? 's' : ''}`
                  : "Contract Type"}
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0 bg-popover border-border" align="start">
            <div className="p-2 border-b border-border">
              {isAddingContractType ? (
                <div className="flex gap-1">
                  <Input
                    value={newContractTypeName}
                    onChange={(e) => setNewContractTypeName(e.target.value)}
                    placeholder="New contract type..."
                    className="h-8 text-sm bg-background border-border"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddNewContractType();
                      if (e.key === 'Escape') { setIsAddingContractType(false); setNewContractTypeName(''); }
                    }}
                  />
                  <Button size="sm" onClick={handleAddNewContractType} className="h-8 px-2">
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setIsAddingContractType(false); setNewContractTypeName(''); }} className="h-8 px-2">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-primary hover:text-primary"
                  onClick={() => setIsAddingContractType(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add new type
                </Button>
              )}
            </div>
            <ScrollArea className="h-[200px]">
              <div className="p-2 space-y-1">
                {contractTypes.map((type) => (
                  <div
                    key={type}
                    className="flex items-center space-x-2 p-2 rounded hover:bg-accent cursor-pointer group"
                    onClick={() => handleContractTypeToggle(type)}
                  >
                    <Checkbox
                      checked={filters.contractTypes?.includes(type) || false}
                      onCheckedChange={() => handleContractTypeToggle(type)}
                    />
                    <span className="text-sm text-foreground flex-1">{type}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (removeCustomType('customContractTypes', type, DEFAULT_CONTRACT_TYPES)) {
                          setContractTypes(prev => prev.filter(t => t !== type));
                          onFilterChange('contractTypes', (filters.contractTypes || []).filter(t => t !== type));
                        }
                      }}
                      title="Remove type"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {filters.contractTypes && filters.contractTypes.length > 0 && (
              <div className="p-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-foreground"
                  onClick={() => onFilterChange('contractTypes', [])}
                >
                  Clear selection
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Select value={filters.partyRole} onValueChange={(value) => onFilterChange('partyRole', value)}>
          <SelectTrigger className="w-[150px] bg-background border-border text-foreground">
            <SelectValue placeholder="Party Role" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {PARTY_ROLES.map((role) => (
              <SelectItem key={role} value={role} className="text-foreground hover:bg-accent">
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Industry Multi-Select */}
        <Popover open={isIndustryOpen} onOpenChange={setIsIndustryOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[150px] justify-between bg-background border-border text-foreground hover:bg-accent"
            >
              <span className="truncate">
                {filters.industries && filters.industries.length > 0
                  ? `${filters.industries.length} industr${filters.industries.length > 1 ? 'ies' : 'y'}`
                  : "Industry"}
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0 bg-popover border-border" align="start">
            <div className="p-2 border-b border-border">
              {isAddingIndustry ? (
                <div className="flex gap-1">
                  <Input
                    value={newIndustryName}
                    onChange={(e) => setNewIndustryName(e.target.value)}
                    placeholder="New industry..."
                    className="h-8 text-sm bg-background border-border"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddNewIndustry();
                      if (e.key === 'Escape') { setIsAddingIndustry(false); setNewIndustryName(''); }
                    }}
                  />
                  <Button size="sm" onClick={handleAddNewIndustry} className="h-8 px-2">
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setIsAddingIndustry(false); setNewIndustryName(''); }} className="h-8 px-2">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-primary hover:text-primary"
                  onClick={() => setIsAddingIndustry(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add new industry
                </Button>
              )}
            </div>
            <ScrollArea className="h-[200px]">
              <div className="p-2 space-y-1">
                {industries.map((ind) => (
                  <div
                    key={ind}
                    className="flex items-center space-x-2 p-2 rounded hover:bg-accent cursor-pointer group"
                    onClick={() => handleIndustryToggle(ind)}
                  >
                    <Checkbox
                      checked={filters.industries?.includes(ind) || false}
                      onCheckedChange={() => handleIndustryToggle(ind)}
                    />
                    <span className="text-sm text-foreground flex-1">{ind}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (removeCustomType('customIndustries', ind, DEFAULT_INDUSTRIES)) {
                          setIndustries(prev => prev.filter(i => i !== ind));
                          onFilterChange('industries', (filters.industries || []).filter(i => i !== ind));
                        }
                      }}
                      title="Remove industry"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {filters.industries && filters.industries.length > 0 && (
              <div className="p-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-foreground"
                  onClick={() => onFilterChange('industries', [])}
                >
                  Clear selection
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4 mr-2" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
