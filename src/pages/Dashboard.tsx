import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Moon, Sun } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

interface ChartData {
  name: string;
  sales: number;
  revenue: number;
  channel?: string;
}

interface DashboardMetrics {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  lowStockProducts: number;
  totalOrders: number;
  totalRevenue: number;
}

export default function Dashboard() {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    todayOrders: 0,
    todayRevenue: 0,
    pendingOrders: 0,
    lowStockProducts: 0,
    totalOrders: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState('All');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load monthly chart data
      const reportsResponse = await fetch('/api/reports?type=monthly', {
        credentials: 'include'
      });
      
      if (reportsResponse.ok) {
        const reportsData = await reportsResponse.json();
        const formattedData = reportsData.data.map((item: any) => ({
          name: item.date,
          sales: item.sales,
          revenue: item.revenue,
          channel: 'All'
        }));
        setChartData(formattedData);
      }

      // Load dashboard metrics
      const ordersResponse = await fetch('/api/orders', {
        credentials: 'include'
      });
      
      const inventoryResponse = await fetch('/api/inventory/low-stock', {
        credentials: 'include'
      });
      
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        const orders = ordersData.orders || [];
        
        const today = new Date().toISOString().split('T')[0];
        const todayOrders = orders.filter((order: any) => 
          order.order_date?.startsWith(today) || order.created_at?.startsWith(today)
        );
        const pendingOrders = orders.filter((order: any) => order.status === 'pending');
        
        const totalRevenue = orders.reduce((sum: number, order: any) => 
          sum + (parseFloat(order.total_amount) || 0), 0
        );
        const todayRevenue = todayOrders.reduce((sum: number, order: any) => 
          sum + (parseFloat(order.total_amount) || 0), 0
        );
        
        let lowStockCount = 0;
        if (inventoryResponse.ok) {
          const inventoryData = await inventoryResponse.json();
          lowStockCount = inventoryData.length || 0;
        }
        
        setMetrics({
          todayOrders: todayOrders.length,
          todayRevenue,
          pendingOrders: pendingOrders.length,
          lowStockProducts: lowStockCount,
          totalOrders: orders.length,
          totalRevenue
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const filteredData = useMemo(() => {
    return selectedChannel === 'All'
      ? chartData
      : chartData.filter(data => data.channel === selectedChannel);
  }, [selectedChannel, chartData]);

  return (
    <div className={`p-4 sm:p-6 md:p-8 min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-0">Dashboard</h1>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white shadow-md"
        >
          {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
        </button>
      </div>

      {/* Dashboard Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Today's Orders</h3>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {loading ? '...' : metrics.todayOrders}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Today's Revenue</h3>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {loading ? '...' : formatCurrency(metrics.todayRevenue)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Orders</h3>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {loading ? '...' : metrics.pendingOrders}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Low Stock Items</h3>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {loading ? '...' : metrics.lowStockProducts}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 sm:gap-8">
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Monthly Sales Performance</h2>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-lg">Loading chart data...</div>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-lg text-gray-500">No sales data available</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#4B5563' : '#E5E7EB'} />
                <XAxis dataKey="name" stroke={isDarkMode ? '#D1D5DB' : '#4B5563'} />
                <YAxis stroke={isDarkMode ? '#D1D5DB' : '#4B5563'} />
                <Tooltip 
                  contentStyle={{ backgroundColor: isDarkMode ? '#374151' : '#FFFFFF', border: 'none' }} 
                  itemStyle={{ color: isDarkMode ? '#FFFFFF' : '#1F2937' }}
                />
                <Legend />
                <Line type="monotone" dataKey="sales" stroke={isDarkMode ? '#818CF8' : '#8884d8'} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Monthly Revenue Breakdown</h2>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-lg">Loading chart data...</div>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-lg text-gray-500">No revenue data available</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#4B5563' : '#E5E7EB'} />
                <XAxis dataKey="name" stroke={isDarkMode ? '#D1D5DB' : '#4B5563'} />
                <YAxis stroke={isDarkMode ? '#D1D5DB' : '#4B5563'} />
                <Tooltip 
                  contentStyle={{ backgroundColor: isDarkMode ? '#374151' : '#FFFFFF', border: 'none' }} 
                  itemStyle={{ color: isDarkMode ? '#FFFFFF' : '#1F2937' }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Legend />
                <Bar dataKey="revenue" fill={isDarkMode ? '#34D399' : '#82ca9d'} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}