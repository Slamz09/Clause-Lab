import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Upload, Loader2, FileSearch, ListPlus, Trash2, FileText, X, Maximize2, Minimize2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ClauseFilters, { ClauseFiltersState } from "@/components/clauses/ClauseFilters";
import ClauseTable from "@/components/clauses/ClauseTable";
import ClauseFormModal from "@/components/clauses/ClauseFormModal";
import { useClauses } from "@/hooks/useClauses";
import { useToast } from "@/hooks/use-toast";
import { database } from "@/services/database";
import type { Clause, ClauseFormData } from "@/types/clause";
import type { Contract } from "@/types/contract";

const initialFilters: ClauseFiltersState = {
  search: '',
  clauseTypes: [],
  contractTypes: [],
  partyRole: 'Party Role',
  industries: [],
};

// Parse CSV text into array of objects
function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const data: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header.trim().toLowerCase().replace(/\s+/g, '_')] = values[index];
      });
      data.push(row);
    }
  }

  return data;
}

// Parse a single CSV line, handling quoted values
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

// List management types and functions
interface ClauseList {
  id: string;
  name: string;
  clauseIds: string[];
  createdAt: string;
}

function loadClauseLists(): ClauseList[] {
  try {
    const stored = localStorage.getItem('clauseLists');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveClauseLists(lists: ClauseList[]) {
  localStorage.setItem('clauseLists', JSON.stringify(lists));
}

export default function ClauseRepository() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const documentFilter = searchParams.get('document');

  const { clauses, loading, createClause, updateClause, deleteClause, filterClauses, refetch } = useClauses();
  const [filters, setFilters] = useState<ClauseFiltersState>(initialFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClause, setEditingClause] = useState<Clause | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Selection state
  const [selectedClauseIds, setSelectedClauseIds] = useState<Set<string>>(new Set());

  // List management state
  const [clauseLists, setClauseLists] = useState<ClauseList[]>(loadClauseLists);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isListManagerOpen, setIsListManagerOpen] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);

  // Clear document filter
  const clearDocumentFilter = () => {
    setSearchParams({});
  };

  // Document preview side panel state
  const [selectedDocument, setSelectedDocument] = useState<Contract | null>(null);
  const [selectedClauseText, setSelectedClauseText] = useState<string | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(540);
  const [isResizing, setIsResizing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);

  const handleFilterChange = (key: keyof ClauseFiltersState, value: string | string[]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters(initialFilters);
  };

  const handleSave = async (formData: ClauseFormData) => {
    let success: boolean;
    if (editingClause) {
      success = await updateClause(editingClause.id, formData);
    } else {
      success = await createClause(formData);
    }
    if (success) {
      setIsModalOpen(false);
      setEditingClause(null);
    }
  };

  const handleEdit = (clause: Clause) => {
    setEditingClause(clause);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteClause(id);
  };

  const handleInlineUpdate = async (id: string, updates: Partial<ClauseFormData>) => {
    await updateClause(id, updates as ClauseFormData);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingClause(null);
  };

  // List management handlers
  const handleCreateList = () => {
    if (!newListName.trim()) return;
    if (selectedClauseIds.size === 0) {
      toast({ title: "No clauses selected", description: "Select clauses to add to the list.", variant: "destructive" });
      return;
    }

    const newList: ClauseList = {
      id: crypto.randomUUID(),
      name: newListName.trim(),
      clauseIds: Array.from(selectedClauseIds),
      createdAt: new Date().toISOString()
    };

    const updatedLists = [...clauseLists, newList];
    setClauseLists(updatedLists);
    saveClauseLists(updatedLists);

    toast({ title: "List created", description: `"${newList.name}" with ${newList.clauseIds.length} clauses.` });
    setNewListName('');
    setIsCreateListOpen(false);
    setSelectedClauseIds(new Set());
  };

  const handleDeleteList = (listId: string) => {
    const listToDelete = clauseLists.find(l => l.id === listId);
    const updatedLists = clauseLists.filter(l => l.id !== listId);
    setClauseLists(updatedLists);
    saveClauseLists(updatedLists);
    if (activeListId === listId) {
      setActiveListId(null);
    }
    toast({ title: "List deleted", description: `"${listToDelete?.name}" has been removed.` });
  };

  const handleLoadList = (listId: string) => {
    setActiveListId(listId);
    setIsListManagerOpen(false);
    const list = clauseLists.find(l => l.id === listId);
    if (list) {
      toast({ title: "List loaded", description: `Showing ${list.clauseIds.length} clauses from "${list.name}"` });
    }
  };

  const handleClearActiveList = () => {
    setActiveListId(null);
    toast({ title: "List cleared", description: "Showing all clauses" });
  };

  // Document preview handlers
  const handleDocumentClick = (documentName: string, clauseText: string) => {
    // Find the contract with this document name
    const contracts = database.getContracts();
    const contract = contracts.find(c =>
      c.file_name === documentName ||
      c.contract_name === documentName ||
      c.file_name?.replace(/\.[^/.]+$/, "") === documentName
    );

    if (contract) {
      setSelectedDocument(contract);
      setSelectedClauseText(clauseText);
      setIsSidePanelOpen(true);
    } else {
      toast({
        title: "Document not found",
        description: `Could not find contract: ${documentName}`,
        variant: "destructive"
      });
    }
  };

  // Scroll to highlighted text when panel opens
  useEffect(() => {
    if (isSidePanelOpen && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [isSidePanelOpen, selectedClauseText]);

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

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const csvText = await file.text();
      const rows = parseCSV(csvText);

      if (rows.length === 0) {
        toast({
          title: "Invalid CSV",
          description: "No valid data rows found in the CSV file.",
          variant: "destructive",
        });
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const row of rows) {
        // Map CSV columns to clause fields (flexible column names)
        const formData: ClauseFormData = {
          clause_type: row.clause_type || row.type || row.clausetype || 'Other',
          clause_text: row.clause_text || row.text || row.clausetext || row.content || '',
          contract_type: row.contract_type || row.contracttype || row.contract || null,
          party_role: row.party_role || row.partyrole || row.party || row.role || null,
          industry: row.industry || null,
          preferred_position: row.preferred_position || row.preferredposition || row.position || null,
          acceptable_alternatives: row.acceptable_alternatives || row.alternatives || null,
          approval_required: row.approval_required || row.approval || null,
          complexity: row.complexity ? parseInt(row.complexity) : null,
          balance: row.balance ? parseInt(row.balance) : null,
        };

        // Skip rows without clause text
        if (!formData.clause_text) {
          errorCount++;
          continue;
        }

        const success = await createClause(formData);
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      await refetch();

      toast({
        title: "CSV Import Complete",
        description: `Successfully imported ${successCount} clauses.${errorCount > 0 ? ` ${errorCount} rows skipped.` : ''}`,
      });
    } catch (error) {
      console.error('CSV upload error:', error);
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import CSV",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (csvInputRef.current) {
        csvInputRef.current.value = '';
      }
    }
  };

  // Filter clauses by filters, active list, and document filter from URL
  const filteredClauses = (() => {
    let result = filterClauses(filters);

    // Apply document filter from URL (from Contracts Repository "View Clauses" button)
    if (documentFilter) {
      result = result.filter(clause =>
        clause.document_name === documentFilter ||
        clause.document_name === documentFilter.replace(/\.[^/.]+$/, "") // Match without extension too
      );
    }

    if (activeListId) {
      const activeList = clauseLists.find(l => l.id === activeListId);
      if (activeList) {
        result = result.filter(clause => activeList.clauseIds.includes(clause.id));
      }
    }
    return result;
  })();

  const activeList = activeListId ? clauseLists.find(l => l.id === activeListId) : null;

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Clause Repository</h1>
          <p className="text-sm text-muted-foreground">
            {clauses.length} clauses • {filteredClauses.length} matching filters
            {documentFilter && (
              <span className="ml-2 text-primary">
                • Filtered by contract: "{documentFilter}"
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-5 px-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearDocumentFilter}
                  title="Clear filter"
                >
                  <X className="w-3 h-3" />
                </Button>
              </span>
            )}
            {activeList && (
              <span className="ml-2 text-primary">
                • Viewing list: "{activeList.name}"
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => csvInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Import CSV
          </Button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            className="hidden"
          />
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Clause
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/clause-extractor')}
          >
            <FileSearch className="w-4 h-4 mr-2" />
            Clause Extractor
          </Button>
          {activeList && (
            <Button
              variant="outline"
              onClick={handleClearActiveList}
              className="border-primary/50 text-primary"
            >
              Clear List Filter
            </Button>
          )}
          {clauseLists.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => setIsListManagerOpen(true)}
            >
              <ListPlus className="w-4 h-4 mr-2" />
              Lists ({clauseLists.length})
            </Button>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <ClauseFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />
      </motion.div>

      {/* Selection bar */}
      {selectedClauseIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg p-3"
        >
          <span className="text-sm text-foreground">
            {selectedClauseIds.size} clause{selectedClauseIds.size > 1 ? 's' : ''} selected
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
              variant="destructive"
              onClick={async () => {
                const count = selectedClauseIds.size;
                for (const id of selectedClauseIds) {
                  await deleteClause(id);
                }
                setSelectedClauseIds(new Set());
                toast({
                  title: "Clauses deleted",
                  description: `${count} clause${count > 1 ? 's' : ''} removed from repository.`
                });
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedClauseIds(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Loading clauses...
          </div>
        ) : (
          <ClauseTable
            clauses={filteredClauses}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onUpdate={handleInlineUpdate}
            selectedIds={selectedClauseIds}
            onSelectionChange={setSelectedClauseIds}
            onDocumentClick={handleDocumentClick}
          />
        )}
      </motion.div>

      <ClauseFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        editingClause={editingClause}
      />

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
              {selectedClauseIds.size} clause{selectedClauseIds.size > 1 ? 's' : ''} will be added to this list.
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
            {clauseLists.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No saved lists yet.</p>
            ) : (
              clauseLists.map((list) => (
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
                      {list.clauseIds.length} clause{list.clauseIds.length > 1 ? 's' : ''} • Created {new Date(list.createdAt).toLocaleDateString()}
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

      {/* Document Preview Side Panel */}
      {isSidePanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => { setIsSidePanelOpen(false); setIsFullScreen(false); }}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            ref={panelRef}
            className={`relative bg-background border-l border-border text-foreground h-full overflow-hidden flex transition-all duration-300 ${
              isFullScreen ? 'w-full' : ''
            }`}
            style={isFullScreen ? undefined : { width: panelWidth }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Resize Handle - only show when not full screen */}
            {!isFullScreen && (
              <div
                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-primary/30 transition-colors flex items-center justify-center group"
                onMouseDown={handleMouseDown}
              >
                <div className="w-1 h-12 bg-border rounded group-hover:bg-primary transition-colors" />
              </div>
            )}

            {/* Panel Content */}
            <div className={`flex-1 flex flex-col overflow-hidden ${isFullScreen ? '' : 'ml-2'}`}>
              {/* Header */}
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Document Preview
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    title={isFullScreen ? "Exit full screen" : "Full screen"}
                  >
                    {isFullScreen ? (
                      <Minimize2 className="w-5 h-5" />
                    ) : (
                      <Maximize2 className="w-5 h-5" />
                    )}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setIsSidePanelOpen(false); setIsFullScreen(false); }}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Document Info */}
              {selectedDocument && (
                <>
                  <div className="p-4 border-b border-border bg-muted/30">
                    <h3 className="font-medium text-foreground">{selectedDocument.contract_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedDocument.contract_type} • {selectedDocument.file_name}
                    </p>
                    {selectedClauseText && (
                      <p className="text-xs text-primary mt-1">
                        Clause text highlighted below
                      </p>
                    )}
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-4 text-sm text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap">
                      {selectedDocument.file_content ? (
                        (() => {
                          if (!selectedClauseText) {
                            return selectedDocument.file_content;
                          }

                          // Normalize both texts for comparison (remove extra whitespace)
                          const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();
                          const normalizedClause = normalizeText(selectedClauseText);
                          const normalizedContent = normalizeText(selectedDocument.file_content);

                          // Find the position in normalized content
                          const matchIndex = normalizedContent.toLowerCase().indexOf(normalizedClause.toLowerCase());

                          if (matchIndex === -1) {
                            // Try matching first 100 chars if full match fails
                            const partialClause = normalizedClause.substring(0, 100);
                            const partialIndex = normalizedContent.toLowerCase().indexOf(partialClause.toLowerCase());

                            if (partialIndex === -1) {
                              return selectedDocument.file_content;
                            }

                            // Map back to original content position
                            let origPos = 0;
                            let normPos = 0;
                            while (normPos < partialIndex && origPos < selectedDocument.file_content.length) {
                              if (!/\s/.test(selectedDocument.file_content[origPos]) ||
                                  (origPos > 0 && !/\s/.test(selectedDocument.file_content[origPos - 1]))) {
                                normPos++;
                              }
                              origPos++;
                            }

                            const before = selectedDocument.file_content.substring(0, origPos);
                            const highlighted = selectedDocument.file_content.substring(origPos, origPos + selectedClauseText.length + 50);
                            const after = selectedDocument.file_content.substring(origPos + selectedClauseText.length + 50);

                            return (
                              <>
                                {before}
                                <span
                                  ref={highlightRef}
                                  className="bg-yellow-500/40 text-foreground px-1 rounded border-l-4 border-yellow-500"
                                >
                                  {highlighted}
                                </span>
                                {after}
                              </>
                            );
                          }

                          // Map normalized position back to original
                          let origStart = 0;
                          let normPos = 0;
                          const content = selectedDocument.file_content;

                          while (normPos < matchIndex && origStart < content.length) {
                            if (!/\s/.test(content[origStart]) ||
                                (origStart > 0 && !/\s/.test(content[origStart - 1]))) {
                              normPos++;
                            }
                            origStart++;
                          }

                          // Find end position
                          let origEnd = origStart;
                          let clauseNormPos = 0;
                          while (clauseNormPos < normalizedClause.length && origEnd < content.length) {
                            if (!/\s/.test(content[origEnd]) ||
                                (origEnd > 0 && !/\s/.test(content[origEnd - 1]))) {
                              clauseNormPos++;
                            }
                            origEnd++;
                          }

                          const before = content.substring(0, origStart);
                          const highlighted = content.substring(origStart, origEnd);
                          const after = content.substring(origEnd);

                          return (
                            <>
                              {before}
                              <span
                                ref={highlightRef}
                                className="bg-yellow-500/40 text-foreground px-1 rounded border-l-4 border-yellow-500"
                              >
                                {highlighted}
                              </span>
                              {after}
                            </>
                          );
                        })()
                      ) : (
                        "No preview available"
                      )}
                    </div>
                  </ScrollArea>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
