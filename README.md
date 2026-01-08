# Contracts & Clause Manager

A comprehensive legal document management application for extracting and categorizing clauses and organizing contracts. 

## Overview

This application provides legal professionals with tools to:
- Store and organize contract documents
- Extract and categorize legal clauses
- Match new clauses against existing repository entries
- Track deals through pipeline stages
- Sync data to Google Sheets for backup and collaboration

---

## Contracts Repository

Central hub for managing all legal contracts and documents.

### Features

**Document Upload & Storage**
- Upload TXT, DOCX, and PDF documents
- Automatic PDF text extraction
- Auto-assigned sequential contract IDs (CTR-0001, CTR-0002, etc.)

**Metadata Management**
- Contract Name
- Contract Type (multi-select with custom types)
- Industry Classification (multi-select)
- Governing Law (multi-select)
- Date Added

**Auto-Extraction**
- One-click extraction of metadata from document content
- Pattern matching for contract types (MSA, SOW, NDA, SaaS, etc.)
- Regex-based governing law detection from standard legal clauses

**Table Features**
- Resizable columns
- Multi-column sorting
- Full-text search across all fields
- Inline editing for all metadata
- Multi-select for bulk operations

**Contract Lists**
- Create named lists to group contracts
- Save selected contracts to lists
- Switch between saved lists for focused viewing

**Document Preview Panel**
- Resizable side panel (400-900px)
- Full contract text display
- Smooth scrolling with monospace font

---

## Clause Repository

Centralized database of legal clauses with advanced filtering and organization.

### Features

**Clause Metadata**
- Clause Type (Payment Terms, Indemnity, Confidentiality, Termination, etc.)
- Clause Number/Title (section reference)
- Multiple Subtags per clause
- Contract Type association
- Party Role (Customer/Vendor/Neutral)
- Industry classification
- Source document tracking

**Advanced Filtering**
- Full-text search in clause text
- Multi-select filters for clause types, contract types, and industries
- Party role filter
- Combined AND logic across all filters
- Clear all filters option

**CSV Import/Export**
- Import clauses from CSV files
- Flexible column mapping
- Bulk import with success/error reporting

**Clause Management**
- Add individual clauses via form
- Edit existing clauses
- Delete with confirmation
- Inline field updates

**Clause Lists**
- Save selected clauses to named lists
- Load and switch between lists
- Manage saved lists

**Document Linking**
- Link clauses to source contracts
- View all clauses from a specific contract
- Filter by document name

---

## Clause Extractor

Intelligent automatic extraction and analysis of clauses from legal documents.

### Features

**Rule-Based Extraction Engine**

Supports multiple numbering schemas:
- Numeric: 1., 2., 3.
- Alphabetic: a., b., c. / A., B., C.
- Roman Numerals: I., II., III. / i., ii., iii.
- Decimal: 1.1, 1.2, 2.1
- Section-based: "Section 1.", "Section 2."
- Article-based: "Article I", "Article II"
- Parenthetical: (1), (a), (i)

Multi-level extraction supports main clauses plus 3 levels of sub-clauses.

**Document Structure Configuration**
- Customizable numbering patterns per document
- Auto-detection option available

**Repository Matching**
- Compares extracted clauses against existing repository
- Displays similarity scores (percentage match)
- Visual indicators for matched clauses
- Prevents duplicate extraction

**Smart Text Normalization**
- Removes PDF spacing artifacts
- Handles various whitespace characters
- Collapses multiple spaces
- Removes stray page numbers

**Inline Editing**
- Edit clause text directly in results table
- Modify clause type with dropdown
- Add/remove subtags
- Edit clause number/title
- Expand/collapse long text
- Multi-select for batch operations

**Clause Type Management**
- Add custom clause types on-the-fly
- Dynamic subtag system per clause type
- Subtags persist in localStorage

**Batch Operations**
- Save selected clauses to repository
- Save all extracted clauses at once
- Visual indicators for saved vs. unsaved status

**Auto-Contract Upload**
- Automatically creates contract entry when extracting
- Prevents duplicate uploads
- Associates extracted clauses with source document

---

## Auto-Highlighting in Document Preview

When viewing a clause's source document, the system automatically highlights the clause within the full document text.

### How It Works

1. **Document Loading**: When clicking "View Document" from a clause, the system loads the associated contract and clause text

2. **Text Matching**:
   - Normalizes both clause and document text
   - Performs case-insensitive substring search
   - Falls back to partial matching (first 100 characters) if needed

3. **Position Mapping**:
   - Converts normalized position back to original document position
   - Preserves original formatting and whitespace

4. **Visual Highlighting**:
   - Yellow background highlight
   - Left border accent
   - Auto-scrolls to highlighted section
   - Displays clause metadata in panel header

---

---

## Google Sync Integration

Automatic backup and synchronization to Google Sheets and Google Drive.

### Features

**Authentication**
- One-click Google OAuth login
- Secure credential handling
- Session management

**Sync Capabilities**
- Sync clauses to Google Sheet
- Sync contracts to Google Sheet
- Sync deal pipeline to Google Sheet
- Separate sheets within same workbook

**Cloud Storage**
- Creates Google Drive folder for documents
- Stores uploaded PDFs/documents in Drive

**Auto-Sync**
- Debounced automatic sync after changes
- Background sync with status indicators

**Status Widget**
- Authentication status display
- Real-time sync status (syncing, synced, error, offline)
- Quick sync button
- Direct links to Google Sheet and Drive folder

---

## Technical Details

**Data Storage**
- All data stored in browser localStorage
- No account setup required
- Data persists between sessions

**Custom Types**
- Add custom contract types, industries, and governing laws
- Saved locally and sorted alphabetically

**User Interface**
- Dark/light theme support
- Responsive layouts
- Toast notifications
- Modal dialogs
- Sidebar navigation
- Smooth animations

---

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **UI Components**: Radix UI, Shadcn/ui
- **State Management**: React Query
- **PDF Processing**: pdfjs-dist
- **Animations**: Framer Motion
- **Backend** (for Google Sync): Node.js server
