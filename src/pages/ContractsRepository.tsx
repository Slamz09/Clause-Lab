import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Plus, FileText, Tag, Sparkles, Building2, Check, X, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Scale, ListPlus, Eye, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { database } from "@/services/database";
import type { Contract } from "@/types/contract";
import { format } from "date-fns";
import { toast } from "sonner";
import { extractTextFromPDF } from "@/services/pdfParser";

const DEFAULT_CONTRACT_TYPES = ["SaaS Agreement", "Master Services Agreement", "NDA", "Employment Agreement", "Vendor Agreement", "License Agreement", "Partnership Agreement", "Reseller Agreement", "Distribution Agreement", "Consulting Agreement", "MSA", "SOW", "Draft"];
const DEFAULT_INDUSTRIES = ["Technology", "Healthcare", "Finance", "Manufacturing", "Retail", "Legal", "General"];
const DEFAULT_GOVERNING_LAWS = ["New York", "Delaware", "California", "Texas", "Illinois", "Florida", "England and Wales", "Singapore", "Hong Kong", "Other"];

function loadCustomTypes(key: string, defaults: string[]): string[] {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const custom = JSON.parse(stored);
      return [...new Set([...defaults, ...custom])];
    }
  } catch (e) {
    console.error('Error loading custom types:', e);
  }
  return defaults;
}

function saveCustomType(key: string, value: string, defaults: string[]): void {
  try {
    const stored = localStorage.getItem(key);
    const existing = stored ? JSON.parse(stored) : [];
    if (!defaults.includes(value) && !existing.includes(value)) {
      existing.push(value);
      localStorage.setItem(key, JSON.stringify(existing));
    }
  } catch (e) {
    console.error('Error saving custom type:', e);
  }
}

function removeCustomType(key: string, value: string, defaults: string[]): boolean {
  // Can only remove custom types, not defaults
  if (defaults.includes(value)) {
    return false;
  }
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const existing = JSON.parse(stored);
      const filtered = existing.filter((t: string) => t !== value);
      localStorage.setItem(key, JSON.stringify(filtered));
      return true;
    }
  } catch (e) {
    console.error('Error removing custom type:', e);
  }
  return false;
}

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'contract_id' | 'contract_name' | 'contract_type' | 'industry' | 'governing_law' | 'date_added' | null;

// Multi-select cell component with search
interface MultiSelectCellProps {
  value: string;
  options: string[];
  onSave: (value: string) => void;
  placeholder?: string;
  colorClass?: string;
  storageKey: string;
  defaults: string[];
  onOptionsChange: (options: string[]) => void;
}

function MultiSelectCell({ value, options, onSave, placeholder = "Select...", colorClass = "text-foreground", storageKey, defaults, onOptionsChange }: MultiSelectCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState('');

  const selectedItems = value ? value.split(',').map(t => t.trim()).filter(Boolean) : [];

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (item: string) => {
    let newSelected: string[];
    if (selectedItems.includes(item)) {
      newSelected = selectedItems.filter(t => t !== item);
    } else {
      newSelected = [...selectedItems, item];
    }
    onSave(newSelected.join(', '));
  };

  const handleRemove = (item: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = selectedItems.filter(t => t !== item);
    onSave(newSelected.join(', '));
  };

  const handleAddNew = () => {
    if (newItem.trim() && !options.includes(newItem.trim())) {
      const trimmed = newItem.trim();
      saveCustomType(storageKey, trimmed, defaults);
      onOptionsChange([...options, trimmed].sort((a, b) => a.localeCompare(b)));
      onSave([...selectedItems, trimmed].join(', '));
      setNewItem('');
      setIsAddingNew(false);
      toast.success(`Added "${trimmed}"`);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) setSearchQuery('');
    }}>
      <PopoverTrigger asChild>
        <div
          className="cursor-pointer hover:opacity-80 transition-opacity min-h-[32px] flex items-center"
          title="Click to edit"
        >
          {selectedItems.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedItems.map((item, idx) => (
                <span key={idx} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-secondary ${colorClass}`}>
                  {item}
                  <button
                    onClick={(e) => handleRemove(item, e)}
                    className="hover:bg-destructive/20 rounded-full p-0.5 opacity-60 hover:opacity-100"
                    title={`Remove ${item}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">{placeholder}</span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b border-border">
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <ScrollArea className="h-[200px]">
          <div className="p-2 space-y-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt}
                  className="flex items-center space-x-2 p-2 rounded hover:bg-accent cursor-pointer"
                  onClick={() => handleToggle(opt)}
                >
                  <Checkbox
                    checked={selectedItems.includes(opt)}
                    onCheckedChange={() => handleToggle(opt)}
                  />
                  <span className="text-sm text-foreground flex-1">{opt}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No matches</p>
            )}
          </div>
        </ScrollArea>
        <div className="border-t border-border p-2">
          {isAddingNew ? (
            <div className="flex items-center gap-1">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="New item..."
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddNew();
                  if (e.key === 'Escape') setIsAddingNew(false);
                }}
              />
              <Button size="sm" variant="ghost" onClick={handleAddNew} className="h-8 px-2">
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsAddingNew(false)} className="h-8 px-2">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={() => setIsAddingNew(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add new
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ColumnWidth {
  select: number;
  contract_id: number;
  contract_type: number;
  industry: number;
  governing_law: number;
  date_added: number;
  contract_name: number;
  actions: number;
}

// List management types
interface ContractList {
  id: string;
  name: string;
  contractIds: string[];
  createdAt: string;
}

function loadContractLists(): ContractList[] {
  try {
    const stored = localStorage.getItem('contractLists');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveContractLists(lists: ContractList[]) {
  localStorage.setItem('contractLists', JSON.stringify(lists));
}

export default function ContractsRepository() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterContractTypes, setFilterContractTypes] = useState<string[]>([]);
  const [filterIndustries, setFilterIndustries] = useState<string[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Multi-select filter state
  const [isContractTypeFilterOpen, setIsContractTypeFilterOpen] = useState(false);
  const [isIndustryFilterOpen, setIsIndustryFilterOpen] = useState(false);
  const [isAddingFilterContractType, setIsAddingFilterContractType] = useState(false);
  const [newFilterContractType, setNewFilterContractType] = useState('');
  const [isAddingFilterIndustry, setIsAddingFilterIndustry] = useState(false);
  const [newFilterIndustry, setNewFilterIndustry] = useState('');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(540);
  const [isResizing, setIsResizing] = useState(false);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Column resizing state
  const [columnWidths, setColumnWidths] = useState<ColumnWidth>({
    select: 50,
    contract_id: 80,
    contract_type: 160,
    industry: 140,
    governing_law: 140,
    date_added: 120,
    contract_name: 200,
    actions: 100,
  });

  // Selection state
  const [selectedContractIds, setSelectedContractIds] = useState<Set<string>>(new Set());

  // List management state
  const [contractLists, setContractLists] = useState<ContractList[]>(loadContractLists);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isListManagerOpen, setIsListManagerOpen] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [resizingColumn, setResizingColumn] = useState<keyof ColumnWidth | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // Editing state for inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Custom types (sorted A-Z)
  const [contractTypes, setContractTypes] = useState<string[]>(() => loadCustomTypes('customContractTypes', DEFAULT_CONTRACT_TYPES).sort((a, b) => a.localeCompare(b)));
  const [industries, setIndustries] = useState<string[]>(() => loadCustomTypes('customIndustries', DEFAULT_INDUSTRIES).sort((a, b) => a.localeCompare(b)));
  const [governingLaws, setGoverningLaws] = useState<string[]>(() => loadCustomTypes('customGoverningLaws', DEFAULT_GOVERNING_LAWS).sort((a, b) => a.localeCompare(b)));

  // State for adding new custom types
  const [addingContractTypeForId, setAddingContractTypeForId] = useState<string | null>(null);
  const [newContractType, setNewContractType] = useState<string>("");
  const [addingIndustryForId, setAddingIndustryForId] = useState<string | null>(null);
  const [newIndustry, setNewIndustry] = useState<string>("");
  const [addingGoverningLawForId, setAddingGoverningLawForId] = useState<string | null>(null);
  const [newGoverningLaw, setNewGoverningLaw] = useState<string>("");

  const panelRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setContracts(database.getContracts());
  }, []);

  // Panel resize logic
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.min(Math.max(newWidth, 400), 900));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Column resize logic
  const handleColumnResizeStart = (column: keyof ColumnWidth, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(column);
    setStartX(e.clientX);
    setStartWidth(columnWidths[column]);
  };

  useEffect(() => {
    const handleColumnResize = (e: MouseEvent) => {
      if (!resizingColumn) return;
      const diff = e.clientX - startX;
      const newWidth = Math.max(80, startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }));
    };

    const handleColumnResizeEnd = () => {
      setResizingColumn(null);
    };

    if (resizingColumn) {
      document.addEventListener('mousemove', handleColumnResize);
      document.addEventListener('mouseup', handleColumnResizeEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleColumnResize);
      document.removeEventListener('mouseup', handleColumnResizeEnd);
    };
  }, [resizingColumn, startX, startWidth]);

  // Sorting logic
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    if (sortDirection === 'asc') return <ArrowUp className="w-3 h-3 ml-1 text-primary" />;
    if (sortDirection === 'desc') return <ArrowDown className="w-3 h-3 ml-1 text-primary" />;
    return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
  };

  const handleCreateContract = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.doc,.docx,.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        let content = "";
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          content = await extractTextFromPDF(file);
        } else {
          content = await file.text();
        }

        const newContract = database.createContract({
          contract_name: file.name.replace(/\.[^/.]+$/, ""),
          contract_type: "Draft",
          industry: null,
          governing_law: null,
          date_added: new Date().toISOString(),
          contract_attachment: "",
          file_name: file.name,
          file_content: content
        });

        setContracts(prev => [newContract, ...prev]);
        toast.success("Contract added successfully");
      } catch (error) {
        console.error("Error adding contract:", error);
        toast.error("Failed to process file");
      }
    };
    input.click();
  };

  const handleAutoExtract = async (contract: Contract) => {
    if (!contract.file_content) {
      toast.error("No file content found for extraction");
      return;
    }

    toast.info("Extracting information...");

    const text = contract.file_content;
    let extractedType = contract.contract_type;
    let extractedGoverningLaw = contract.governing_law;

    const types = ["MSA", "SOW", "NDA", "SaaS", "License", "Employment", "Partnership"];
    for (const type of types) {
      if (text.toLowerCase().includes(type.toLowerCase())) {
        extractedType = type;
        break;
      }
    }

    // Extract governing law
    const governingLawPatterns = [
      /governed by.*?(?:laws? of|law of)\s+(?:the\s+)?(?:State of\s+)?([A-Z][a-zA-Z\s]+?)(?:\.|,|\s+and)/i,
      /(?:laws? of|law of)\s+(?:the\s+)?(?:State of\s+)?([A-Z][a-zA-Z\s]+?)(?:\s+shall govern|\s+will govern)/i,
      /construed.*?(?:laws? of|law of)\s+(?:the\s+)?(?:State of\s+)?([A-Z][a-zA-Z\s]+?)(?:\.|,)/i,
    ];

    for (const pattern of governingLawPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        extractedGoverningLaw = match[1].trim();
        break;
      }
    }

    const updated = database.updateContract(contract.id, {
      contract_type: extractedType,
      governing_law: extractedGoverningLaw
    });

    if (updated) {
      setContracts(database.getContracts());
      setSelectedContract(updated);
      toast.success("Extraction complete");
    }
  };

  // Inline editing handlers
  const startEditing = (contractId: string, field: string, currentValue: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingId(contractId);
    setEditingField(field);
    setEditValue(currentValue || "");
  };

  const saveEdit = (contractId: string) => {
    if (!editingField) return;

    const updates: any = {};
    if (editingField === 'contract_name') updates.contract_name = editValue;
    if (editingField === 'contract_type') updates.contract_type = editValue;
    if (editingField === 'industry') updates.industry = editValue || null;
    if (editingField === 'governing_law') updates.governing_law = editValue || null;
    if (editingField === 'date_added') {
      try {
        updates.date_added = new Date(editValue).toISOString();
      } catch {
        toast.error("Invalid date format");
        return;
      }
    }

    const updated = database.updateContract(contractId, updates);
    if (updated) {
      setContracts(database.getContracts());
      if (selectedContract?.id === contractId) {
        setSelectedContract(updated);
      }
      toast.success("Updated successfully");
    }

    cancelEdit();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingField(null);
    setEditValue("");
  };

  const handleSelectChange = (contractId: string, field: string, value: string) => {
    const updates: any = {};
    if (field === 'contract_type') updates.contract_type = value;
    if (field === 'industry') updates.industry = value || null;
    if (field === 'governing_law') updates.governing_law = value || null;

    const updated = database.updateContract(contractId, updates);
    if (updated) {
      setContracts(database.getContracts());
      if (selectedContract?.id === contractId) {
        setSelectedContract(updated);
      }
      toast.success("Updated successfully");
    }
  };

  const handleAddNewContractType = (contractId: string) => {
    if (newContractType.trim()) {
      const value = newContractType.trim();
      saveCustomType('customContractTypes', value, DEFAULT_CONTRACT_TYPES);
      setContractTypes(prev => [...new Set([...prev, value])].sort((a, b) => a.localeCompare(b)));
      handleSelectChange(contractId, 'contract_type', value);
      setNewContractType('');
      setAddingContractTypeForId(null);
      toast.success(`Added contract type: ${value}`);
    }
  };

  const handleAddNewIndustry = (contractId: string) => {
    if (newIndustry.trim()) {
      const value = newIndustry.trim();
      saveCustomType('customIndustries', value, DEFAULT_INDUSTRIES);
      setIndustries(prev => [...new Set([...prev, value])].sort((a, b) => a.localeCompare(b)));
      handleSelectChange(contractId, 'industry', value);
      setNewIndustry('');
      setAddingIndustryForId(null);
      toast.success(`Added industry: ${value}`);
    }
  };

  const handleAddNewGoverningLaw = (contractId: string) => {
    if (newGoverningLaw.trim()) {
      const value = newGoverningLaw.trim();
      saveCustomType('customGoverningLaws', value, DEFAULT_GOVERNING_LAWS);
      setGoverningLaws(prev => [...new Set([...prev, value])].sort((a, b) => a.localeCompare(b)));
      handleSelectChange(contractId, 'governing_law', value);
      setNewGoverningLaw('');
      setAddingGoverningLawForId(null);
      toast.success(`Added governing law: ${value}`);
    }
  };

  const handleDeleteContract = (contractId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this contract?")) {
      database.deleteContract(contractId);
      setContracts(database.getContracts());
      if (selectedContract?.id === contractId) {
        setSelectedContract(null);
        setIsSidePanelOpen(false);
      }
      toast.success("Contract deleted");
    }
  };

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedContractIds.size === filteredContracts.length) {
      setSelectedContractIds(new Set());
    } else {
      setSelectedContractIds(new Set(filteredContracts.map(c => c.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelection = new Set(selectedContractIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedContractIds(newSelection);
  };

  // List management handlers
  const handleCreateList = () => {
    if (!newListName.trim()) return;
    if (selectedContractIds.size === 0) {
      toast.error("No contracts selected");
      return;
    }

    const newList: ContractList = {
      id: crypto.randomUUID(),
      name: newListName.trim(),
      contractIds: Array.from(selectedContractIds),
      createdAt: new Date().toISOString()
    };

    const updatedLists = [...contractLists, newList];
    setContractLists(updatedLists);
    saveContractLists(updatedLists);

    toast.success(`List "${newList.name}" created with ${newList.contractIds.length} contracts`);
    setNewListName('');
    setIsCreateListOpen(false);
    setSelectedContractIds(new Set());
  };

  const handleDeleteList = (listId: string) => {
    const listToDelete = contractLists.find(l => l.id === listId);
    const updatedLists = contractLists.filter(l => l.id !== listId);
    setContractLists(updatedLists);
    saveContractLists(updatedLists);
    if (activeListId === listId) {
      setActiveListId(null);
    }
    toast.success(`List "${listToDelete?.name}" deleted`);
  };

  const handleLoadList = (listId: string) => {
    setActiveListId(listId);
    setIsListManagerOpen(false);
    const list = contractLists.find(l => l.id === listId);
    if (list) {
      toast.success(`Showing ${list.contractIds.length} contracts from "${list.name}"`);
    }
  };

  const handleClearActiveList = () => {
    setActiveListId(null);
    toast.success("Showing all contracts");
  };

  // Filter and sort contracts
  let filteredContracts = contracts.filter(c => {
    // Search filter
    const matchesSearch = !searchQuery ||
      c.contract_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contract_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.industry?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.governing_law?.toLowerCase().includes(searchQuery.toLowerCase()));

    // Contract type multi-select filter
    const matchesContractType = filterContractTypes.length === 0 ||
      filterContractTypes.some(ft => c.contract_type === ft || c.contract_type.toLowerCase().includes(ft.toLowerCase()));

    // Industry multi-select filter
    const matchesIndustry = filterIndustries.length === 0 ||
      filterIndustries.some(fi => c.industry === fi || c.industry?.toLowerCase().includes(fi.toLowerCase()));

    return matchesSearch && matchesContractType && matchesIndustry;
  });

  // Apply active list filter
  if (activeListId) {
    const activeList = contractLists.find(l => l.id === activeListId);
    if (activeList) {
      filteredContracts = filteredContracts.filter(c => activeList.contractIds.includes(c.id));
    }
  }

  const activeList = activeListId ? contractLists.find(l => l.id === activeListId) : null;

  // Apply sorting
  if (sortColumn && sortDirection) {
    filteredContracts = [...filteredContracts].sort((a, b) => {
      // Handle numeric sorting for contract_id
      if (sortColumn === 'contract_id') {
        const aNum = a.contract_no || 0;
        const bNum = b.contract_no || 0;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      let aVal = '';
      let bVal = '';

      switch (sortColumn) {
        case 'contract_name':
          aVal = (a.file_name || a.contract_name || '').toLowerCase();
          bVal = (b.file_name || b.contract_name || '').toLowerCase();
          break;
        case 'contract_type':
          aVal = a.contract_type.toLowerCase();
          bVal = b.contract_type.toLowerCase();
          break;
        case 'industry':
          aVal = (a.industry || '').toLowerCase();
          bVal = (b.industry || '').toLowerCase();
          break;
        case 'governing_law':
          aVal = (a.governing_law || '').toLowerCase();
          bVal = (b.governing_law || '').toLowerCase();
          break;
        case 'date_added':
          aVal = a.date_added;
          bVal = b.date_added;
          break;
      }

      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
  }

  const ResizeHandle = ({ column }: { column: keyof ColumnWidth }) => (
    <div
      className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/50 bg-border/30 transition-colors z-10"
      onMouseDown={(e) => handleColumnResizeStart(column, e)}
    />
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Contracts Repository</h1>
          <p className="text-sm text-muted-foreground">
            {contracts.length} contract{contracts.length !== 1 ? 's' : ''} • {filteredContracts.length} shown
            {activeList && (
              <span className="ml-2 text-primary">
                • Viewing list: "{activeList.name}"
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeList && (
            <Button
              variant="outline"
              onClick={handleClearActiveList}
              className="border-primary/50 text-primary"
            >
              Clear List Filter
            </Button>
          )}
          <Button onClick={handleCreateContract} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Contract
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, type, industry, or governing law..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Contract Type Multi-Select Filter */}
        <Popover open={isContractTypeFilterOpen} onOpenChange={setIsContractTypeFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[180px] justify-between bg-background border-border text-foreground hover:bg-accent"
            >
              <span className="truncate">
                {filterContractTypes.length > 0
                  ? `${filterContractTypes.length} contract type${filterContractTypes.length > 1 ? 's' : ''}`
                  : "Contract Type"}
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0 bg-popover border-border" align="start">
            <div className="p-2 border-b border-border">
              {isAddingFilterContractType ? (
                <div className="flex gap-1">
                  <Input
                    value={newFilterContractType}
                    onChange={(e) => setNewFilterContractType(e.target.value)}
                    placeholder="New contract type..."
                    className="h-8 text-sm bg-background border-border"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newFilterContractType.trim()) {
                        saveCustomType('customContractTypes', newFilterContractType.trim());
                        setFilterContractTypes(prev => [...prev, newFilterContractType.trim()]);
                        setNewFilterContractType('');
                        setIsAddingFilterContractType(false);
                      }
                      if (e.key === 'Escape') { setIsAddingFilterContractType(false); setNewFilterContractType(''); }
                    }}
                  />
                  <Button size="sm" onClick={() => {
                    if (newFilterContractType.trim()) {
                      saveCustomType('customContractTypes', newFilterContractType.trim());
                      setFilterContractTypes(prev => [...prev, newFilterContractType.trim()]);
                      setNewFilterContractType('');
                      setIsAddingFilterContractType(false);
                    }
                  }} className="h-8 px-2">
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setIsAddingFilterContractType(false); setNewFilterContractType(''); }} className="h-8 px-2">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-primary hover:text-primary"
                  onClick={() => setIsAddingFilterContractType(true)}
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
                    onClick={() => {
                      if (filterContractTypes.includes(type)) {
                        setFilterContractTypes(prev => prev.filter(t => t !== type));
                      } else {
                        setFilterContractTypes(prev => [...prev, type]);
                      }
                    }}
                  >
                    <Checkbox
                      checked={filterContractTypes.includes(type)}
                      onCheckedChange={() => {
                        if (filterContractTypes.includes(type)) {
                          setFilterContractTypes(prev => prev.filter(t => t !== type));
                        } else {
                          setFilterContractTypes(prev => [...prev, type]);
                        }
                      }}
                    />
                    <span className="text-sm text-foreground flex-1">{type}</span>
                    {!DEFAULT_CONTRACT_TYPES.includes(type) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (removeCustomType('customContractTypes', type, DEFAULT_CONTRACT_TYPES)) {
                            setContractTypes(prev => prev.filter(t => t !== type));
                            setFilterContractTypes(prev => prev.filter(t => t !== type));
                            toast.success(`Removed "${type}"`);
                          }
                        }}
                        title="Remove custom type"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            {filterContractTypes.length > 0 && (
              <div className="p-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-foreground"
                  onClick={() => setFilterContractTypes([])}
                >
                  Clear selection
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Industry Multi-Select Filter */}
        <Popover open={isIndustryFilterOpen} onOpenChange={setIsIndustryFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[150px] justify-between bg-background border-border text-foreground hover:bg-accent"
            >
              <span className="truncate">
                {filterIndustries.length > 0
                  ? `${filterIndustries.length} industr${filterIndustries.length > 1 ? 'ies' : 'y'}`
                  : "Industry"}
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0 bg-popover border-border" align="start">
            <div className="p-2 border-b border-border">
              {isAddingFilterIndustry ? (
                <div className="flex gap-1">
                  <Input
                    value={newFilterIndustry}
                    onChange={(e) => setNewFilterIndustry(e.target.value)}
                    placeholder="New industry..."
                    className="h-8 text-sm bg-background border-border"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newFilterIndustry.trim()) {
                        saveCustomType('customIndustries', newFilterIndustry.trim());
                        setFilterIndustries(prev => [...prev, newFilterIndustry.trim()]);
                        setNewFilterIndustry('');
                        setIsAddingFilterIndustry(false);
                      }
                      if (e.key === 'Escape') { setIsAddingFilterIndustry(false); setNewFilterIndustry(''); }
                    }}
                  />
                  <Button size="sm" onClick={() => {
                    if (newFilterIndustry.trim()) {
                      saveCustomType('customIndustries', newFilterIndustry.trim());
                      setFilterIndustries(prev => [...prev, newFilterIndustry.trim()]);
                      setNewFilterIndustry('');
                      setIsAddingFilterIndustry(false);
                    }
                  }} className="h-8 px-2">
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setIsAddingFilterIndustry(false); setNewFilterIndustry(''); }} className="h-8 px-2">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-primary hover:text-primary"
                  onClick={() => setIsAddingFilterIndustry(true)}
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
                    onClick={() => {
                      if (filterIndustries.includes(ind)) {
                        setFilterIndustries(prev => prev.filter(i => i !== ind));
                      } else {
                        setFilterIndustries(prev => [...prev, ind]);
                      }
                    }}
                  >
                    <Checkbox
                      checked={filterIndustries.includes(ind)}
                      onCheckedChange={() => {
                        if (filterIndustries.includes(ind)) {
                          setFilterIndustries(prev => prev.filter(i => i !== ind));
                        } else {
                          setFilterIndustries(prev => [...prev, ind]);
                        }
                      }}
                    />
                    <span className="text-sm text-foreground flex-1">{ind}</span>
                    {!DEFAULT_INDUSTRIES.includes(ind) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (removeCustomType('customIndustries', ind, DEFAULT_INDUSTRIES)) {
                            setIndustries(prev => prev.filter(i => i !== ind));
                            setFilterIndustries(prev => prev.filter(i => i !== ind));
                            toast.success(`Removed "${ind}"`);
                          }
                        }}
                        title="Remove custom industry"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            {filterIndustries.length > 0 && (
              <div className="p-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-foreground"
                  onClick={() => setFilterIndustries([])}
                >
                  Clear selection
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Clear filters button */}
        {(filterContractTypes.length > 0 || filterIndustries.length > 0) && (
          <Button
            variant="ghost"
            onClick={() => {
              setFilterContractTypes([]);
              setFilterIndustries([]);
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-2" />
            Clear filters
          </Button>
        )}

        {contractLists.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => setIsListManagerOpen(true)}
          >
            <ListPlus className="w-4 h-4 mr-2" />
            Lists ({contractLists.length})
          </Button>
        )}
      </div>

      {/* Selection bar */}
      {selectedContractIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg p-3"
        >
          <span className="text-sm text-foreground">
            {selectedContractIds.size} contract{selectedContractIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsCreateListOpen(true)}
            >
              <ListPlus className="w-4 h-4 mr-2" />
              Save to List
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedContractIds(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        </motion.div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead
                  className="text-muted-foreground relative"
                  style={{ width: columnWidths.select, minWidth: 40 }}
                >
                  <Checkbox
                    checked={filteredContracts.length > 0 && selectedContractIds.size === filteredContracts.length}
                    ref={(el) => {
                      if (el) {
                        (el as any).indeterminate = selectedContractIds.size > 0 && selectedContractIds.size < filteredContracts.length;
                      }
                    }}
                    onCheckedChange={handleSelectAll}
                    className="border-muted-foreground"
                  />
                  <ResizeHandle column="select" />
                </TableHead>
                <TableHead
                  className="text-muted-foreground relative cursor-pointer select-none"
                  style={{ width: columnWidths.contract_id, minWidth: 60 }}
                  onClick={() => handleSort('contract_id')}
                >
                  <div className="flex items-center whitespace-normal break-words">
                    ID
                    {getSortIcon('contract_id')}
                  </div>
                  <ResizeHandle column="contract_id" />
                </TableHead>
                <TableHead
                  className="text-muted-foreground relative cursor-pointer select-none"
                  style={{ width: columnWidths.contract_type, minWidth: 80 }}
                  onClick={() => handleSort('contract_type')}
                >
                  <div className="flex items-center whitespace-normal break-words">
                    CONTRACT TYPE
                    {getSortIcon('contract_type')}
                  </div>
                  <ResizeHandle column="contract_type" />
                </TableHead>
                <TableHead
                  className="text-muted-foreground relative cursor-pointer select-none"
                  style={{ width: columnWidths.industry, minWidth: 80 }}
                  onClick={() => handleSort('industry')}
                >
                  <div className="flex items-center whitespace-normal break-words">
                    INDUSTRY
                    {getSortIcon('industry')}
                  </div>
                  <ResizeHandle column="industry" />
                </TableHead>
                <TableHead
                  className="text-muted-foreground relative cursor-pointer select-none"
                  style={{ width: columnWidths.governing_law, minWidth: 80 }}
                  onClick={() => handleSort('governing_law')}
                >
                  <div className="flex items-center whitespace-normal break-words">
                    GOVERNING LAW
                    {getSortIcon('governing_law')}
                  </div>
                  <ResizeHandle column="governing_law" />
                </TableHead>
                <TableHead
                  className="text-muted-foreground relative cursor-pointer select-none"
                  style={{ width: columnWidths.date_added, minWidth: 80 }}
                  onClick={() => handleSort('date_added')}
                >
                  <div className="flex items-center whitespace-normal break-words">
                    DATE ADDED
                    {getSortIcon('date_added')}
                  </div>
                  <ResizeHandle column="date_added" />
                </TableHead>
                <TableHead
                  className="text-muted-foreground relative cursor-pointer select-none"
                  style={{ width: columnWidths.contract_name, minWidth: 80 }}
                  onClick={() => handleSort('contract_name')}
                >
                  <div className="flex items-center whitespace-normal break-words">
                    CONTRACT NAME
                    {getSortIcon('contract_name')}
                  </div>
                  <ResizeHandle column="contract_name" />
                </TableHead>
                <TableHead
                  className="text-muted-foreground relative"
                  style={{ width: columnWidths.actions, minWidth: 60 }}
                >
                  <div className="text-right pr-2">ACTIONS</div>
                  <ResizeHandle column="actions" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.map((contract) => (
                <TableRow
                  key={contract.id}
                  className={`border-border hover:bg-muted/50 cursor-pointer transition-colors ${selectedContractIds.has(contract.id) ? 'bg-secondary/30' : ''}`}
                  onClick={() => {
                    setSelectedContract(contract);
                    setIsSidePanelOpen(true);
                  }}
                >
                  {/* Checkbox */}
                  <TableCell
                    className="overflow-hidden"
                    style={{ width: columnWidths.select, maxWidth: columnWidths.select }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedContractIds.has(contract.id)}
                      onCheckedChange={() => handleSelectOne(contract.id)}
                      className="border-muted-foreground"
                    />
                  </TableCell>
                  {/* Contract ID */}
                  <TableCell
                    className="overflow-hidden font-medium text-primary"
                    style={{ width: columnWidths.contract_id, maxWidth: columnWidths.contract_id }}
                  >
                    <span className="whitespace-normal break-words">
                      {contract.contract_no ? `CTR-${String(contract.contract_no).padStart(4, '0')}` : '—'}
                    </span>
                  </TableCell>
                  {/* Contract Type - Multi-select with Search */}
                  <TableCell
                    className="overflow-hidden"
                    style={{ width: columnWidths.contract_type, maxWidth: columnWidths.contract_type }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MultiSelectCell
                      value={contract.contract_type}
                      options={contractTypes}
                      onSave={(value) => handleSelectChange(contract.id, 'contract_type', value)}
                      placeholder="Select type..."
                      colorClass="text-primary"
                      storageKey="customContractTypes"
                      defaults={DEFAULT_CONTRACT_TYPES}
                      onOptionsChange={setContractTypes}
                    />
                  </TableCell>

                  {/* Industry - Multi-select with Search */}
                  <TableCell
                    className="overflow-hidden"
                    style={{ width: columnWidths.industry, maxWidth: columnWidths.industry }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MultiSelectCell
                      value={contract.industry || ''}
                      options={industries}
                      onSave={(value) => handleSelectChange(contract.id, 'industry', value)}
                      placeholder="Select industry..."
                      colorClass="text-emerald-400"
                      storageKey="customIndustries"
                      defaults={DEFAULT_INDUSTRIES}
                      onOptionsChange={setIndustries}
                    />
                  </TableCell>

                  {/* Governing Law - Multi-select with Search */}
                  <TableCell
                    className="overflow-hidden"
                    style={{ width: columnWidths.governing_law, maxWidth: columnWidths.governing_law }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MultiSelectCell
                      value={contract.governing_law || ''}
                      options={governingLaws}
                      onSave={(value) => handleSelectChange(contract.id, 'governing_law', value)}
                      placeholder="Select law..."
                      colorClass="text-amber-400"
                      storageKey="customGoverningLaws"
                      defaults={DEFAULT_GOVERNING_LAWS}
                      onOptionsChange={setGoverningLaws}
                    />
                  </TableCell>

                  {/* Date Added - Editable */}
                  <TableCell
                    className="text-muted-foreground overflow-hidden"
                    style={{ width: columnWidths.date_added, maxWidth: columnWidths.date_added }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {editingId === contract.id && editingField === 'date_added' ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="date"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-8 bg-background border-border text-sm w-[140px]"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(contract.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                        <Button size="icon" variant="ghost" onClick={() => saveEdit(contract.id)} className="h-7 w-7">
                          <Check className="w-3 h-3 text-emerald-400" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-7 w-7">
                          <X className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <div className="group flex items-center gap-2">
                        <span className="whitespace-normal break-words">{format(new Date(contract.date_added), "MMM d, yyyy")}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          onClick={(e) => startEditing(contract.id, 'date_added', format(new Date(contract.date_added), "yyyy-MM-dd"), e)}
                        >
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    )}
                  </TableCell>

                  {/* Contract Name */}
                  <TableCell className="overflow-hidden" style={{ width: columnWidths.contract_name, maxWidth: columnWidths.contract_name }}>
                    <div className="flex items-center gap-2 text-primary">
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm whitespace-normal break-words">{contract.file_name || contract.contract_name}</span>
                    </div>
                  </TableCell>

                  {/* Actions */}
                  <TableCell
                    className="text-right overflow-hidden"
                    style={{ width: columnWidths.actions, maxWidth: columnWidths.actions }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-primary hover:text-primary/80 hover:bg-primary/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/clauses?document=${encodeURIComponent(contract.file_name || contract.contract_name)}`);
                        }}
                        title="View clauses from this contract"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={(e) => handleDeleteContract(contract.id, e)}
                        title="Delete contract"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredContracts.length === 0 && (
                <TableRow className="border-border">
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    No contracts found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Resizable Side Panel */}
      {isSidePanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setIsSidePanelOpen(false)}>
          <div
            className="absolute inset-0 bg-black/50"
          />
          <div
            ref={panelRef}
            className="relative bg-background border-l border-border text-foreground h-full overflow-hidden flex"
            style={{ width: panelWidth }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Resize Handle */}
            <div
              ref={resizeRef}
              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-primary/30 transition-colors flex items-center justify-center group"
              onMouseDown={handleMouseDown}
            >
              <div className="w-1 h-12 bg-border rounded group-hover:bg-primary transition-colors" />
            </div>

            {/* Panel Content */}
            <div className="flex-1 flex flex-col overflow-hidden ml-2">
              {/* Header */}
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Document Preview
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setIsSidePanelOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Document Preview Only */}
              {selectedContract && (
                <ScrollArea className="flex-1">
                  <div className="p-4 text-sm text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap">
                    {selectedContract.file_content || "No preview available"}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create List Dialog */}
      <Dialog open={isCreateListOpen} onOpenChange={setIsCreateListOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter list name..."
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
              autoFocus
            />
            <p className="text-sm text-muted-foreground mt-2">
              {selectedContractIds.size} contract{selectedContractIds.size > 1 ? 's' : ''} will be added to this list.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateListOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateList} disabled={!newListName.trim()}>
              Create List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* List Manager Dialog */}
      <Dialog open={isListManagerOpen} onOpenChange={setIsListManagerOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Saved Lists</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-[400px] overflow-y-auto">
            {contractLists.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No saved lists yet.</p>
            ) : (
              contractLists.map((list) => (
                <div
                  key={list.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    activeListId === list.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:bg-secondary/50'
                  }`}
                  onClick={() => handleLoadList(list.id)}
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {list.name}
                      {activeListId === list.id && (
                        <span className="ml-2 text-xs text-primary">(Active)</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {list.contractIds.length} contract{list.contractIds.length > 1 ? 's' : ''} • Created {new Date(list.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteList(list.id);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            {activeListId && (
              <Button variant="outline" onClick={handleClearActiveList}>
                Clear Active List
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsListManagerOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
