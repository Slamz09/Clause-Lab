import { useState, useEffect } from 'react';
import { Cloud, CloudOff, Loader2, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { googleSync, SyncStatus } from '@/services/googleSync';
import { database } from '@/services/database';

type SyncState = 'disconnected' | 'syncing' | 'synced' | 'error' | 'offline';

export function GoogleSyncStatus() {
  const [authStatus, setAuthStatus] = useState<SyncStatus | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('disconnected');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();

    // Check for auth callback result
    const urlParams = new URLSearchParams(window.location.search);
    const authResult = urlParams.get('auth');
    if (authResult === 'success') {
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
      // Initialize and sync
      initializeAndSync();
    } else if (authResult === 'error') {
      window.history.replaceState({}, '', window.location.pathname);
      setSyncState('error');
    }

    // Listen for sync status changes
    const unsubscribe = googleSync.onSyncStatusChange((status) => {
      setSyncState(status);
    });

    return () => unsubscribe();
  }, []);

  const checkAuthStatus = async () => {
    setIsLoading(true);
    const status = await googleSync.getAuthStatus();
    setAuthStatus(status);
    if (status.authenticated) {
      setSyncState('synced');
    } else {
      setSyncState('disconnected');
    }
    setIsLoading(false);
  };

  const initializeAndSync = async () => {
    setSyncState('syncing');
    const initResult = await googleSync.init();
    if (initResult.success) {
      // Sync all data
      const clauses = database.getClauses();
      const contracts = database.getContracts();
      await googleSync.syncAll(clauses, contracts);
      await checkAuthStatus();
    } else {
      setSyncState('error');
    }
  };

  const handleConnect = () => {
    googleSync.login();
  };

  const handleDisconnect = async () => {
    await googleSync.logout();
    setAuthStatus(null);
    setSyncState('disconnected');
  };

  const handleSyncNow = async () => {
    setSyncState('syncing');
    const clauses = database.getClauses();
    const contracts = database.getContracts();
    const result = await googleSync.syncAll(clauses, contracts);
    if (!result.success) {
      setSyncState('error');
    }
  };

  if (isLoading) {
    return (
      <div className="p-3 rounded-lg bg-sidebar-accent/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Checking connection...</span>
        </div>
      </div>
    );
  }

  if (!authStatus?.authenticated) {
    return (
      <div className="p-3 rounded-lg bg-sidebar-accent/50">
        <div className="flex items-center gap-2 mb-2">
          <CloudOff className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Google Sync</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Connect to auto-backup your data to Google Sheets
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleConnect}
          className="w-full text-xs"
        >
          <Cloud className="w-3 h-3 mr-1" />
          Connect Google
        </Button>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg bg-sidebar-accent/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {syncState === 'syncing' && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          )}
          {syncState === 'synced' && (
            <Check className="w-4 h-4 text-green-400" />
          )}
          {syncState === 'error' && (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          {syncState === 'offline' && (
            <CloudOff className="w-4 h-4 text-yellow-400" />
          )}
          <span className="text-sm font-medium">
            {syncState === 'syncing' && 'Syncing...'}
            {syncState === 'synced' && 'Synced'}
            {syncState === 'error' && 'Sync Error'}
            {syncState === 'offline' && 'Offline'}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-2 truncate">
        {authStatus.user?.email}
      </p>

      <div className="flex gap-1">
        {authStatus.spreadsheetId && (
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-xs h-7 px-2"
            onClick={() => window.open(
              `https://docs.google.com/spreadsheets/d/${authStatus.spreadsheetId}`,
              '_blank'
            )}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Sheet
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="flex-1 text-xs h-7 px-2"
          onClick={handleSyncNow}
          disabled={syncState === 'syncing'}
        >
          {syncState === 'syncing' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            'Sync'
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs h-7 px-2 text-muted-foreground hover:text-red-400"
          onClick={handleDisconnect}
        >
          <CloudOff className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
