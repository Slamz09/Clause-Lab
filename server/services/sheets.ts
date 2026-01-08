import { google, sheets_v4 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface Clause {
  id: string;
  clause_type: string;
  clause_no: string | null;
  subtags: string[];
  contract_type: string | null;
  document_name: string | null;
  party_role: string | null;
  industry: string | null;
  clause_text: string;
  preferred_position: string | null;
  acceptable_alternatives: string | null;
  approval_required: string | null;
  complexity: number | null;
  balance: number | null;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  contract_name: string;
  contract_type: string;
  industry: string | null;
  governing_law: string | null;
  date_added: string;
  file_name?: string;
  file_content?: string;
  drive_file_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  deal_id: string;
  account_id: string;
  deal_type: 'Customer' | 'Vendor';
  scope: string;
  account_name: string;
  assigned_to: string;
  total_est_value: number;
  stage: string;
  created_at: string;
  updated_at: string;
}

const CLAUSES_SHEET = 'Clauses';
const CONTRACTS_SHEET = 'Contracts';
const DEALS_SHEET = 'Deals';

const CLAUSE_HEADERS = [
  'id', 'clause_type', 'clause_no', 'subtags', 'contract_type', 'document_name',
  'party_role', 'industry', 'clause_text', 'created_at', 'updated_at'
];

const CONTRACT_HEADERS = [
  'id', 'contract_name', 'contract_type', 'industry', 'governing_law',
  'date_added', 'file_name', 'drive_file_id', 'drive_file_link', 'created_at', 'updated_at'
];

const DEAL_HEADERS = [
  'id', 'deal_id', 'account_id', 'deal_type', 'scope', 'account_name',
  'assigned_to', 'total_est_value', 'stage', 'created_at', 'updated_at'
];

export class SheetsService {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string | null = null;

  constructor(auth: OAuth2Client) {
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async createOrGetSpreadsheet(existingId?: string): Promise<string> {
    // If we have an existing ID, verify it exists
    if (existingId) {
      try {
        await this.sheets.spreadsheets.get({ spreadsheetId: existingId });
        this.spreadsheetId = existingId;
        return existingId;
      } catch (e) {
        // Spreadsheet doesn't exist, create new one
      }
    }

    // Create new spreadsheet
    const response = await this.sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: 'Clause Lab Data'
        },
        sheets: [
          { properties: { title: CLAUSES_SHEET } },
          { properties: { title: CONTRACTS_SHEET } },
          { properties: { title: DEALS_SHEET } }
        ]
      }
    });

    this.spreadsheetId = response.data.spreadsheetId!;

    // Add headers
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${CLAUSES_SHEET}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [CLAUSE_HEADERS] }
    });

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${CONTRACTS_SHEET}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [CONTRACT_HEADERS] }
    });

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${DEALS_SHEET}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [DEAL_HEADERS] }
    });

    return this.spreadsheetId;
  }

  setSpreadsheetId(id: string) {
    this.spreadsheetId = id;
  }

  async syncClauses(clauses: Clause[]): Promise<void> {
    if (!this.spreadsheetId) throw new Error('Spreadsheet not initialized');

    // Clear existing data (except header)
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: `${CLAUSES_SHEET}!A2:Z`
    });

    if (clauses.length === 0) return;

    // Convert clauses to rows
    const rows = clauses.map(clause => [
      clause.id,
      clause.clause_type,
      clause.clause_no || '',
      Array.isArray(clause.subtags) ? clause.subtags.join(', ') : '',
      clause.contract_type || '',
      clause.document_name || '',
      clause.party_role || '',
      clause.industry || '',
      clause.clause_text,
      clause.created_at,
      clause.updated_at
    ]);

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${CLAUSES_SHEET}!A2`,
      valueInputOption: 'RAW',
      requestBody: { values: rows }
    });
  }

  async syncContracts(contracts: Contract[]): Promise<void> {
    if (!this.spreadsheetId) throw new Error('Spreadsheet not initialized');

    // Clear existing data (except header)
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: `${CONTRACTS_SHEET}!A2:Z`
    });

    if (contracts.length === 0) return;

    // Convert contracts to rows
    const rows = contracts.map(contract => [
      contract.id,
      contract.contract_name,
      contract.contract_type,
      contract.industry || '',
      contract.governing_law || '',
      contract.date_added,
      contract.file_name || '',
      contract.drive_file_id || '',
      contract.drive_file_id ? `https://drive.google.com/file/d/${contract.drive_file_id}/view` : '',
      contract.created_at,
      contract.updated_at
    ]);

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${CONTRACTS_SHEET}!A2`,
      valueInputOption: 'RAW',
      requestBody: { values: rows }
    });
  }

  async getClauses(): Promise<Clause[]> {
    if (!this.spreadsheetId) throw new Error('Spreadsheet not initialized');

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${CLAUSES_SHEET}!A2:K`
    });

    const rows = response.data.values || [];

    return rows.map(row => ({
      id: row[0] || '',
      clause_type: row[1] || '',
      clause_no: row[2] || null,
      subtags: row[3] ? row[3].split(', ').filter(Boolean) : [],
      contract_type: row[4] || null,
      document_name: row[5] || null,
      party_role: row[6] || null,
      industry: row[7] || null,
      clause_text: row[8] || '',
      preferred_position: null,
      acceptable_alternatives: null,
      approval_required: null,
      complexity: null,
      balance: null,
      created_at: row[9] || new Date().toISOString(),
      updated_at: row[10] || new Date().toISOString()
    }));
  }

  async getContracts(): Promise<Contract[]> {
    if (!this.spreadsheetId) throw new Error('Spreadsheet not initialized');

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${CONTRACTS_SHEET}!A2:K`
    });

    const rows = response.data.values || [];

    return rows.map(row => ({
      id: row[0] || '',
      contract_name: row[1] || '',
      contract_type: row[2] || '',
      industry: row[3] || null,
      governing_law: row[4] || null,
      date_added: row[5] || new Date().toISOString(),
      file_name: row[6] || undefined,
      drive_file_id: row[7] || undefined,
      created_at: row[9] || new Date().toISOString(),
      updated_at: row[10] || new Date().toISOString()
    }));
  }

  async syncDeals(deals: Deal[]): Promise<void> {
    if (!this.spreadsheetId) throw new Error('Spreadsheet not initialized');

    // Clear existing data (except header)
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: `${DEALS_SHEET}!A2:Z`
    });

    if (deals.length === 0) return;

    // Convert deals to rows
    const rows = deals.map(deal => [
      deal.id,
      deal.deal_id,
      deal.account_id,
      deal.deal_type,
      deal.scope,
      deal.account_name,
      deal.assigned_to,
      deal.total_est_value.toString(),
      deal.stage,
      deal.created_at,
      deal.updated_at
    ]);

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${DEALS_SHEET}!A2`,
      valueInputOption: 'RAW',
      requestBody: { values: rows }
    });
  }

  async getDeals(): Promise<Deal[]> {
    if (!this.spreadsheetId) throw new Error('Spreadsheet not initialized');

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${DEALS_SHEET}!A2:K`
    });

    const rows = response.data.values || [];

    return rows.map(row => ({
      id: row[0] || '',
      deal_id: row[1] || '',
      account_id: row[2] || '',
      deal_type: (row[3] as 'Customer' | 'Vendor') || 'Customer',
      scope: row[4] || '',
      account_name: row[5] || '',
      assigned_to: row[6] || '',
      total_est_value: parseFloat(row[7]) || 0,
      stage: row[8] || 'Lead',
      created_at: row[9] || new Date().toISOString(),
      updated_at: row[10] || new Date().toISOString()
    }));
  }

  getSpreadsheetUrl(): string | null {
    if (!this.spreadsheetId) return null;
    return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}`;
  }
}
