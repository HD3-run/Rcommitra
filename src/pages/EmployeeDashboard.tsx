import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface AssignedOrder {
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  total_amount: number;
  status: string;
  assigned_at: string;
  delivery_notes?: string;
}

interface Order {
  id: string;
  orderId: string;
  customerName: string;
  channel: string;
  type: string;
  customer: string;
  status: string;
  amount: number;
  date: string;
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [assignedOrders, setAssignedOrders] = useState<AssignedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAssigned: 0,
    completed: 0,
    pending: 0,
    inProgress: 0
  });

  useEffect(() => {
    loadAssignedOrders();
  }, []);

  const loadAssignedOrders = async () => {
    try {
      console.log('Loading assigned orders for employee dashboard');
      const response = await fetch('/api/orders', {
        credentials: 'include'
      });
      console.log('Employee dashboard API response:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Employee dashboard data:', data);
        
        if (data.orders && Array.isArray(data.orders)) {
          const formattedOrders = data.orders.map((order: any) => ({
            order_id: order.order_id.toString(),
            order_number: `ORD${order.order_id}`,
            customer_name: order.customer_name || 'Unknown',
            customer_phone: order.customer_phone || 'N/A',
            delivery_address: order.customer_address || 'N/A',
            total_amount: parseFloat(order.total_amount) || 0,
            status: order.status || 'pending',
            assigned_at: order.created_at || new Date().toISOString()
          }));
          setAssignedOrders(formattedOrders);
          calculateStats(formattedOrders);
        } else {
          setAssignedOrders([]);
          calculateStats([]);
        }
      } else {
        console.error('Failed to load orders:', response.status);
        setAssignedOrders([]);
        calculateStats([]);
      }
    } catch (error) {
      console.error('Failed to load assigned orders:', error);
      setAssignedOrders([]);
      calculateStats([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (orders: AssignedOrder[]) => {
    const stats = {
      totalAssigned: orders.length,
      completed: orders.filter(o => o.status === 'delivered').length,
      pending: orders.filter(o => o.status === 'pending').length,
      inProgress: orders.filter(o => o.status === 'shipped').length
    };
    setStats(stats);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/employee/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        loadAssignedOrders(); // Reload to get updated data
      }
    } catch (error) {
      console.error('Failed to update order status');
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Welcome, {user?.username}</h1>
        <p className="text-gray-600 dark:text-gray-400">Role: {user?.role}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Total Assigned</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.totalAssigned}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Pending</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">In Progress</h3>
          <p className="text-3xl font-bold text-orange-600">{stats.inProgress}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Completed</h3>
          <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
        </div>
      </div>

      {/* Current Orders */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">Current Assigned Orders</h2>
        </div>
        
        {assignedOrders.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            No orders assigned to you yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Order #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {assignedOrders.map((order) => (
                  <tr key={order.order_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {order.order_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {order.customer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {order.customer_phone}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs truncate">
                      {order.delivery_address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      ₹{order.total_amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'confirmed' ? 'bg-purple-100 text-purple-800' :
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.order_id, e.target.value)}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}