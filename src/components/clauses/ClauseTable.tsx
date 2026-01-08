import { useState, useCallback, useRef, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2, ChevronDown, ChevronUp, GripVertical, Check, X, ArrowUpDown, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import type { Clause, ClauseFormData } from "@/types/clause";

const DEFAULT_CLAUSE_TYPES = ["Net-Payment", "Indemnity", "Confidentiality", "Limitation of Liability", "Termination", "Force Majeure", "Non-Compete", "IP Rights", "Warranty", "Dispute Resolution", "General Clause", "Indemnification", "Payment Terms", "Governing Law", "Anti-Assignment", "Notice Period", "Parties", "Document Name"];
const DEFAULT_CONTRACT_TYPES = ["SaaS Agreement", "Master Services Agreement", "NDA", "Employment Agreement", "Vendor Agreement", "License Agreement", "Partnership Agreement", "Extracted Document"];
const PARTY_ROLES = ["Customer", "Vendor", "Neutral"];
const DEFAULT_INDUSTRIES = ["Technology", "Healthcare", "Finance", "Manufacturing", "Retail", "Legal", "General"];

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

function deleteClauseType(type: string): void {
  try {
    // Remove from custom types if it's there
    const stored = localStorage.getItem('customClauseTypes');
    if (stored) {
      const existing = JSON.parse(stored);
      const filtered = existing.filter((t: string) => t !== type);
      localStorage.setItem('customClauseTypes', JSON.stringify(filtered));
    }
    // Add to deleted types list (to prevent default types from coming back)
    const deletedKey = 'customClauseTypes_deleted';
    const deletedStored = localStorage.getItem(deletedKey);
    const deletedTypes = deletedStored ? JSON.parse(deletedStored) : [];
    if (!deletedTypes.includes(type)) {
      deletedTypes.push(type);
      localStorage.setItem(deletedKey, JSON.stringify(deletedTypes));
    }
  } catch (e) {
    console.error('Error deleting clause type:', e);
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

// Normalize text by removing extra whitespace for display
function normalizeDisplayText(text: string): string {
  if (!text) return text;
  // Convert ALL whitespace characters to regular space first
  let result = text
    .split('')
    .map(char => {
      const code = char.charCodeAt(0);
      // Replace any whitespace-like character (space, tab, various unicode spaces) except newline/carriage return
      if ((code >= 0x0009 && code <= 0x000D && code !== 0x000A && code !== 0x000D) || // tabs, form feed, etc
          code === 0x0020 || // regular space
          code === 0x00A0 || // non-breaking space
          code === 0x1680 || // ogham space
          (code >= 0x2000 && code <= 0x200A) || // various typographic spaces
          code === 0x202F || // narrow no-break space
          code === 0x205F || // medium mathematical space
          code === 0x3000 || // ideographic space
          code === 0xFEFF) { // zero-width no-break space
        return ' ';
      }
      return char;
    })
    .join('');
  // Now collapse multiple spaces into single space
  result = result.replace(/ +/g, ' ');
  // Trim each line
  result = result.split('\n').map(line => line.trim()).join('\n');
  return result.trim();
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

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    'Net-Payment': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'Indemnity': 'bg-red-500/20 text-red-400 border-red-500/30',
    'Indemnification': 'bg-red-500/20 text-red-400 border-red-500/30',
    'Confidentiality': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    'Limitation of Liability': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'Termination': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'Force Majeure': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'Non-Compete': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    'IP Rights': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    'Warranty': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    'Dispute Resolution': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    'General Clause': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  return colors[type] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
};

interface ColumnWidths {
  select: number;
  clauseNo: number;
  type: number;
  subtags: number;
  contract: number;
  documentName: number;
  industry: number;
  text: number;
  actions: number;
}

const defaultColumnWidths: ColumnWidths = {
  select: 50,
  clauseNo: 160,
  type: 140,
  subtags: 180,
  contract: 140,
  documentName: 150,
  industry: 100,
  text: 400,
  actions: 100,
};

const minColumnWidths: ColumnWidths = {
  select: 50,
  clauseNo: 80,
  type: 50,
  subtags: 100,
  contract: 50,
  documentName: 80,
  industry: 50,
  text: 100,
  actions: 80,
};

type SortColumn = 'clause_no' | 'clause_type' | 'contract_type' | 'document_name' | 'industry' | 'clause_text' | null;
type SortDirection = 'asc' | 'desc' | null;

// Editable cell for text inputs
interface EditableTextCellProps {
  value: string;
  onSave: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}

function EditableTextCell({ value, onSave, multiline = false, placeholder = "—" }: EditableTextCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      handleSave();
    } else if (e.key === 'Enter' && multiline && e.ctrlKey) {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        {multiline ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="min-h-[60px] text-sm bg-background border-border"
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="h-8 text-sm bg-background border-border"
          />
        )}
      </div>
    );
  }

  return (
    <span
      onClick={() => {
        setEditValue(value);
        setIsEditing(true);
      }}
      className="cursor-pointer hover:bg-secondary/50 px-1 py-0.5 rounded transition-colors break-words whitespace-normal block min-h-[1.5em]"
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground">{placeholder}</span>}
    </span>
  );
}

// Editable cell for select dropdowns
interface EditableSelectCellProps {
  value: string;
  options: string[];
  onSave: (value: string) => void;
  renderBadge?: (value: string) => React.ReactNode;
  placeholder?: string;
}

function EditableSelectCell({ value, options, onSave, renderBadge, placeholder = "—" }: EditableSelectCellProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (newValue: string) => {
    if (newValue !== value) {
      onSave(newValue);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <Select
        value={value}
        onValueChange={handleChange}
        open={true}
        onOpenChange={(open) => !open && setIsEditing(false)}
      >
        <SelectTrigger className="h-8 text-sm bg-background border-border">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border max-h-[200px]">
          {options.map((option) => (
            <SelectItem key={option} value={option} className="text-foreground hover:bg-accent">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:opacity-80 transition-opacity"
      title="Click to edit"
    >
      {renderBadge ? (
        renderBadge(value)
      ) : (
        <span className="text-foreground/80 whitespace-normal break-words">{value || <span className="text-muted-foreground">{placeholder}</span>}</span>
      )}
    </div>
  );
}

// Multi-select cell for clause types
interface MultiSelectClauseTypeCellProps {
  value: string; // comma-separated values
  options: string[];
  onSave: (value: string) => void;
  getTypeColor: (type: string) => string;
  onDeleteType?: (type: string) => void;
}

function MultiSelectClauseTypeCell({ value, options, onSave, getTypeColor, onDeleteType }: MultiSelectClauseTypeCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newType, setNewType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Parse comma-separated values into array
  const selectedTypes = value ? value.split(',').map(t => t.trim()).filter(Boolean) : [];

  // Filter options based on search query - use options prop directly (parent is source of truth)
  const filteredOptions = options.filter(type =>
    type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggle = (type: string) => {
    let newSelected: string[];
    if (selectedTypes.includes(type)) {
      newSelected = selectedTypes.filter(t => t !== type);
    } else {
      newSelected = [...selectedTypes, type];
    }
    onSave(newSelected.join(', '));
  };

  const handleAddNew = () => {
    if (newType.trim() && !options.includes(newType.trim())) {
      const trimmed = newType.trim();
      // Save to localStorage
      try {
        const stored = localStorage.getItem('customClauseTypes');
        const existing = stored ? JSON.parse(stored) : [];
        if (!existing.includes(trimmed)) {
          existing.push(trimmed);
          localStorage.setItem('customClauseTypes', JSON.stringify(existing));
        }
      } catch (e) {
        console.error('Error saving custom type:', e);
      }
      // Add to selected
      onSave([...selectedTypes, trimmed].join(', '));
      setNewType('');
      setIsAddingNew(false);
      // Notify other components to refresh their types
      window.dispatchEvent(new Event('customTypesUpdated'));
    }
  };

  const handleRemoveType = (typeToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = selectedTypes.filter(t => t !== typeToRemove);
    onSave(newSelected.join(', '));
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) setSearchQuery('');
    }}>
      <PopoverTrigger asChild>
        <div
          className="cursor-pointer hover:opacity-80 transition-opacity min-h-[24px]"
          title="Click to edit clause types"
        >
          {selectedTypes.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedTypes.map((type, idx) => (
                <Badge key={idx} variant="outline" className={`${getTypeColor(type)} border font-medium text-xs group/badge flex items-center gap-1 pr-1`}>
                  {type}
                  <button
                    onClick={(e) => handleRemoveType(type, e)}
                    className="ml-0.5 hover:bg-destructive/20 rounded-full p-0.5 opacity-60 hover:opacity-100 transition-opacity"
                    title={`Remove ${type}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">Select types...</span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b border-border">
          <Input
            placeholder="Search types..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto overflow-x-visible py-2">
          <div className="px-2 space-y-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((type) => (
                <div
                  key={type}
                  className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer min-h-[36px]"
                  onClick={() => handleToggle(type)}
                >
                  <Checkbox
                    checked={selectedTypes.includes(type)}
                    onCheckedChange={() => handleToggle(type)}
                    className="flex-shrink-0"
                  />
                  <span className="text-sm text-foreground flex-1 min-w-0">{type}</span>
                  <button
                    type="button"
                    className="h-6 w-6 flex-shrink-0 flex items-center justify-center rounded text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      // Remove from localStorage (handles both custom and default types)
                      deleteClauseType(type);
                      // Notify parent to remove from all rows and filters
                      if (onDeleteType) {
                        onDeleteType(type);
                      }
                    }}
                    title={`Delete "${type}"`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No matching types</p>
            )}
          </div>
        </div>
        <div className="border-t border-border p-2">
          {isAddingNew ? (
            <div className="flex items-center gap-1">
              <Input
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                placeholder="New type..."
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
              Add new type
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Multiple subtags cell
interface MultiSubtagsCellProps {
  clauseType: string;
  values: string[];
  onSave: (values: string[]) => void;
}

function MultiSubtagsCell({ clauseType, values, onSave }: MultiSubtagsCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newSubtag, setNewSubtag] = useState('');
  const [availableSubtags, setAvailableSubtags] = useState<string[]>(() => loadSubtagsForType(clauseType));

  const handleAddTag = (tag: string) => {
    if (!values.includes(tag)) {
      onSave([...values, tag]);
    }
  };

  const handleRemoveTag = (tag: string) => {
    onSave(values.filter(v => v !== tag));
  };

  const handleAddNew = () => {
    if (newSubtag.trim()) {
      const trimmed = newSubtag.trim();
      saveSubtagForType(clauseType, trimmed);
      setAvailableSubtags(prev => [...prev, trimmed]);
      handleAddTag(trimmed);
      setNewSubtag('');
      setIsAdding(false);
    }
  };

  if (isAdding) {
    return (
      <div className="flex flex-col gap-1">
        <Input
          value={newSubtag}
          onChange={(e) => setNewSubtag(e.target.value)}
          placeholder="New tag..."
          className="h-7 text-xs bg-background border-border"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddNew();
            if (e.key === 'Escape') { setIsAdding(false); setNewSubtag(''); }
          }}
        />
        <div className="flex gap-1">
          <Button size="sm" onClick={handleAddNew} className="h-6 text-xs px-2">
            <Check className="w-3 h-3 mr-1" />Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewSubtag(''); }} className="h-6 text-xs px-2">
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  if (isEditing) {
    const unusedSubtags = availableSubtags.filter(t => !values.includes(t));
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {values.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs flex items-center gap-1">
              {tag}
              <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => handleRemoveTag(tag)} />
            </Badge>
          ))}
        </div>
        {unusedSubtags.length > 0 && (
          <Select onValueChange={handleAddTag}>
            <SelectTrigger className="h-7 text-xs bg-background border-border">
              <SelectValue placeholder="Add tag..." />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border max-h-[150px]">
              {unusedSubtags.map(tag => (
                <SelectItem key={tag} value={tag} className="text-xs">{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setIsAdding(true)} className="h-6 text-xs px-2">
            <Plus className="w-3 h-3 mr-1" />New
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-6 text-xs px-2">
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:bg-secondary/50 px-1 py-0.5 rounded transition-colors min-h-[1.5em]"
      title="Click to edit tags"
    >
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {values.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground text-xs">+ Add tags</span>
      )}
    </div>
  );
}

interface ClauseTableProps {
  clauses: Clause[];
  onEdit: (clause: Clause) => void;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<ClauseFormData>) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  onDocumentClick?: (documentName: string, clauseText: string) => void;
}

export default function ClauseTable({ clauses, onEdit, onDelete, onUpdate, selectedIds = new Set(), onSelectionChange, onDocumentClick }: ClauseTableProps) {
  const [expandedClauses, setExpandedClauses] = useState<Set<string>>(new Set());
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(defaultColumnWidths);
  const [resizingColumn, setResizingColumn] = useState<keyof ColumnWidths | null>(null);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Load custom types (sorted A-Z) - clauseTypes as state so it can be updated
  const [clauseTypes, setClauseTypes] = useState(() =>
    loadCustomTypes('customClauseTypes', DEFAULT_CLAUSE_TYPES).sort((a, b) => a.localeCompare(b))
  );
  const contractTypes = loadCustomTypes('customContractTypes', DEFAULT_CONTRACT_TYPES).sort((a, b) => a.localeCompare(b));
  const industries = loadCustomTypes('customIndustries', DEFAULT_INDUSTRIES).sort((a, b) => a.localeCompare(b));

  // Listen for customTypesUpdated event to sync clause types across all components
  useEffect(() => {
    const refreshClauseTypes = () => {
      setClauseTypes(loadCustomTypes('customClauseTypes', DEFAULT_CLAUSE_TYPES).sort((a, b) => a.localeCompare(b)));
    };
    window.addEventListener('customTypesUpdated', refreshClauseTypes);
    return () => window.removeEventListener('customTypesUpdated', refreshClauseTypes);
  }, []);

  // Handler to delete a clause type globally (from all rows and filters)
  const handleDeleteClauseType = (typeToDelete: string) => {
    // Remove from state
    setClauseTypes(prev => prev.filter(t => t !== typeToDelete));

    // Remove from all clauses that have this type
    clauses.forEach(clause => {
      if (clause.clause_type.includes(typeToDelete)) {
        const currentTypes = clause.clause_type.split(',').map(t => t.trim()).filter(Boolean);
        const newTypes = currentTypes.filter(t => t !== typeToDelete);
        if (newTypes.join(', ') !== clause.clause_type && onUpdate) {
          onUpdate(clause.id, { clause_type: newTypes.join(', ') || 'General Clause' });
        }
      }
    });

    // Dispatch event so ClauseFilters refreshes its list
    window.dispatchEvent(new Event('customTypesUpdated'));
  };

  const toggleExpand = (id: string) => {
    setExpandedClauses(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isExpanded = (id: string) => expandedClauses.has(id);

  const handleCellUpdate = (clauseId: string, field: keyof ClauseFormData, value: any) => {
    if (onUpdate) {
      onUpdate(clauseId, { [field]: value });
    }
  };

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

  // Sort clauses
  let sortedClauses = [...clauses];
  if (sortColumn && sortDirection) {
    sortedClauses.sort((a, b) => {
      let aVal = '';
      let bVal = '';

      switch (sortColumn) {
        case 'clause_no':
          aVal = (a.clause_no || '').toLowerCase();
          bVal = (b.clause_no || '').toLowerCase();
          break;
        case 'clause_type':
          aVal = a.clause_type.toLowerCase();
          bVal = b.clause_type.toLowerCase();
          break;
        case 'contract_type':
          aVal = (a.contract_type || '').toLowerCase();
          bVal = (b.contract_type || '').toLowerCase();
          break;
        case 'document_name':
          aVal = (a.document_name || '').toLowerCase();
          bVal = (b.document_name || '').toLowerCase();
          break;
        case 'industry':
          aVal = (a.industry || '').toLowerCase();
          bVal = (b.industry || '').toLowerCase();
          break;
        case 'clause_text':
          aVal = a.clause_text.toLowerCase();
          bVal = b.clause_text.toLowerCase();
          break;
      }

      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
  }

  const handleResizeStart = useCallback((column: keyof ColumnWidths, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(column);

    const startX = e.clientX;
    const startWidth = columnWidths[column];
    const minWidth = minColumnWidths[column];

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.max(minWidth, Math.min(600, startWidth + delta));
      setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths]);

  const ResizeHandle = ({ column }: { column: keyof ColumnWidths }) => (
    <div
      onMouseDown={(e) => handleResizeStart(column, e)}
      className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize flex items-center justify-center transition-colors z-10 ${
        resizingColumn === column ? 'bg-purple-500' : 'hover:bg-purple-500/50'
      }`}
    >
      <GripVertical className={`w-3 h-3 ${resizingColumn === column ? 'text-white' : 'text-purple-400'}`} />
    </div>
  );

  // Selection handlers
  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (selectedIds.size === sortedClauses.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(sortedClauses.map(c => c.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    if (!onSelectionChange) return;
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    onSelectionChange(newSelection);
  };

  const isAllSelected = sortedClauses.length > 0 && selectedIds.size === sortedClauses.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < sortedClauses.length;

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            {onSelectionChange && (
              <TableHead
                className="text-muted-foreground font-medium"
                style={{ width: columnWidths.select, minWidth: columnWidths.select }}
              >
                <Checkbox
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) {
                      (el as any).indeterminate = isIndeterminate;
                    }
                  }}
                  onCheckedChange={handleSelectAll}
                  className="border-muted-foreground"
                />
              </TableHead>
            )}
            <TableHead
              className="text-muted-foreground font-medium relative cursor-pointer select-none"
              style={{ width: columnWidths.clauseNo, minWidth: columnWidths.clauseNo }}
              onClick={() => handleSort('clause_no')}
            >
              <div className="flex items-center whitespace-normal break-words">
                Clause No.
                {getSortIcon('clause_no')}
              </div>
              <ResizeHandle column="clauseNo" />
            </TableHead>
            <TableHead
              className="text-muted-foreground font-medium relative cursor-pointer select-none"
              style={{ width: columnWidths.type, minWidth: columnWidths.type }}
              onClick={() => handleSort('clause_type')}
            >
              <div className="flex items-center whitespace-normal break-words">
                Type
                {getSortIcon('clause_type')}
              </div>
              <ResizeHandle column="type" />
            </TableHead>
            <TableHead
              className="text-muted-foreground font-medium relative"
              style={{ width: columnWidths.subtags, minWidth: columnWidths.subtags }}
            >
              <div className="flex items-center whitespace-normal break-words">
                Tags
              </div>
              <ResizeHandle column="subtags" />
            </TableHead>
            <TableHead
              className="text-muted-foreground font-medium relative cursor-pointer select-none"
              style={{ width: columnWidths.contract, minWidth: columnWidths.contract }}
              onClick={() => handleSort('contract_type')}
            >
              <div className="flex items-center whitespace-normal break-words">
                Contract
                {getSortIcon('contract_type')}
              </div>
              <ResizeHandle column="contract" />
            </TableHead>
            <TableHead
              className="text-muted-foreground font-medium relative cursor-pointer select-none"
              style={{ width: columnWidths.documentName, minWidth: columnWidths.documentName }}
              onClick={() => handleSort('document_name')}
            >
              <div className="flex items-center whitespace-normal break-words">
                Document
                {getSortIcon('document_name')}
              </div>
              <ResizeHandle column="documentName" />
            </TableHead>
            <TableHead
              className="text-muted-foreground font-medium relative cursor-pointer select-none"
              style={{ width: columnWidths.industry, minWidth: columnWidths.industry }}
              onClick={() => handleSort('industry')}
            >
              <div className="flex items-center whitespace-normal break-words">
                Industry
                {getSortIcon('industry')}
              </div>
              <ResizeHandle column="industry" />
            </TableHead>
            <TableHead
              className="text-muted-foreground font-medium relative cursor-pointer select-none"
              style={{ width: columnWidths.text, minWidth: columnWidths.text }}
              onClick={() => handleSort('clause_text')}
            >
              <div className="flex items-center whitespace-normal break-words">
                Clause Text
                {getSortIcon('clause_text')}
              </div>
              <ResizeHandle column="text" />
            </TableHead>
            <TableHead
              className="text-muted-foreground font-medium"
              style={{ width: columnWidths.actions, minWidth: columnWidths.actions }}
            >
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <AnimatePresence>
            {sortedClauses.map((clause, index) => (
              <motion.tr
                key={clause.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.02 }}
                className={`border-border hover:bg-secondary/50 transition-colors ${selectedIds.has(clause.id) ? 'bg-secondary/30' : ''}`}
              >
                {onSelectionChange && (
                  <TableCell
                    className="align-top"
                    style={{ width: columnWidths.select, maxWidth: columnWidths.select }}
                  >
                    <Checkbox
                      checked={selectedIds.has(clause.id)}
                      onCheckedChange={() => handleSelectOne(clause.id)}
                      className="border-muted-foreground"
                    />
                  </TableCell>
                )}
                <TableCell
                  className="align-top overflow-hidden"
                  style={{ width: columnWidths.clauseNo, maxWidth: columnWidths.clauseNo }}
                >
                  {onUpdate ? (
                    <EditableTextCell
                      value={clause.clause_no || ''}
                      onSave={(value) => handleCellUpdate(clause.id, 'clause_no', value)}
                      placeholder="—"
                    />
                  ) : (
                    <span className="text-foreground/80 text-sm break-words whitespace-normal block">
                      {clause.clause_no || '—'}
                    </span>
                  )}
                </TableCell>
                <TableCell
                  className="align-top overflow-hidden"
                  style={{ width: columnWidths.type, maxWidth: columnWidths.type }}
                >
                  {onUpdate ? (
                    <MultiSelectClauseTypeCell
                      value={clause.clause_type}
                      options={clauseTypes}
                      onSave={(value) => handleCellUpdate(clause.id, 'clause_type', value)}
                      getTypeColor={getTypeColor}
                      onDeleteType={handleDeleteClauseType}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {clause.clause_type.split(',').map((type, idx) => (
                        <Badge key={idx} variant="outline" className={`${getTypeColor(type.trim())} border font-medium whitespace-normal break-words text-xs`}>
                          {type.trim()}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell
                  className="align-top overflow-hidden"
                  style={{ width: columnWidths.subtags, maxWidth: columnWidths.subtags }}
                >
                  {onUpdate ? (
                    <MultiSubtagsCell
                      clauseType={clause.clause_type}
                      values={clause.subtags || []}
                      onSave={(values) => handleCellUpdate(clause.id, 'subtags', values)}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(clause.subtags || []).length > 0 ? (
                        clause.subtags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell
                  className="text-foreground/80 align-top"
                  style={{ width: columnWidths.contract, maxWidth: columnWidths.contract }}
                >
                  {onUpdate ? (
                    <EditableSelectCell
                      value={clause.contract_type || ''}
                      options={contractTypes}
                      onSave={(value) => handleCellUpdate(clause.id, 'contract_type', value)}
                      placeholder="—"
                    />
                  ) : (
                    <span className="break-words whitespace-normal block">{clause.contract_type || '—'}</span>
                  )}
                </TableCell>
                <TableCell
                  className="text-foreground/80 align-top overflow-hidden"
                  style={{ width: columnWidths.documentName, maxWidth: columnWidths.documentName }}
                >
                  {clause.document_name && onDocumentClick ? (
                    <span
                      onClick={() => onDocumentClick(clause.document_name!, clause.clause_text)}
                      className="text-sm break-words whitespace-normal block text-primary hover:text-primary/80 cursor-pointer hover:underline transition-colors"
                      title="Click to view document with clause highlighted"
                    >
                      {clause.document_name}
                    </span>
                  ) : onUpdate ? (
                    <EditableTextCell
                      value={clause.document_name || ''}
                      onSave={(value) => handleCellUpdate(clause.id, 'document_name', value)}
                      placeholder="—"
                    />
                  ) : (
                    <span className="text-sm break-words whitespace-normal block">{clause.document_name || '—'}</span>
                  )}
                </TableCell>
                <TableCell
                  className="text-foreground/80 align-top overflow-hidden"
                  style={{ width: columnWidths.industry, maxWidth: columnWidths.industry }}
                >
                  {onUpdate ? (
                    <EditableSelectCell
                      value={clause.industry || ''}
                      options={industries}
                      onSave={(value) => handleCellUpdate(clause.id, 'industry', value)}
                      placeholder="—"
                    />
                  ) : (
                    <span className="break-words whitespace-normal block">{clause.industry || '—'}</span>
                  )}
                </TableCell>
                <TableCell
                  className="align-top"
                  style={{ width: columnWidths.text, minWidth: columnWidths.text }}
                >
                  <div style={{ maxWidth: columnWidths.text }}>
                    {onUpdate ? (
                      <>
                        <motion.div
                          initial={false}
                          animate={{ height: 'auto' }}
                          className="overflow-hidden"
                        >
                          <div
                            onClick={() => toggleExpand(clause.id)}
                            className={`text-foreground/80 text-sm whitespace-normal cursor-pointer hover:bg-secondary/30 p-1 rounded transition-colors ${
                              !isExpanded(clause.id) ? 'line-clamp-2' : ''
                            }`}
                            title="Click to expand/collapse, double-click to edit"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              onEdit(clause);
                            }}
                          >
                            {normalizeDisplayText(clause.clause_text)}
                          </div>
                        </motion.div>
                        {clause.clause_text.length > 100 && (
                          <button
                            onClick={() => toggleExpand(clause.id)}
                            className="flex items-center gap-1 mt-1 text-xs text-primary hover:text-primary/80 transition-colors"
                          >
                            {isExpanded(clause.id) ? (
                              <>
                                <ChevronUp className="w-3 h-3" />
                                Show less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3" />
                                Show more
                              </>
                            )}
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <motion.div
                          initial={false}
                          animate={{ height: 'auto' }}
                          className="overflow-hidden"
                        >
                          <p className={`text-foreground/80 text-sm whitespace-normal ${
                            !isExpanded(clause.id) ? 'line-clamp-2' : ''
                          }`}>
                            {normalizeDisplayText(clause.clause_text)}
                          </p>
                        </motion.div>
                        {clause.clause_text.length > 100 && (
                          <button
                            onClick={() => toggleExpand(clause.id)}
                            className="flex items-center gap-1 mt-1 text-xs text-primary hover:text-primary/80 transition-colors"
                          >
                            {isExpanded(clause.id) ? (
                              <>
                                <ChevronUp className="w-3 h-3" />
                                Show less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3" />
                                Show more
                              </>
                            )}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell
                  className="align-top"
                  style={{ width: columnWidths.actions, minWidth: columnWidths.actions }}
                >
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(clause)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="Edit full form"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(clause.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </motion.tr>
            ))}
          </AnimatePresence>
          {clauses.length === 0 && (
            <TableRow>
              <TableCell colSpan={onSelectionChange ? 9 : 8} className="h-32 text-center text-muted-foreground">
                No clauses found. Add your first clause to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
