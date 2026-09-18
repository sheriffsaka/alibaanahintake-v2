import React, { useState, useCallback, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getDashboardData } from '../../services/apiService';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Button from '../common/Button';
import { Users, BookCheck, UserCheck, CalendarDays, AlertCircle, RefreshCw } from 'lucide-react';
import { usePolling } from '../../hooks/usePolling';
import { useAuth } from '../../hooks/useAuth';
import { getAdminGenderFilter } from '../../types';
import { supabase, safeRefreshSession, syncRealtimeAuth } from '../../services/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import { withHardTimeout, isHardTimeoutError, HARD_TIMEOUT_USER_MESSAGE } from '../../utils/withHardTimeout';

interface DashboardData {
    totalRegistered: number;
    breakdownByLevel: { name: string; value: number }[];
    todayExpected: number;
    checkedIn: number;
    slotUtilization: { name: string; booked: number; capacity: number }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19A3', '#19FFD8'];
const POLLING_INTERVAL = 30000; // 30 seconds

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Determine gender filter based on admin role
  const adminGenderFilter = React.useMemo(() => {
    return getAdminGenderFilter(user?.role, user?.name);
  }, [user]);

  const isFetchingRef = React.useRef(false);
  const fetchDashboardDataRef = React.useRef<() => Promise<void>>(() => Promise.resolve());

  const fetchDashboardData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setError(null);

    try {
      const dashboardData = await withHardTimeout(
        () => getDashboardData(adminGenderFilter),
        15000,
        "Fetching dashboard data"
      );
      setData(dashboardData);
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
      if (isHardTimeoutError(err)) {
        setError(HARD_TIMEOUT_USER_MESSAGE);
      } else {
        setError("Could not load dashboard data. Retrying in background...");
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [adminGenderFilter]);

  const handleRetry = useCallback(() => {
    isFetchingRef.current = false;
    setLoading(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchDashboardDataRef.current = fetchDashboardData;
  }, [fetchDashboardData]);

  // Set up polling for background refresh
  usePolling(fetchDashboardData, POLLING_INTERVAL);

  // Set up Realtime subscription with stable channel naming and lifecycle cleanup
  useEffect(() => {
    let activeChannel: RealtimeChannel | null = null;
    let isDisposed = false;
    let isConnecting = false;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let syncDebounceTimer: NodeJS.Timeout | null = null;

    const setupRealtimeChannel = async () => {
      if (isDisposed || isConnecting) return;
      if (activeChannel && (activeChannel.state === 'joining' || activeChannel.state === 'joined')) {
        return;
      }
      isConnecting = true;

      try {
        if (activeChannel) {
          const oldChannel = activeChannel;
          activeChannel = null;
          await supabase.removeChannel(oldChannel);
        }

        const session = await safeRefreshSession();
        if (session?.access_token) {
          await syncRealtimeAuth(session.access_token);
        }

        if (isDisposed) {
          isConnecting = false;
          return;
        }

        const channel = supabase.channel('admin-dashboard-students');
        activeChannel = channel;

        channel
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'students' },
            () => {
              if (!isDisposed && (typeof document === 'undefined' || document.visibilityState === 'visible')) {
                fetchDashboardDataRef.current();
              }
            }
          )
          .subscribe((status) => {
            if (activeChannel !== channel || isDisposed) {
              return;
            }

            if (status === 'SUBSCRIBED') {
              isConnecting = false;
              fetchDashboardDataRef.current();
            } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              isConnecting = false;
              console.warn(`[Dashboard] Realtime status: ${status}`);
              
              // Only schedule a reconnection if visible and not already handled
              if (document.visibilityState === 'visible' && !reconnectTimeout) {
                reconnectTimeout = setTimeout(() => {
                  reconnectTimeout = null;
                  if (!isDisposed && document.visibilityState === 'visible') {
                    setupRealtimeChannel();
                  }
                }, 8000);
              }
            }
          });
      } catch (err) {
        isConnecting = false;
        console.warn('[Dashboard] Setup Realtime channel exception:', err);
      }
    };

    setupRealtimeChannel();

    const handleSyncAndReconnect = () => {
      if (isDisposed) return;
      if (document.visibilityState !== 'visible') return;

      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      syncDebounceTimer = setTimeout(async () => {
        if (isDisposed || (typeof document !== 'undefined' && document.visibilityState !== 'visible')) return;
        isFetchingRef.current = false;
        await safeRefreshSession();
        fetchDashboardDataRef.current();

        const isChannelActive = activeChannel && (activeChannel.state === 'joining' || activeChannel.state === 'joined');
        if (!isConnecting && !isChannelActive) {
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          setupRealtimeChannel();
        }
      }, 300);
    };

    document.addEventListener('visibilitychange', handleSyncAndReconnect);
    window.addEventListener('focus', handleSyncAndReconnect);
    window.addEventListener('online', handleSyncAndReconnect);

    return () => {
      isDisposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      document.removeEventListener('visibilitychange', handleSyncAndReconnect);
      window.removeEventListener('focus', handleSyncAndReconnect);
      window.removeEventListener('online', handleSyncAndReconnect);
      
      if (activeChannel) {
        const chanToCleanup = activeChannel;
        activeChannel = null;
        supabase.removeChannel(chanToCleanup);
      }
    };
  }, []);

  const filteredBreakdown = React.useMemo(() => 
    data?.breakdownByLevel.filter(item => item.value > 0) || [], 
    [data?.breakdownByLevel]
  );

  if (loading && !data) return <div className="flex justify-center items-center h-64"><Spinner /></div>;
  
  if (error && !data) {
    return (
      <Card title="Live Enrollment Dashboard">
        <div className="p-12 text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Dashboard</h3>
          <p className="text-gray-600 mb-6">{error.replace(" Retrying in background...", "")}</p>
          <Button onClick={handleRetry} className="inline-flex items-center">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!data) return <p>No dashboard data available.</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Live Enrollment Dashboard</h1>
          {adminGenderFilter && (
            <p className="text-sm text-gray-500 mt-1">
              Filtered for: <span className="font-semibold text-brand-green-dark">{adminGenderFilter} Section</span>
            </p>
          )}
        </div>
        {error && (
          <div className="flex items-center gap-2 p-2 px-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={handleRetry}
              className="ml-2 font-semibold underline hover:text-amber-900 focus:outline-none"
            >
              Retry
            </button>
          </div>
        )}
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-full"><Users className="h-6 w-6 text-blue-600"/></div>
            <div>
                <p className="text-sm text-gray-500">Total Registered</p>
                <p className="text-2xl font-bold text-gray-800">{data.totalRegistered}</p>
            </div>
        </Card>
        <Card className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 rounded-full"><CalendarDays className="h-6 w-6 text-green-600"/></div>
            <div>
                <p className="text-sm text-gray-500">Today&apos;s Expected</p>
                <p className="text-2xl font-bold text-gray-800">{data.todayExpected}</p>
            </div>
        </Card>
        <Card className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-100 rounded-full"><UserCheck className="h-6 w-6 text-indigo-600"/></div>
            <div>
                <p className="text-sm text-gray-500">Checked-In Today</p>
                <p className="text-2xl font-bold text-gray-800">{data.checkedIn}</p>
            </div>
        </Card>
         <Card className="flex items-center space-x-4">
            <div className="p-3 bg-yellow-100 rounded-full"><BookCheck className="h-6 w-6 text-yellow-600"/></div>
            <div>
                <p className="text-sm text-gray-500">Check-in Rate</p>
                <p className="text-2xl font-bold text-gray-800">{data.todayExpected > 0 ? `${Math.round((data.checkedIn/data.todayExpected)*100)}%` : 'N/A'}</p>
            </div>
        </Card>
      </div>

      {/* Charts Layout - Split 50/50 to enlarge the PieChart section and avoid overlaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Registration by Level">
          <ResponsiveContainer width="100%" height={360}>
            <PieChart>
              <Pie
                data={filteredBreakdown}
                cx="50%"
                cy="48%"
                labelLine={true}
                outerRadius={95}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {filteredBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, `Count (${name})`]} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Upcoming Slot Utilization">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={data.slotUtilization}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} tick={{fontSize: 10}}/>
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="booked" stackId="a" fill="#8884d8" name="Booked" />
              <Bar dataKey="capacity" stackId="b" fill="#82ca9d" name="Total Capacity" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
