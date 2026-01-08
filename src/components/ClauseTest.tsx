import { useEffect, useState } from 'react';
import { database } from "@/services/database";
import { Button } from "./ui/button";

export function ClauseTest() {
  const [status, setStatus] = useState<string>('Checking database connection...');
  const [error, setError] = useState<string | null>(null);
  const [clauses, setClauses] = useState<any[]>([]);

  const testConnection = async () => {
    try {
      setStatus('Querying local storage...');
      setError(null);
      
      const data = database.getClauses();
      
      setClauses(data || []);
      setStatus(`✅ Successfully connected to Local Storage. Found ${data?.length || 0} clauses.`);
    } catch (err: any) {
      console.error('Database error:', err);
      setError(err.message || 'Unknown error occurred');
      setStatus('❌ Failed to access Local Storage');
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Local Storage Connection Test</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Connection Status</h2>
          <div className="p-4 bg-gray-50 rounded border">
            <p className={status.includes('✅') ? 'text-green-600' : 'text-red-600'}>{status}</p>
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                <h3 className="font-medium text-red-800">Error Details:</h3>
                <pre className="mt-2 text-sm text-red-600 overflow-auto">{error}</pre>
              </div>
            )}
          </div>
        </div>

        {clauses.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Sample Clauses</h2>
            <div className="space-y-4">
              {clauses.map((clause) => (
                <div key={clause.id} className="p-4 border rounded">
                  <h3 className="font-medium">{clause.clause_type}</h3>
                  <p className="text-sm text-gray-600">{clause.contract_type} • {clause.industry}</p>
                  <p className="mt-2 text-sm">
                    {clause.clause_text.length > 200 
                      ? `${clause.clause_text.substring(0, 200)}...` 
                      : clause.clause_text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <Button 
            onClick={testConnection}
            variant="outline"
            className="bg-blue-50 hover:bg-blue-100 text-blue-700"
          >
            Test Again
          </Button>
        </div>
      </div>
    </div>
  );
}
