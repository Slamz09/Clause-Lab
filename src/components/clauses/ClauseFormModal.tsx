import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Plus, Check, ChevronDown, Trash2 } from 'lucide-react';
import type { Clause, ClauseFormData } from "@/types/clause";

const DEFAULT_CLAUSE_TYPES = ["Net-Payment", "Indemnity", "Confidentiality", "Limitation of Liability", "Termination", "Force Majeure", "Non-Compete", "IP Rights", "Warranty", "Dispute Resolution"];
const DEFAULT_CONTRACT_TYPES = ["SaaS Agreement", "Master Services Agreement", "NDA", "Employment Agreement", "Vendor Agreement", "License Agreement", "Partnership Agreement"];
const DEFAULT_INDUSTRIES = ["Technology", "Healthcare", "Finance", "Manufacturing", "Retail", "Legal", "General"];

// Load custom types from localStorage
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

// Save custom type to localStorage and notify other components
function saveCustomType(key: string, value: string, defaults: string[]): void {
  try {
    const stored = localStorage.getItem(key);
    const existing = stored ? JSON.parse(stored) : [];
    if (!defaults.includes(value) && !existing.includes(value)) {
      existing.push(value);
      localStorage.setItem(key, JSON.stringify(existing));
      window.dispatchEvent(new CustomEvent('customTypesUpdated'));
    }
  } catch (e) {
    console.error('Error saving custom type:', e);
  }
}

// Remove custom type from localStorage and notify other components
function removeCustomType(key: string, typeToRemove: string): void {
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
    window.dispatchEvent(new CustomEvent('customTypesUpdated'));
  } catch (e) {
    console.error('Error removing custom type:', e);
  }
}

// Load subtags for a specific clause type
function loadSubtagsForType(clauseType: string): string[] {
  try {
    const stored = localStorage.getItem('clauseSubtags');
    if (stored) {
      const allSubtags = JSON.parse(stored);
      return allSubtags[clauseType] || [];
    }
  } catch (e) {
    console.error('Error loading subtags:', e);
  }
  return [];
}

// Save a new subtag for a specific clause type
function saveSubtagForType(clauseType: string, subtag: string): void {
  try {
    const stored = localStorage.getItem('clauseSubtags');
    const allSubtags = stored ? JSON.parse(stored) : {};
    if (!allSubtags[clauseType]) {
      allSubtags[clauseType] = [];
    }
    if (!allSubtags[clauseType].includes(subtag)) {
      allSubtags[clauseType].push(subtag);
      localStorage.setItem('clauseSubtags', JSON.stringify(allSubtags));
    }
  } catch (e) {
    console.error('Error saving subtag:', e);
  }
}

interface ClauseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ClauseFormData) => void;
  editingClause: Clause | null;
}

const initialFormData: ClauseFormData = {
  clause_type: '',
  subtags: [],
  contract_type: '',
  industry: '',
  clause_text: '',
};

export default function ClauseFormModal({ isOpen, onClose, onSave, editingClause }: ClauseFormModalProps) {
  const [formData, setFormData] = useState<ClauseFormData>(initialFormData);
  const [clauseTypes, setClauseTypes] = useState<string[]>(() => loadCustomTypes('customClauseTypes', DEFAULT_CLAUSE_TYPES));
  const [contractTypes, setContractTypes] = useState<string[]>(() => loadCustomTypes('customContractTypes', DEFAULT_CONTRACT_TYPES));
  const [industries, setIndustries] = useState<string[]>(() => loadCustomTypes('customIndustries', DEFAULT_INDUSTRIES));
  const [availableSubtags, setAvailableSubtags] = useState<string[]>([]);

  const [showNewClauseType, setShowNewClauseType] = useState(false);
  const [showNewContractType, setShowNewContractType] = useState(false);
  const [showNewIndustry, setShowNewIndustry] = useState(false);
  const [showNewSubtag, setShowNewSubtag] = useState(false);
  const [newClauseType, setNewClauseType] = useState('');
  const [newContractType, setNewContractType] = useState('');
  const [newIndustry, setNewIndustry] = useState('');
  const [newSubtag, setNewSubtag] = useState('');
  const [clauseTypeSearchQuery, setClauseTypeSearchQuery] = useState('');
  const [isClauseTypeOpen, setIsClauseTypeOpen] = useState(false);

  // Listen for customTypesUpdated event to sync clause types across all components
  useEffect(() => {
    const refreshTypes = () => {
      setClauseTypes(loadCustomTypes('customClauseTypes', DEFAULT_CLAUSE_TYPES).sort((a, b) => a.localeCompare(b)));
      setContractTypes(loadCustomTypes('customContractTypes', DEFAULT_CONTRACT_TYPES).sort((a, b) => a.localeCompare(b)));
      setIndustries(loadCustomTypes('customIndustries', DEFAULT_INDUSTRIES).sort((a, b) => a.localeCompare(b)));
    };
    window.addEventListener('customTypesUpdated', refreshTypes);
    return () => window.removeEventListener('customTypesUpdated', refreshTypes);
  }, []);

  useEffect(() => {
    if (editingClause) {
      setFormData({
        clause_type: editingClause.clause_type || '',
        subtags: editingClause.subtags || [],
        contract_type: editingClause.contract_type || '',
        industry: editingClause.industry || '',
        clause_text: editingClause.clause_text || '',
      });
      setAvailableSubtags(loadSubtagsForType(editingClause.clause_type || ''));
    } else {
      setFormData(initialFormData);
      setAvailableSubtags([]);
    }
    // Reset add new states
    setShowNewClauseType(false);
    setShowNewContractType(false);
    setShowNewIndustry(false);
    setShowNewSubtag(false);
    setNewClauseType('');
    setNewContractType('');
    setNewIndustry('');
    setNewSubtag('');
  }, [editingClause, isOpen]);

  // Update subtags when clause type changes
  useEffect(() => {
    if (formData.clause_type) {
      setAvailableSubtags(loadSubtagsForType(formData.clause_type));
    } else {
      setAvailableSubtags([]);
    }
  }, [formData.clause_type]);

  const handleAddClauseType = () => {
    if (newClauseType.trim()) {
      const value = newClauseType.trim();
      saveCustomType('customClauseTypes', value, DEFAULT_CLAUSE_TYPES);
      setClauseTypes(prev => [...new Set([...prev, value])]);
      setFormData({ ...formData, clause_type: value, subtags: [] });
      setNewClauseType('');
      setShowNewClauseType(false);
    }
  };

  const handleAddContractType = () => {
    if (newContractType.trim()) {
      const value = newContractType.trim();
      saveCustomType('customContractTypes', value, DEFAULT_CONTRACT_TYPES);
      setContractTypes(prev => [...new Set([...prev, value])]);
      setFormData({ ...formData, contract_type: value });
      setNewContractType('');
      setShowNewContractType(false);
    }
  };

  const handleAddIndustry = () => {
    if (newIndustry.trim()) {
      const value = newIndustry.trim();
      saveCustomType('customIndustries', value, DEFAULT_INDUSTRIES);
      setIndustries(prev => [...new Set([...prev, value])]);
      setFormData({ ...formData, industry: value });
      setNewIndustry('');
      setShowNewIndustry(false);
    }
  };

  const handleAddSubtag = () => {
    if (newSubtag.trim() && formData.clause_type) {
      const value = newSubtag.trim();
      saveSubtagForType(formData.clause_type, value);
      setAvailableSubtags(prev => [...new Set([...prev, value])]);
      const currentSubtags = formData.subtags || [];
      if (!currentSubtags.includes(value)) {
        setFormData({ ...formData, subtags: [...currentSubtags, value] });
      }
      setNewSubtag('');
      setShowNewSubtag(false);
    }
  };

  const handleSelectSubtag = (tag: string) => {
    const currentSubtags = formData.subtags || [];
    if (!currentSubtags.includes(tag)) {
      setFormData({ ...formData, subtags: [...currentSubtags, tag] });
    }
  };

  const handleRemoveSubtag = (tag: string) => {
    const currentSubtags = formData.subtags || [];
    setFormData({ ...formData, subtags: currentSubtags.filter(t => t !== tag) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const unusedSubtags = availableSubtags.filter(t => !(formData.subtags || []).includes(t));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold gradient-text">
            {editingClause ? 'Edit Clause' : 'Add New Clause'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Clause Type */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Clause Type *</Label>
              {showNewClauseType ? (
                <div className="flex gap-2">
                  <Input
                    value={newClauseType}
                    onChange={(e) => setNewClauseType(e.target.value)}
                    placeholder="Enter new type..."
                    className="bg-background border-border text-foreground"
                    autoFocus
                  />
                  <Button type="button" size="icon" onClick={handleAddClauseType} className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => setShowNewClauseType(false)} className="shrink-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Popover open={isClauseTypeOpen} onOpenChange={(open) => {
                    setIsClauseTypeOpen(open);
                    if (!open) setClauseTypeSearchQuery('');
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        type="button"
                        className="w-full justify-between bg-background border-border text-foreground hover:bg-accent"
                      >
                        <span className="truncate">
                          {formData.clause_type || "Select type"}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0 bg-popover border-border" align="start">
                      <div className="p-2 border-b border-border">
                        <Input
                          placeholder="Search types..."
                          value={clauseTypeSearchQuery}
                          onChange={(e) => setClauseTypeSearchQuery(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-[200px] overflow-y-auto py-2">
                        <div className="px-2 space-y-1">
                          {clauseTypes
                            .filter(type => type.toLowerCase().includes(clauseTypeSearchQuery.toLowerCase()))
                            .map((type) => (
                              <div
                                key={type}
                                className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer min-h-[36px]"
                                onClick={() => {
                                  setFormData({ ...formData, clause_type: type, subtags: [] });
                                  setIsClauseTypeOpen(false);
                                  setClauseTypeSearchQuery('');
                                }}
                              >
                                <Checkbox
                                  checked={formData.clause_type === type}
                                  className="flex-shrink-0"
                                />
                                <span className="text-sm text-foreground flex-1 min-w-0">{type}</span>
                                <button
                                  type="button"
                                  className="h-6 w-6 flex-shrink-0 flex items-center justify-center rounded text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Remove from localStorage and notify
                                    removeCustomType('customClauseTypes', type);
                                    // Update local state
                                    setClauseTypes(prev => prev.filter(t => t !== type));
                                    // Clear selection if this was selected
                                    if (formData.clause_type === type) {
                                      setFormData({ ...formData, clause_type: '', subtags: [] });
                                    }
                                  }}
                                  title={`Delete "${type}"`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                      <div className="border-t border-border p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="w-full text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setIsClauseTypeOpen(false);
                            setShowNewClauseType(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add new type
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Subtags (Multiple) */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Subtags</Label>
              <div className="space-y-2">
                {/* Selected subtags */}
                {(formData.subtags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(formData.subtags || []).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs flex items-center gap-1">
                        {tag}
                        <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => handleRemoveSubtag(tag)} />
                      </Badge>
                    ))}
                  </div>
                )}

                {showNewSubtag ? (
                  <div className="flex gap-2">
                    <Input
                      value={newSubtag}
                      onChange={(e) => setNewSubtag(e.target.value)}
                      placeholder="Enter new subtag..."
                      className="bg-background border-border text-foreground"
                      autoFocus
                    />
                    <Button type="button" size="icon" onClick={handleAddSubtag} className="shrink-0">
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => { setShowNewSubtag(false); setNewSubtag(''); }} className="shrink-0">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select
                      value=""
                      onValueChange={handleSelectSubtag}
                      disabled={!formData.clause_type}
                    >
                      <SelectTrigger className="bg-background border-border text-foreground">
                        <SelectValue placeholder={formData.clause_type ? "Add subtag..." : "Select clause type first"} />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {unusedSubtags.map((tag) => (
                          <SelectItem key={tag} value={tag} className="text-foreground hover:bg-accent">
                            {tag}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => setShowNewSubtag(true)}
                      className="shrink-0 border-purple-500/50 text-purple-400 hover:bg-purple-500/20"
                      disabled={!formData.clause_type}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Contract Type */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Contract Type</Label>
              {showNewContractType ? (
                <div className="flex gap-2">
                  <Input
                    value={newContractType}
                    onChange={(e) => setNewContractType(e.target.value)}
                    placeholder="Enter new contract type..."
                    className="bg-background border-border text-foreground"
                    autoFocus
                  />
                  <Button type="button" size="icon" onClick={handleAddContractType} className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => setShowNewContractType(false)} className="shrink-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={formData.contract_type || ''}
                    onValueChange={(value) => setFormData({ ...formData, contract_type: value })}
                  >
                    <SelectTrigger className="bg-background border-border text-foreground">
                      <SelectValue placeholder="Select contract" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {contractTypes.map((type) => (
                        <SelectItem key={type} value={type} className="text-foreground hover:bg-accent">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="outline" onClick={() => setShowNewContractType(true)} className="shrink-0 border-purple-500/50 text-purple-400 hover:bg-purple-500/20">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Industry */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Industry</Label>
              {showNewIndustry ? (
                <div className="flex gap-2">
                  <Input
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                    placeholder="Enter new industry..."
                    className="bg-background border-border text-foreground"
                    autoFocus
                  />
                  <Button type="button" size="icon" onClick={handleAddIndustry} className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => setShowNewIndustry(false)} className="shrink-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={formData.industry || ''}
                    onValueChange={(value) => setFormData({ ...formData, industry: value })}
                  >
                    <SelectTrigger className="bg-background border-border text-foreground">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {industries.map((ind) => (
                        <SelectItem key={ind} value={ind} className="text-foreground hover:bg-accent">
                          {ind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="outline" onClick={() => setShowNewIndustry(true)} className="shrink-0 border-purple-500/50 text-purple-400 hover:bg-purple-500/20">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground">Clause Text *</Label>
            <Textarea
              value={formData.clause_text}
              onChange={(e) => setFormData({ ...formData, clause_text: e.target.value })}
              className="bg-background border-border text-foreground min-h-[120px] resize-y"
              placeholder="Enter the clause text..."
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Save className="w-4 h-4 mr-2" />
              {editingClause ? 'Update Clause' : 'Save Clause'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
