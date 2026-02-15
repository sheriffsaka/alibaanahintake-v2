
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getDashboardData } from '../../services/mockApiService';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import { Users, BookCheck, UserCheck, CalendarDays } from 'lucide-react';

interface DashboardData {
    totalRegistered: number;
    breakdownByLevel: { name: string; value: number }[];
    todayExpected: number;
    checkedIn: number;
    slotUtilization: { name: string; booked: number; capacity: number }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const dashboardData = await getDashboardData();
        setData(dashboardData);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <p>Could not load dashboard data.</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Live Enrollment Dashboard</h1>
      
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
                <p className="text-sm text-gray-500">Today's Expected</p>
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
                <p className="text-sm text-gray-500">Booked vs Expected</p>
                <p className="text-2xl font-bold text-gray-800">{data.todayExpected > 0 ? `${Math.round((data.checkedIn/data.todayExpected)*100)}%` : 'N/A'}</p>
            </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card title="Registration by Level" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.breakdownByLevel}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.breakdownByLevel.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Slot Utilization (Sample)" className="lg:col-span-3">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.slotUtilization.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} tick={{fontSize: 10}}/>
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="booked" fill="#8884d8" name="Booked" />
              <Bar dataKey="capacity" fill="#82ca9d" name="Capacity" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
