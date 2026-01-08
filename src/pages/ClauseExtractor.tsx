import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, Sparkles, Plus, AlertCircle, Maximize2, Minimize2, CheckCircle2, Database, SaveAll, Building2, Users, X, ChevronDown, ChevronUp, ListOrdered, Settings2, Pencil, Check, FileSignature, Trash2 } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { extractClausesRuleBased, NumberingSchema } from "@/services/ruleBasedExtractor";
import { extractTextFromPDF } from "@/services/pdfParser";
import { database } from "@/services/database";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { Clause } from "@/types/clause";

const DEFAULT_INDUSTRIES = ["Technology", "Healthcare", "Finance", "Manufacturing", "Retail", "Legal", "General"];
const DEFAULT_PARTY_ROLES = ["Customer", "Vendor", "Neutral"];
const DEFAULT_CLAUSE_TYPES = ["Net-Payment", "Indemnity", "Confidentiality", "Limitation of Liability", "Termination", "Force Majeure", "Non-Compete", "IP Rights", "Warranty", "Dispute Resolution", "General Clause", "Indemnification", "Payment Terms", "Governing Law", "Anti-Assignment", "Notice Period", "Parties", "Document Name", "Term and Renewal", "Insurance", "Covenants", "Transferability", "Dispute Resolution", "Miscellaneous"];
const DEFAULT_CONTRACT_TYPES = ["SaaS Agreement", "Master Services Agreement", "NDA", "Employment Agreement", "Vendor Agreement", "License Agreement", "Partnership Agreement", "Reseller Agreement", "Distribution Agreement", "Consulting Agreement"];

// Numbering schema options - grouped by type
const NUMBERING_GROUPS = [
  {
    label: "Special",
    options: [
      { value: "none", label: "None (Skip)" },
      { value: "section", label: "Section 1., Section 2...." },
      { value: "section-decimal", label: "Section 1. (with 1.1, 1.2 subs)" },
      { value: "article", label: "Article I., Article II...." },
    ]
  },
  {
    label: "Numeric (1, 2, 3...)",
    options: [
      { value: "numeric", label: "1. 2. 3." },
      { value: "numeric-paren", label: "1) 2) 3)" },
      { value: "paren-numeric", label: "(1) (2) (3)" },
      { value: "decimal", label: "1.1, 1.2, 2.1..." },
      { value: "decimal-zero", label: "1.0, 2.0, 3.0 (with 1.1, 2.1 subs)" },
      { value: "decimal-triple", label: "1.1.1, 1.2.1, 2.1.1..." },
    ]
  },
  {
    label: "Alphabetic (a, b, c...)",
    options: [
      { value: "alpha-upper", label: "A. B. C." },
      { value: "alpha-lower", label: "a. b. c." },
      { value: "alpha-lower-paren", label: "a) b) c)" },
      { value: "paren-alpha", label: "(a) (b) (c)" },
    ]
  },
  {
    label: "Roman Numerals (I, II, III...)",
    options: [
      { value: "roman-upper", label: "I. II. III." },
      { value: "roman-lower", label: "i. ii. iii." },
      { value: "roman-upper-paren", label: "I) II) III)" },
      { value: "roman-lower-paren", label: "i) ii) iii)" },
      { value: "paren-roman-upper", label: "(I) (II) (III)" },
      { value: "paren-roman-lower", label: "(i) (ii) (iii)" },
    ]
  },
];

// Flat list for lookups
const NUMBERING_OPTIONS = NUMBERING_GROUPS.flatMap(group => group.options);

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
      window.dispatchEvent(new CustomEvent('customTypesUpdated'));
    }
  } catch (e) {
    console.error('Error saving custom type:', e);
  }
}

// Normalize text by removing extra whitespace
function normalizeClauseText(text: string): string {
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

export default function ClauseExtractor() {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedClauses, setExtractedClauses] = useState<any[]>([]);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [repositoryClauses, setRepositoryClauses] = useState<Clause[]>([]);
  const [savedClauseIds, setSavedClauseIds] = useState<Set<number>>(new Set());
  const [selectedIndustry, setSelectedIndustry] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [expandedClauses, setExpandedClauses] = useState<Set<number>>(new Set());
  const [showSchemaSettings, setShowSchemaSettings] = useState(false);
  const [numberingSchema, setNumberingSchema] = useState<NumberingSchema>({
    mainClause: "roman-upper",
    subClause1: "alpha-upper",
    subClause2: "numeric",
    subClause3: "none",
  });

  const toggleClauseExpand = (idx: number) => {
    setExpandedClauses(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // States for adding new options
  const [showNewIndustry, setShowNewIndustry] = useState(false);
  const [showNewRole, setShowNewRole] = useState(false);
  const [showNewContractType, setShowNewContractType] = useState(false);
  const [newIndustry, setNewIndustry] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newContractType, setNewContractType] = useState("");
  const [selectedContractType, setSelectedContractType] = useState<string>("");
  const [uploadedContractId, setUploadedContractId] = useState<string | null>(null);

  // Load custom types
  const [industries, setIndustries] = useState<string[]>(() => loadCustomTypes('customIndustries', DEFAULT_INDUSTRIES));
  const [partyRoles, setPartyRoles] = useState<string[]>(() => loadCustomTypes('customPartyRoles', DEFAULT_PARTY_ROLES));
  const [contractTypes, setContractTypes] = useState<string[]>(() => loadCustomTypes('customContractTypes', DEFAULT_CONTRACT_TYPES));

  // State for editing clause text
  const [editingClauseIdx, setEditingClauseIdx] = useState<number | null>(null);
  const [editingClauseText, setEditingClauseText] = useState<string>("");

  // State for adding new clause type inline
  const [addingClauseTypeIdx, setAddingClauseTypeIdx] = useState<number | null>(null);
  const [newClauseTypeName, setNewClauseTypeName] = useState<string>("");
  const [clauseTypesList, setClauseTypesList] = useState<string[]>(() => loadCustomTypes('customClauseTypes', DEFAULT_CLAUSE_TYPES));

  // State for adding new subtag inline
  const [addingSubtagIdx, setAddingSubtagIdx] = useState<number | null>(null);
  const [newSubtagName, setNewSubtagName] = useState<string>("");

  // State for multi-select
  const [selectedClauseIdxs, setSelectedClauseIdxs] = useState<Set<number>>(new Set());

  // Update a single extracted clause's type
  const handleUpdateClauseType = (idx: number, newType: string) => {
    setExtractedClauses(prev => prev.map((clause, i) =>
      i === idx ? { ...clause, clause_type: newType } : clause
    ));
  };

  // Update a single extracted clause's clause_no
  const handleUpdateClauseNo = (idx: number, newClauseNo: string) => {
    setExtractedClauses(prev => prev.map((clause, i) =>
      i === idx ? { ...clause, clause_no: newClauseNo } : clause
    ));
  };

  // Update a single extracted clause's subtags (add one)
  const handleAddSubtagToClause = (idx: number, newSubtag: string) => {
    setExtractedClauses(prev => prev.map((clause, i) => {
      if (i !== idx) return clause;
      const currentSubtags = clause.subtags || [];
      if (!currentSubtags.includes(newSubtag)) {
        return { ...clause, subtags: [...currentSubtags, newSubtag] };
      }
      return clause;
    }));
  };

  // Remove a subtag from a clause
  const handleRemoveSubtagFromClause = (idx: number, subtagToRemove: string) => {
    setExtractedClauses(prev => prev.map((clause, i) => {
      if (i !== idx) return clause;
      const currentSubtags = clause.subtags || [];
      return { ...clause, subtags: currentSubtags.filter((t: string) => t !== subtagToRemove) };
    }));
  };

  // Add new subtag from extracted clause row
  const handleAddNewSubtag = (idx: number, clauseType: string) => {
    if (newSubtagName.trim() && clauseType) {
      const value = newSubtagName.trim();
      // Save to localStorage for this clause type
      saveSubtagForType(clauseType, value);
      // Add this subtag to the clause
      handleAddSubtagToClause(idx, value);
      // Reset input state
      setNewSubtagName('');
      setAddingSubtagIdx(null);
      toast.success(`Added subtag: ${value}`);
    }
  };

  // Cancel adding new subtag
  const handleCancelAddSubtag = () => {
    setAddingSubtagIdx(null);
    setNewSubtagName('');
  };

  // Start editing clause text
  const handleStartEditText = (idx: number, currentText: string) => {
    setEditingClauseIdx(idx);
    setEditingClauseText(currentText);
  };

  // Save edited clause text
  const handleSaveClauseText = () => {
    if (editingClauseIdx !== null) {
      setExtractedClauses(prev => prev.map((clause, i) =>
        i === editingClauseIdx ? { ...clause, clause_text: editingClauseText } : clause
      ));
      setEditingClauseIdx(null);
      setEditingClauseText("");
    }
  };

  // Cancel editing
  const handleCancelEditText = () => {
    setEditingClauseIdx(null);
    setEditingClauseText("");
  };

  // Add new clause type from extracted clause row
  const handleAddNewClauseType = (idx: number) => {
    if (newClauseTypeName.trim()) {
      const value = newClauseTypeName.trim();
      // Save to localStorage and notify other components
      saveCustomType('customClauseTypes', value, DEFAULT_CLAUSE_TYPES);
      // Update local state
      setClauseTypesList(prev => [...new Set([...prev, value])]);
      // Set this clause's type to the new value
      setExtractedClauses(prev => prev.map((clause, i) =>
        i === idx ? { ...clause, clause_type: value } : clause
      ));
      // Reset input state
      setNewClauseTypeName('');
      setAddingClauseTypeIdx(null);
      toast.success(`Added clause type: ${value}`);
    }
  };

  // Cancel adding new clause type
  const handleCancelAddClauseType = () => {
    setAddingClauseTypeIdx(null);
    setNewClauseTypeName('');
  };

  const handleAddIndustry = () => {
    if (newIndustry.trim()) {
      const value = newIndustry.trim();
      saveCustomType('customIndustries', value, DEFAULT_INDUSTRIES);
      setIndustries(prev => [...new Set([...prev, value])]);
      setSelectedIndustry(value);
      setNewIndustry('');
      setShowNewIndustry(false);
      toast.success(`Added industry: ${value}`);
    }
  };

  const handleAddRole = () => {
    if (newRole.trim()) {
      const value = newRole.trim();
      saveCustomType('customPartyRoles', value, DEFAULT_PARTY_ROLES);
      setPartyRoles(prev => [...new Set([...prev, value])]);
      setSelectedRole(value);
      setNewRole('');
      setShowNewRole(false);
      toast.success(`Added role: ${value}`);
    }
  };

  const handleAddContractType = () => {
    if (newContractType.trim()) {
      const value = newContractType.trim();
      saveCustomType('customContractTypes', value, DEFAULT_CONTRACT_TYPES);
      setContractTypes(prev => [...new Set([...prev, value])]);
      setSelectedContractType(value);
      setNewContractType('');
      setShowNewContractType(false);
      toast.success(`Added contract type: ${value}`);
    }
  };

  // Load repository clauses on mount for cross-matching
  useEffect(() => {
    const clauses = database.getClauses();
    setRepositoryClauses(clauses);
    console.log(`Loaded ${clauses.length} clauses from repository for matching`);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploadedContractId(null); // Reset for new file

    try {
      let content = "";
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        content = await extractTextFromPDF(file);
      } else {
        content = await file.text();
      }

      setFileContent(content);
      toast.success("File uploaded successfully");
    } catch (error) {
      console.error("Error reading file:", error);
      toast.error("Failed to read file content");
    }
  };

  const handleExtract = async () => {
    if (!fileContent) return;

    setIsExtracting(true);
    setSavedClauseIds(new Set()); // Reset saved state for new extraction
    setExpandedClauses(new Set()); // Reset expanded state
    setSelectedClauseIdxs(new Set()); // Reset selection state
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Auto-upload contract to Contracts Repository if not already uploaded
    if (!uploadedContractId && fileName) {
      // Check if document already exists in contracts repository
      const existingContract = database.getContractByDocumentName(fileName);

      if (existingContract) {
        // Document already exists - use existing contract ID, don't create duplicate
        setUploadedContractId(existingContract.id);
        toast.info(`Document "${fileName}" already exists in Contracts Repository`);
      } else {
        // Document doesn't exist - create new contract
        const contractName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
        const newContract = database.createContract({
          contract_name: contractName,
          contract_type: selectedContractType || "Draft",
          industry: selectedIndustry || null,
          date_executed: new Date().toISOString(),
          contract_attachment: "",
          file_name: fileName,
          file_content: fileContent
        });
        setUploadedContractId(newContract.id);
        toast.success("Contract auto-uploaded to Contracts Repository");
      }
    }

    // Pass repository clauses and numbering schema for extraction
    const clauses = extractClausesRuleBased(fileContent, repositoryClauses, numberingSchema);
    // Normalize clause text to remove extra whitespace
    const normalizedClauses = clauses.map((clause: any) => ({
      ...clause,
      clause_text: normalizeClauseText(clause.clause_text)
    }));
    setExtractedClauses(normalizedClauses);
    setIsExtracting(false);

    const repoMatchedCount = normalizedClauses.filter((c: any) => c.matched_from_repository).length;
    toast.success(`Extracted ${normalizedClauses.length} clauses${repoMatchedCount > 0 ? ` (${repoMatchedCount} matched from repository)` : ''}`);
  };

  const handleSaveToRepository = (clause: any, index: number) => {
    if (savedClauseIds.has(index)) {
      toast.info("Clause already saved");
      return;
    }

    database.createClause({
      clause_type: clause.clause_type,
      clause_no: clause.clause_no || null,
      subtags: clause.subtags || [],
      clause_text: clause.clause_text,
      contract_type: selectedContractType || null,
      document_name: fileName || null,
      industry: selectedIndustry || null,
    });

    setSavedClauseIds(prev => new Set([...prev, index]));

    // Refresh repository clauses for future matching
    setRepositoryClauses(database.getClauses());
    toast.success("Clause saved to repository");
  };

  const handleSaveAllToRepository = () => {
    let savedCount = 0;
    extractedClauses.forEach((clause, index) => {
      if (!savedClauseIds.has(index)) {
        database.createClause({
          clause_type: clause.clause_type,
          clause_no: clause.clause_no || null,
          subtags: clause.subtags || [],
          clause_text: clause.clause_text,
          contract_type: selectedContractType || null,
          document_name: fileName || null,
          industry: selectedIndustry || null,
        });
        savedCount++;
      }
    });

    if (savedCount > 0) {
      setSavedClauseIds(new Set(extractedClauses.map((_, i) => i)));
      setRepositoryClauses(database.getClauses());
      toast.success(`Saved ${savedCount} clauses to repository`);
    } else {
      toast.info("All clauses already saved");
    }
  };

  // Selection handlers
  const handleSelectClause = (idx: number) => {
    setSelectedClauseIdxs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedClauseIdxs.size === extractedClauses.length) {
      setSelectedClauseIdxs(new Set());
    } else {
      setSelectedClauseIdxs(new Set(extractedClauses.map((_, i) => i)));
    }
  };

  // Remove a clause from extracted list
  const handleRemoveClause = (idx: number) => {
    setExtractedClauses(prev => prev.filter((_, i) => i !== idx));
    // Update saved IDs to account for removed index
    setSavedClauseIds(prev => {
      const next = new Set<number>();
      prev.forEach(savedIdx => {
        if (savedIdx < idx) {
          next.add(savedIdx);
        } else if (savedIdx > idx) {
          next.add(savedIdx - 1);
        }
        // Skip the removed index
      });
      return next;
    });
    // Update selected IDs
    setSelectedClauseIdxs(prev => {
      const next = new Set<number>();
      prev.forEach(selectedIdx => {
        if (selectedIdx < idx) {
          next.add(selectedIdx);
        } else if (selectedIdx > idx) {
          next.add(selectedIdx - 1);
        }
      });
      return next;
    });
    toast.success("Clause removed");
  };

  // Save selected clauses to repository
  const handleSaveSelectedToRepository = () => {
    if (selectedClauseIdxs.size === 0) {
      toast.info("No clauses selected");
      return;
    }

    let savedCount = 0;
    selectedClauseIdxs.forEach(idx => {
      if (!savedClauseIds.has(idx)) {
        const clause = extractedClauses[idx];
        database.createClause({
          clause_type: clause.clause_type,
          clause_no: clause.clause_no || null,
          subtags: clause.subtags || [],
          clause_text: clause.clause_text,
          contract_type: selectedContractType || null,
          document_name: fileName || null,
          industry: selectedIndustry || null,
        });
        savedCount++;
      }
    });

    if (savedCount > 0) {
      setSavedClauseIds(prev => new Set([...prev, ...selectedClauseIdxs]));
      setRepositoryClauses(database.getClauses());
      setSelectedClauseIdxs(new Set());
      toast.success(`Saved ${savedCount} clauses to repository`);
    } else {
      toast.info("Selected clauses already saved");
    }
  };

  return (
    <div className={`p-6 space-y-6 ${isPreviewExpanded ? 'max-w-full' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Clause Extractor</h1>
          <p className="text-muted-foreground mt-1">Extract and analyze legal clauses from your documents</p>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${isPreviewExpanded ? '' : 'lg:grid-cols-12'} gap-6`}>
        {/* Left Column - Priority View (Takes more space when not expanded too) */}
        <div className={`space-y-6 ${isPreviewExpanded ? 'col-span-full' : 'lg:col-span-7'}`}>
          {/* Document Preview Card - Now at Top Left */}
          <Card className="bg-slate-900 border-slate-800 flex flex-col min-h-[500px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-xl">Document Preview</CardTitle>
                <CardDescription>{fileName || "No document loaded"}</CardDescription>
              </div>
              {fileContent && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                  className="text-slate-400 hover:text-white"
                >
                  {isPreviewExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex-1">
              {fileContent ? (
                <ScrollArea className={`${isPreviewExpanded ? 'h-[75vh]' : 'h-[500px]'} w-full rounded-xl border border-slate-800 bg-slate-950 p-6`}>
                  <div className="text-sm text-slate-400 font-mono leading-relaxed whitespace-pre-wrap">
                    {fileContent}
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-[400px] flex flex-col items-center justify-center text-slate-500 gap-4 border-2 border-dashed border-slate-800 rounded-xl">
                  <FileText className="w-12 h-12 opacity-20" />
                  <p>Upload a document to see preview</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Right Column - Controls & Secondary info */}
        {!isPreviewExpanded && (
          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-xl">Actions</CardTitle>
                <CardDescription>Upload and process your document</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Repository status indicator */}
                <div className="flex items-center gap-2 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-slate-400">
                    Repository: <span className="text-emerald-400 font-medium">{repositoryClauses.length}</span> clauses for matching
                  </span>
                </div>

                {/* Contract Type selector */}
                <div className="space-y-2">
                  <Label className="text-sm text-slate-400 flex items-center gap-1">
                    <FileSignature className="w-3 h-3" />
                    Contract Type
                  </Label>
                  {showNewContractType ? (
                    <div className="flex gap-1">
                      <Input
                        value={newContractType}
                        onChange={(e) => setNewContractType(e.target.value)}
                        placeholder="New contract type..."
                        className="h-9 bg-slate-950 border-slate-800 text-slate-300"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleAddContractType()}
                      />
                      <Button type="button" size="icon" onClick={handleAddContractType} className="h-9 w-9 shrink-0 bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => { setShowNewContractType(false); setNewContractType(''); }} className="h-9 w-9 shrink-0">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Select value={selectedContractType} onValueChange={setSelectedContractType}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-300">
                          <SelectValue placeholder="Select contract type" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800">
                          {contractTypes.map((type) => (
                            <SelectItem key={type} value={type} className="text-slate-300 hover:bg-slate-800">
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="outline" onClick={() => setShowNewContractType(true)} className="h-9 w-9 shrink-0 border-purple-500/50 text-purple-400 hover:bg-purple-500/20">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Industry and Role selectors */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-400 flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      Industry
                    </Label>
                    {showNewIndustry ? (
                      <div className="flex gap-1">
                        <Input
                          value={newIndustry}
                          onChange={(e) => setNewIndustry(e.target.value)}
                          placeholder="New industry..."
                          className="h-9 bg-slate-950 border-slate-800 text-slate-300"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleAddIndustry()}
                        />
                        <Button type="button" size="icon" onClick={handleAddIndustry} className="h-9 w-9 shrink-0 bg-emerald-600 hover:bg-emerald-700">
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" onClick={() => { setShowNewIndustry(false); setNewIndustry(''); }} className="h-9 w-9 shrink-0">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                          <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-300">
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800">
                            {industries.map((industry) => (
                              <SelectItem key={industry} value={industry} className="text-slate-300 hover:bg-slate-800">
                                {industry}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" size="icon" variant="outline" onClick={() => setShowNewIndustry(true)} className="h-9 w-9 shrink-0 border-purple-500/50 text-purple-400 hover:bg-purple-500/20">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-400 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Party Role
                    </Label>
                    {showNewRole ? (
                      <div className="flex gap-1">
                        <Input
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          placeholder="New role..."
                          className="h-9 bg-slate-950 border-slate-800 text-slate-300"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
                        />
                        <Button type="button" size="icon" onClick={handleAddRole} className="h-9 w-9 shrink-0 bg-emerald-600 hover:bg-emerald-700">
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" onClick={() => { setShowNewRole(false); setNewRole(''); }} className="h-9 w-9 shrink-0">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                          <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-300">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800">
                            {partyRoles.map((role) => (
                              <SelectItem key={role} value={role} className="text-slate-300 hover:bg-slate-800">
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" size="icon" variant="outline" onClick={() => setShowNewRole(true)} className="h-9 w-9 shrink-0 border-purple-500/50 text-purple-400 hover:bg-purple-500/20">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Document Numbering Schema */}
                <div className="space-y-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setShowSchemaSettings(!showSchemaSettings)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <ListOrdered className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-medium text-slate-300">Document Structure</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {numberingSchema.mainClause !== "none" ? NUMBERING_OPTIONS.find(o => o.value === numberingSchema.mainClause)?.label : "Auto-detect"}
                      </span>
                      {showSchemaSettings ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </button>

                  {showSchemaSettings && (
                    <div className="space-y-3 pt-3 border-t border-slate-800">
                      <p className="text-xs text-slate-500">
                        Specify how clauses are numbered in your document. The system will extract all content from one main clause number to the next.
                      </p>

                      {/* Main Clause */}
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">Main Clauses (required)</Label>
                        <Select
                          value={numberingSchema.mainClause}
                          onValueChange={(v) => setNumberingSchema(prev => ({ ...prev, mainClause: v }))}
                        >
                          <SelectTrigger className="h-8 bg-slate-900 border-slate-700 text-slate-300 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {NUMBERING_GROUPS.map((group) => (
                              <SelectGroup key={group.label}>
                                <SelectLabel className="text-slate-500 text-xs">{group.label}</SelectLabel>
                                {group.options.filter(o => o.value !== "none").map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-slate-300 text-sm">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Sub-clause Level 1 */}
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">Sub-clauses Level 1 (optional)</Label>
                        <Select
                          value={numberingSchema.subClause1}
                          onValueChange={(v) => setNumberingSchema(prev => ({ ...prev, subClause1: v }))}
                        >
                          <SelectTrigger className="h-8 bg-slate-900 border-slate-700 text-slate-300 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {NUMBERING_GROUPS.map((group) => (
                              <SelectGroup key={group.label}>
                                <SelectLabel className="text-slate-500 text-xs">{group.label}</SelectLabel>
                                {group.options.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-slate-300 text-sm">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Sub-clause Level 2 */}
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">Sub-clauses Level 2 (optional)</Label>
                        <Select
                          value={numberingSchema.subClause2}
                          onValueChange={(v) => setNumberingSchema(prev => ({ ...prev, subClause2: v }))}
                        >
                          <SelectTrigger className="h-8 bg-slate-900 border-slate-700 text-slate-300 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {NUMBERING_GROUPS.map((group) => (
                              <SelectGroup key={group.label}>
                                <SelectLabel className="text-slate-500 text-xs">{group.label}</SelectLabel>
                                {group.options.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-slate-300 text-sm">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Sub-clause Level 3 */}
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">Sub-clauses Level 3 (optional)</Label>
                        <Select
                          value={numberingSchema.subClause3 || "none"}
                          onValueChange={(v) => setNumberingSchema(prev => ({ ...prev, subClause3: v }))}
                        >
                          <SelectTrigger className="h-8 bg-slate-900 border-slate-700 text-slate-300 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {NUMBERING_GROUPS.map((group) => (
                              <SelectGroup key={group.label}>
                                <SelectLabel className="text-slate-500 text-xs">{group.label}</SelectLabel>
                                {group.options.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-slate-300 text-sm">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-900/50 p-2 rounded">
                        <strong>Example:</strong> If your document uses "I. INDEMNITY" with sub-points "A.", "B.", nested "1.", "2.", and deeper "(a)", "(b)", set Main to "I, II, III", Sub-1 to "A, B, C", Sub-2 to "1, 2, 3", Sub-3 to "(a) (b) (c)".
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-2 border-dashed border-slate-800 rounded-xl p-8 text-center hover:border-purple-500/50 transition-colors">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".txt,.doc,.docx,.pdf"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer space-y-4">
                    <div className="mx-auto w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center">
                      <Upload className="w-5 h-5 text-purple-500" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Click to upload</p>
                      <p className="text-xs text-slate-500">Supports TXT, DOCX, PDF</p>
                    </div>
                  </label>
                </div>

                {fileName && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
                      <FileText className="w-5 h-5 text-purple-500 shrink-0" />
                      <span className="font-medium truncate text-sm">{fileName}</span>
                    </div>
                    <Button 
                      onClick={handleExtract} 
                      disabled={isExtracting} 
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      {isExtracting ? "Processing..." : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Extract Clauses
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {extractedClauses.length === 0 && (
              <Card className="bg-slate-900 border-slate-800 border-dashed opacity-50">
                <CardContent className="py-12 flex flex-col items-center justify-center text-slate-500 gap-4">
                  <AlertCircle className="w-8 h-8" />
                  <p className="text-sm">Extracted clauses will appear below</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Full-width Extracted Clauses Table */}
      {extractedClauses.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xl">Extracted Clauses</CardTitle>
              <CardDescription>
                {extractedClauses.length} clauses identified
                {extractedClauses.filter((c: any) => c.matched_from_repository).length > 0 && (
                  <span className="ml-2 text-emerald-400">
                    ({extractedClauses.filter((c: any) => c.matched_from_repository).length} matched from repository)
                  </span>
                )}
                {selectedClauseIdxs.size > 0 && (
                  <span className="ml-2 text-purple-400">
                    • {selectedClauseIdxs.size} selected
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedClauseIdxs.size > 0 && (
                <Button
                  onClick={handleSaveSelectedToRepository}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <SaveAll className="w-4 h-4 mr-2" />
                  Save Selected ({selectedClauseIdxs.size})
                </Button>
              )}
              <Button
                onClick={handleSaveAllToRepository}
                variant="outline"
                className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                disabled={savedClauseIds.size === extractedClauses.length}
              >
                <SaveAll className="w-4 h-4 mr-2" />
                Save All ({extractedClauses.length - savedClauseIds.size})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400 w-[50px]">
                      <Checkbox
                        checked={extractedClauses.length > 0 && selectedClauseIdxs.size === extractedClauses.length}
                        ref={(el) => {
                          if (el) {
                            (el as any).indeterminate = selectedClauseIdxs.size > 0 && selectedClauseIdxs.size < extractedClauses.length;
                          }
                        }}
                        onCheckedChange={handleSelectAll}
                        className="border-slate-500"
                      />
                    </TableHead>
                    <TableHead className="text-slate-400 w-[200px]">Clause No.</TableHead>
                    <TableHead className="text-slate-400 w-[180px]">Type</TableHead>
                    <TableHead className="text-slate-400 w-[200px]">Subtags</TableHead>
                    <TableHead className="text-slate-400">Clause Text</TableHead>
                    <TableHead className="text-slate-400 w-[120px] text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TooltipProvider>
                    {extractedClauses.map((clause, idx) => (
                      <TableRow
                        key={idx}
                        className={`border-slate-800 ${
                          savedClauseIds.has(idx)
                            ? 'bg-emerald-950/20'
                            : selectedClauseIdxs.has(idx)
                            ? 'bg-purple-950/20'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        {/* Checkbox Column */}
                        <TableCell className="align-top py-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedClauseIdxs.has(idx)}
                            onCheckedChange={() => handleSelectClause(idx)}
                            className="border-slate-500"
                          />
                        </TableCell>

                        {/* Clause No. Column - Editable */}
                        <TableCell className="align-top py-4">
                          <Input
                            value={clause.clause_no || ''}
                            onChange={(e) => handleUpdateClauseNo(idx, e.target.value)}
                            className="h-8 w-[180px] bg-slate-950 border-slate-700 text-slate-300 text-sm"
                            placeholder="e.g., 8. Services"
                          />
                        </TableCell>

                        {/* Clause Type Column */}
                        <TableCell className="align-top py-4">
                          <div className="flex flex-col gap-2">
                            {/* Editable Clause Type Dropdown with Add New option */}
                            {addingClauseTypeIdx === idx ? (
                              <div className="flex flex-col gap-2">
                                <Input
                                  value={newClauseTypeName}
                                  onChange={(e) => setNewClauseTypeName(e.target.value)}
                                  placeholder="New clause type..."
                                  className="h-8 w-[160px] bg-slate-950 border-slate-700 text-slate-300 text-sm"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddNewClauseType(idx);
                                    if (e.key === 'Escape') handleCancelAddClauseType();
                                  }}
                                />
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleAddNewClauseType(idx)}
                                    className="h-7 bg-emerald-600 hover:bg-emerald-700 text-xs"
                                  >
                                    <Check className="w-3 h-3 mr-1" />
                                    Add
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancelAddClauseType}
                                    className="h-7 text-slate-400 text-xs"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <Select
                                  value={clause.clause_type}
                                  onValueChange={(value) => handleUpdateClauseType(idx, value)}
                                >
                                  <SelectTrigger className="h-8 w-[140px] bg-slate-950 border-slate-700 text-purple-400 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-900 border-slate-700 max-h-[300px]">
                                    {clauseTypesList.map((type) => (
                                      <SelectItem key={type} value={type} className="text-slate-300 text-sm">
                                        {type}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  onClick={() => setAddingClauseTypeIdx(idx)}
                                  className="h-8 w-8 shrink-0 border-purple-500/50 text-purple-400 hover:bg-purple-500/20"
                                  title="Add new clause type"
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                            {clause.matched_from_repository && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1 w-fit">
                                    <Database className="w-3 h-3" />
                                    {Math.round(clause.similarity_score * 100)}%
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Matched from repository</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>

                        {/* Subtags Column (Multiple) */}
                        <TableCell className="align-top py-4">
                          <div className="space-y-2">
                            {/* Display existing subtags */}
                            {(clause.subtags || []).length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {(clause.subtags || []).map((tag: string) => (
                                  <Badge key={tag} variant="secondary" className="text-xs flex items-center gap-1 bg-slate-800 text-slate-300">
                                    {tag}
                                    <X
                                      className="w-3 h-3 cursor-pointer hover:text-red-400"
                                      onClick={() => handleRemoveSubtagFromClause(idx, tag)}
                                    />
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {addingSubtagIdx === idx ? (
                              <div className="flex flex-col gap-2">
                                <Input
                                  value={newSubtagName}
                                  onChange={(e) => setNewSubtagName(e.target.value)}
                                  placeholder="New subtag..."
                                  className="h-8 w-[160px] bg-slate-950 border-slate-700 text-slate-300 text-sm"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddNewSubtag(idx, clause.clause_type);
                                    if (e.key === 'Escape') handleCancelAddSubtag();
                                  }}
                                />
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleAddNewSubtag(idx, clause.clause_type)}
                                    className="h-7 bg-emerald-600 hover:bg-emerald-700 text-xs"
                                    disabled={!clause.clause_type}
                                  >
                                    <Check className="w-3 h-3 mr-1" />
                                    Add
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancelAddSubtag}
                                    className="h-7 text-slate-400 text-xs"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <Select
                                  value=""
                                  onValueChange={(value) => handleAddSubtagToClause(idx, value)}
                                  disabled={!clause.clause_type}
                                >
                                  <SelectTrigger className="h-8 w-[120px] bg-slate-950 border-slate-700 text-slate-300 text-sm">
                                    <SelectValue placeholder={clause.clause_type ? "Add..." : "Select type"} />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-900 border-slate-700 max-h-[300px]">
                                    {loadSubtagsForType(clause.clause_type)
                                      .filter((tag: string) => !(clause.subtags || []).includes(tag))
                                      .map((tag: string) => (
                                        <SelectItem key={tag} value={tag} className="text-slate-300 text-sm">
                                          {tag}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  onClick={() => setAddingSubtagIdx(idx)}
                                  className="h-8 w-8 shrink-0 border-purple-500/50 text-purple-400 hover:bg-purple-500/20"
                                  title="Add new subtag"
                                  disabled={!clause.clause_type}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="align-top py-4">
                          {/* Editable Clause Text */}
                          {editingClauseIdx === idx ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editingClauseText}
                                onChange={(e) => setEditingClauseText(e.target.value)}
                                className="min-h-[150px] text-sm bg-slate-950 border-slate-700 text-slate-300"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={handleSaveClauseText}
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelEditText}
                                  className="text-slate-400"
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="group relative">
                                <p className={`text-sm text-slate-300 whitespace-normal ${
                                  !expandedClauses.has(idx) ? 'line-clamp-3' : ''
                                }`}>
                                  {normalizeClauseText(clause.clause_text)}
                                </p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleStartEditText(idx, clause.clause_text)}
                                  className="absolute top-0 right-0 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-purple-400"
                                  title="Edit clause text"
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                {clause.clause_text.length > 200 && (
                                  <button
                                    onClick={() => toggleClauseExpand(idx)}
                                    className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                  >
                                    {expandedClauses.has(idx) ? (
                                      <>
                                        <ChevronUp className="w-3 h-3" />
                                        Show less
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="w-3 h-3" />
                                        Show more ({Math.round(clause.clause_text.length / 100) * 100}+ chars)
                                      </>
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleStartEditText(idx, clause.clause_text)}
                                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-purple-400 transition-colors"
                                >
                                  <Pencil className="w-3 h-3" />
                                  Edit
                                </button>
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top py-4">
                          <div className="flex items-center justify-center gap-1">
                            {savedClauseIds.has(idx) ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Saved
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-slate-400 hover:text-white"
                                onClick={() => handleSaveToRepository(clause, idx)}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Save
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                              onClick={() => handleRemoveClause(idx)}
                              title="Remove clause"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TooltipProvider>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
