import { Router, Request, Response } from 'express';
import { getAuthClient } from './auth.js';
import { SheetsService, Clause, Contract, Deal } from '../services/sheets.js';
import { DriveService } from '../services/drive.js';

const router = Router();

// Middleware to check authentication
const requireAuth = (req: Request, res: Response, next: Function) => {
  const authClient = getAuthClient(req);
  if (!authClient) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// Initialize/get spreadsheet and drive folder
router.post('/init', requireAuth, async (req: Request, res: Response) => {
  try {
    const authClient = getAuthClient(req)!;

    const sheetsService = new SheetsService(authClient);
    const driveService = new DriveService(authClient);

    // Get or create spreadsheet and folder
    const spreadsheetId = await sheetsService.createOrGetSpreadsheet(req.session.spreadsheetId);
    const folderId = await driveService.createOrGetFolder(req.session.driveFolderId);

    // Store IDs in session
    req.session.spreadsheetId = spreadsheetId;
    req.session.driveFolderId = folderId;

    res.json({
      success: true,
      spreadsheetId,
      spreadsheetUrl: sheetsService.getSpreadsheetUrl(),
      folderId,
      folderUrl: driveService.getFolderUrl()
    });
  } catch (error: any) {
    console.error('Init error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync clauses to Google Sheets
router.post('/clauses', requireAuth, async (req: Request, res: Response) => {
  try {
    const { clauses } = req.body as { clauses: Clause[] };

    if (!Array.isArray(clauses)) {
      return res.status(400).json({ error: 'clauses must be an array' });
    }

    const authClient = getAuthClient(req)!;
    const sheetsService = new SheetsService(authClient);

    // Ensure spreadsheet exists
    const spreadsheetId = await sheetsService.createOrGetSpreadsheet(req.session.spreadsheetId);
    req.session.spreadsheetId = spreadsheetId;

    // Sync clauses
    await sheetsService.syncClauses(clauses);

    res.json({
      success: true,
      count: clauses.length,
      spreadsheetUrl: sheetsService.getSpreadsheetUrl()
    });
  } catch (error: any) {
    console.error('Sync clauses error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync contracts to Google Sheets and files to Drive
router.post('/contracts', requireAuth, async (req: Request, res: Response) => {
  try {
    const { contracts } = req.body as { contracts: Contract[] };

    if (!Array.isArray(contracts)) {
      return res.status(400).json({ error: 'contracts must be an array' });
    }

    const authClient = getAuthClient(req)!;
    const sheetsService = new SheetsService(authClient);
    const driveService = new DriveService(authClient);

    // Ensure spreadsheet and folder exist
    const spreadsheetId = await sheetsService.createOrGetSpreadsheet(req.session.spreadsheetId);
    const folderId = await driveService.createOrGetFolder(req.session.driveFolderId);
    req.session.spreadsheetId = spreadsheetId;
    req.session.driveFolderId = folderId;

    // Upload files to Drive and get file IDs
    const contractsWithDriveIds: Contract[] = [];

    for (const contract of contracts) {
      let driveFileId = contract.drive_file_id;

      // If contract has file content, upload to Drive
      if (contract.file_content && contract.file_name) {
        try {
          driveFileId = await driveService.uploadFile(
            `${contract.id}_${contract.file_name}`,
            contract.file_content,
            'text/plain'
          );
        } catch (uploadError) {
          console.error(`Failed to upload file for contract ${contract.id}:`, uploadError);
        }
      }

      contractsWithDriveIds.push({
        ...contract,
        drive_file_id: driveFileId
      });
    }

    // Sync contracts to Sheet
    await sheetsService.syncContracts(contractsWithDriveIds);

    res.json({
      success: true,
      count: contracts.length,
      spreadsheetUrl: sheetsService.getSpreadsheetUrl(),
      folderUrl: driveService.getFolderUrl()
    });
  } catch (error: any) {
    console.error('Sync contracts error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync deals to Google Sheets
router.post('/deals', requireAuth, async (req: Request, res: Response) => {
  try {
    const { deals } = req.body as { deals: Deal[] };

    if (!Array.isArray(deals)) {
      return res.status(400).json({ error: 'deals must be an array' });
    }

    const authClient = getAuthClient(req)!;
    const sheetsService = new SheetsService(authClient);

    // Ensure spreadsheet exists
    const spreadsheetId = await sheetsService.createOrGetSpreadsheet(req.session.spreadsheetId);
    req.session.spreadsheetId = spreadsheetId;

    // Sync deals
    await sheetsService.syncDeals(deals);

    res.json({
      success: true,
      count: deals.length,
      spreadsheetUrl: sheetsService.getSpreadsheetUrl()
    });
  } catch (error: any) {
    console.error('Sync deals error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync all data (clauses + contracts + deals)
router.post('/all', requireAuth, async (req: Request, res: Response) => {
  try {
    const { clauses, contracts, deals } = req.body as { clauses: Clause[]; contracts: Contract[]; deals: Deal[] };

    const authClient = getAuthClient(req)!;
    const sheetsService = new SheetsService(authClient);
    const driveService = new DriveService(authClient);

    // Ensure spreadsheet and folder exist
    const spreadsheetId = await sheetsService.createOrGetSpreadsheet(req.session.spreadsheetId);
    const folderId = await driveService.createOrGetFolder(req.session.driveFolderId);
    req.session.spreadsheetId = spreadsheetId;
    req.session.driveFolderId = folderId;

    // Sync clauses
    if (Array.isArray(clauses)) {
      await sheetsService.syncClauses(clauses);
    }

    // Upload contract files and sync
    if (Array.isArray(contracts)) {
      const contractsWithDriveIds: Contract[] = [];

      for (const contract of contracts) {
        let driveFileId = contract.drive_file_id;

        if (contract.file_content && contract.file_name) {
          try {
            driveFileId = await driveService.uploadFile(
              `${contract.id}_${contract.file_name}`,
              contract.file_content,
              'text/plain'
            );
          } catch (uploadError) {
            console.error(`Failed to upload file for contract ${contract.id}:`, uploadError);
          }
        }

        contractsWithDriveIds.push({
          ...contract,
          drive_file_id: driveFileId
        });
      }

      await sheetsService.syncContracts(contractsWithDriveIds);
    }

    // Sync deals
    if (Array.isArray(deals)) {
      await sheetsService.syncDeals(deals);
    }

    res.json({
      success: true,
      clausesCount: clauses?.length || 0,
      contractsCount: contracts?.length || 0,
      dealsCount: deals?.length || 0,
      spreadsheetUrl: sheetsService.getSpreadsheetUrl(),
      folderUrl: driveService.getFolderUrl()
    });
  } catch (error: any) {
    console.error('Sync all error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pull data from Google Sheets
router.get('/pull', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.session.spreadsheetId) {
      return res.status(400).json({ error: 'No spreadsheet linked. Run /init first.' });
    }

    const authClient = getAuthClient(req)!;
    const sheetsService = new SheetsService(authClient);
    sheetsService.setSpreadsheetId(req.session.spreadsheetId);

    const clauses = await sheetsService.getClauses();
    const contracts = await sheetsService.getContracts();
    const deals = await sheetsService.getDeals();

    res.json({
      success: true,
      clauses,
      contracts,
      deals
    });
  } catch (error: any) {
    console.error('Pull error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get sync status
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  res.json({
    ready: true,
    spreadsheetId: req.session.spreadsheetId || null,
    driveFolderId: req.session.driveFolderId || null,
    spreadsheetUrl: req.session.spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${req.session.spreadsheetId}`
      : null,
    folderUrl: req.session.driveFolderId
      ? `https://drive.google.com/drive/folders/${req.session.driveFolderId}`
      : null
  });
});

export default router;
