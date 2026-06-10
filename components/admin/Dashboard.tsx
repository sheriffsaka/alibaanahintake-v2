import React, { useState, useCallback, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getDashboardData } from '../../services/apiService';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import { Users, BookCheck, UserCheck, CalendarDays } from 'lucide-react';
import { usePolling } from '../../hooks/usePolling';
import { useAuth } from '../../hooks/useAuth';
import { Role, Gender } from '../../types';

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
    if (!user) return undefined;
    if (user.role === Role.MaleAdmin || user.role === Role.MaleFrontDesk) {
      return Gender.Male;
    }
    if (user.role === Role.FemaleAdmin || user.role === Role.FemaleFrontDesk) {
      return Gender.Female;
    }
    return undefined; // Super Admin sees all
  }, [user]);

  const isFetchingRef = React.useRef(false);

  const fetchDashboardData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setError(null);
    
    const isPending = { current: true };
    const timeoutId = setTimeout(() => {
        if (isPending.current) {
            setError("Request timed out. Retrying in background...");
            setLoading(false);
        }
    }, 15000); // 15 second timeout

    try {
      const dashboardData = await getDashboardData();
      isPending.current = false;
      clearTimeout(timeoutId);
      setData(dashboardData);
    } catch (err) {
      isPending.current = false;
      clearTimeout(timeoutId);
      console.error("Failed to fetch dashboard data", err);
      setError("Could not load dashboard data. Retrying in background...");
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  // Set up polling for background refresh
  usePolling(fetchDashboardData, POLLING_INTERVAL);

  // Sync / update data immediately whenever the administrator visits/focuses the page
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchDashboardData]);

  const filteredBreakdown = React.useMemo(() => 
    data?.breakdownByLevel.filter(item => item.value > 0) || [], 
    [data?.breakdownByLevel]
  );

  if (loading && !data) return <div className="flex justify-center items-center h-64"><Spinner /></div>;
  
  if (error && !data) return <p className="text-center text-red-500">{error.replace(" Retrying in background...", "")}</p>;

  if (!data) return <p>No dashboard data available.</p>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Live Enrollment Dashboard</h1>
          {adminGenderFilter && (
            <p className="text-sm text-gray-500 mt-1">
              Filtered for: <span className="font-semibold text-brand-green-dark">{adminGenderFilter} Section</span>
            </p>
          )}
        </div>
        {error && <div className="text-xs text-yellow-600 animate-pulse">Connection issue. Retrying...</div>}
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
