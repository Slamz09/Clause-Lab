const API_BASE = 'http://localhost:3001';

export interface SyncStatus {
  authenticated: boolean;
  user?: {
    email: string;
    name: string;
  };
  spreadsheetId?: string | null;
  spreadsheetUrl?: string | null;
  driveFolderId?: string | null;
  folderUrl?: string | null;
}

export interface SyncResult {
  success: boolean;
  error?: string;
  clausesCount?: number;
  contractsCount?: number;
  dealsCount?: number;
  spreadsheetUrl?: string;
  folderUrl?: string;
}

// Debounce timer for auto-sync
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;
let syncListeners: Array<(status: 'syncing' | 'synced' | 'error' | 'offline') => void> = [];

export const googleSync = {
  // Check if user is authenticated with Google
  async getAuthStatus(): Promise<SyncStatus> {
    try {
      const response = await fetch(`${API_BASE}/auth/status`, {
        credentials: 'include'
      });
      return await response.json();
    } catch (error) {
      return { authenticated: false };
    }
  },

  // Redirect to Google OAuth
  login() {
    window.location.href = `${API_BASE}/auth/google`;
  },

  // Logout
  async logout(): Promise<void> {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  },

  // Initialize spreadsheet and drive folder
  async init(): Promise<SyncResult> {
    try {
      const response = await fetch(`${API_BASE}/api/sync/init`, {
        method: 'POST',
        credentials: 'include'
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Failed to connect to server' };
    }
  },

  // Sync all data to Google
  async syncAll(clauses: any[], contracts: any[], deals: any[] = []): Promise<SyncResult> {
    try {
      isSyncing = true;
      notifyListeners('syncing');

      const response = await fetch(`${API_BASE}/api/sync/all`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clauses, contracts, deals })
      });

      const result = await response.json();

      if (result.success) {
        notifyListeners('synced');
      } else {
        notifyListeners('error');
      }

      isSyncing = false;
      return result;
    } catch (error) {
      isSyncing = false;
      notifyListeners('offline');
      return { success: false, error: 'Failed to connect to server' };
    }
  },

  // Sync clauses only
  async syncClauses(clauses: any[]): Promise<SyncResult> {
    try {
      isSyncing = true;
      notifyListeners('syncing');

      const response = await fetch(`${API_BASE}/api/sync/clauses`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clauses })
      });

      const result = await response.json();

      if (result.success) {
        notifyListeners('synced');
      } else {
        notifyListeners('error');
      }

      isSyncing = false;
      return result;
    } catch (error) {
      isSyncing = false;
      notifyListeners('offline');
      return { success: false, error: 'Failed to connect to server' };
    }
  },

  // Sync contracts only
  async syncContracts(contracts: any[]): Promise<SyncResult> {
    try {
      isSyncing = true;
      notifyListeners('syncing');

      const response = await fetch(`${API_BASE}/api/sync/contracts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contracts })
      });

      const result = await response.json();

      if (result.success) {
        notifyListeners('synced');
      } else {
        notifyListeners('error');
      }

      isSyncing = false;
      return result;
    } catch (error) {
      isSyncing = false;
      notifyListeners('offline');
      return { success: false, error: 'Failed to connect to server' };
    }
  },

  // Sync deals only
  async syncDeals(deals: any[]): Promise<SyncResult> {
    try {
      isSyncing = true;
      notifyListeners('syncing');

      const response = await fetch(`${API_BASE}/api/sync/deals`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deals })
      });

      const result = await response.json();

      if (result.success) {
        notifyListeners('synced');
      } else {
        notifyListeners('error');
      }

      isSyncing = false;
      return result;
    } catch (error) {
      isSyncing = false;
      notifyListeners('offline');
      return { success: false, error: 'Failed to connect to server' };
    }
  },

  // Pull data from Google Sheets
  async pull(): Promise<{ clauses: any[]; contracts: any[]; deals: any[] } | null> {
    try {
      const response = await fetch(`${API_BASE}/api/sync/pull`, {
        credentials: 'include'
      });

      const result = await response.json();
      if (result.success) {
        return { clauses: result.clauses, contracts: result.contracts, deals: result.deals };
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  // Get sync status
  async getSyncStatus(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE}/api/sync/status`, {
        credentials: 'include'
      });
      return await response.json();
    } catch (error) {
      return { ready: false };
    }
  },

  // Schedule debounced auto-sync
  scheduleSync(getClauses: () => any[], getContracts: () => any[], getDeals?: () => any[]) {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }

    syncTimeout = setTimeout(async () => {
      const status = await this.getAuthStatus();
      if (status.authenticated) {
        await this.syncAll(getClauses(), getContracts(), getDeals?.() || []);
      }
    }, 2000); // 2 second debounce
  },

  // Add listener for sync status changes
  onSyncStatusChange(listener: (status: 'syncing' | 'synced' | 'error' | 'offline') => void) {
    syncListeners.push(listener);
    return () => {
      syncListeners = syncListeners.filter(l => l !== listener);
    };
  },

  // Check if currently syncing
  isSyncing() {
    return isSyncing;
  }
};

function notifyListeners(status: 'syncing' | 'synced' | 'error' | 'offline') {
  syncListeners.forEach(listener => listener(status));
}

export default googleSync;
