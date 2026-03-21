import React, { useEffect, useState } from 'react';
import { testConnection } from '../../services/apiService';
import { AlertCircle, RefreshCw } from 'lucide-react';

const DatabaseStatus: React.FC = () => {
  const [status, setStatus] = useState<'testing' | 'connected' | 'error'>('testing');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      setStatus('testing');
      const result = await testConnection();
      if (!isMounted) return;
      if (result.success) {
        setStatus('connected');
        setErrorDetails(null);
      } else {
        setStatus('error');
        const err = result.error;
        if (err && typeof err === 'object') {
          setErrorDetails((err as any).message || (err as any).error_description || JSON.stringify(err));
        } else {
          setErrorDetails(String(err));
        }
      }
    };

    check();
    return () => { isMounted = false; };
  }, []);

  const handleRetry = () => {
    const check = async () => {
      setStatus('testing');
      const result = await testConnection();
      if (result.success) {
        setStatus('connected');
        setErrorDetails(null);
      } else {
        setStatus('error');
        const err = result.error;
        if (err && typeof err === 'object') {
          setErrorDetails((err as any).message || (err as any).error_description || JSON.stringify(err));
        } else {
          setErrorDetails(String(err));
        }
      }
    };
    check();
  };

  if (status === 'connected') return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-lg border ${
      status === 'testing' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-red-50 border-red-200 text-red-800'
    }`}>
      <div className="flex items-center gap-3">
        {status === 'testing' ? (
          <RefreshCw className="h-5 w-5 animate-spin" />
        ) : (
          <AlertCircle className="h-5 w-5" />
        )}
        <div>
          <p className="font-semibold text-sm">
            {status === 'testing' ? 'Testing Database Connection...' : 'Database Connection Failed'}
          </p>
          {errorDetails && (
            <div className="mt-1">
              <p className="text-xs font-mono bg-black/5 p-1 rounded break-all max-w-[250px]">
                {errorDetails}
              </p>
              <p className="text-[10px] opacity-60 mt-1">
                Check your Supabase URL and Key in Settings.
              </p>
            </div>
          )}
        </div>
        {status === 'error' && (
          <button 
            onClick={handleRetry}
            className="ml-2 p-1 hover:bg-red-100 rounded-full transition-colors"
            title="Retry Connection"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default DatabaseStatus;
