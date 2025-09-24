import { useState, useEffect } from "react";
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import FileUpload from '../components/FileUpload';
import DownloadDropdown from '../components/DownloadDropdown';
import { logActivity } from '../utils/activityLogger';
import { formatCurrency } from '../utils/currency';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Order {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  channel: string;
  type: string;
  customer: string;
  status: string;
  amount: number;
  date: string;
  paymentStatus?: string;
  user_id?: number;
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'assigned' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'>('all');
  const [sortKey, setSortKey] = useState<keyof Order>('orderId');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [employees, setEmployees] = useState([]);
  const [assignmentData, setAssignmentData] = useState({
    userId: '',
    deliveryNotes: ''
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<Order | null>(null);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'cash'
  });
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [newOrder, setNewOrder] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    productName: '',
    quantity: 1,
    unitPrice: 0,
    orderSource: 'Manual'
  });

  const { lastMessage } = useWebSocket();
  const { user } = useAuth();
  useTheme();
  const userRole = user?.role || 'admin';

  useEffect(() => {
    loadEmployees();
    loadOrders();
  }, [userRole]);



  const loadOrders = async () => {
    try {
      console.log('Loading orders for user role:', userRole);
      const response = await fetch('/api/orders', {
        credentials: 'include'
      });
      
      console.log('Orders API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Orders API response data:', data);
        
        if (data.orders && Array.isArray(data.orders)) {
          const formattedOrders = data.orders.map((order: any) => ({
            id: order.order_id.toString(),
            orderId: `ORD${order.order_id}`,
            customerId: `CUS${order.customer_id}`,
            customerName: order.customer_name || 'Unknown',
            amount: parseFloat(order.total_amount) || 0,
            status: order.status || 'pending',
            date: new Date(order.order_date || order.created_at).toISOString().split('T')[0],
            channel: order.order_source || 'Unknown',
            type: 'Standard',
            customer: order.customer_name || 'Unknown',
            paymentStatus: order.payment_status || 'pending',
            user_id: order.user_id
          }));
          console.log('Formatted orders:', formattedOrders);
          setOrders(formattedOrders);
        } else {
          console.log('No orders array in response or empty array');
          setOrders([]);
        }
      } else {
        console.error('Orders API failed with status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        setOrders([]);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lastMessage) {
      try {
        const update = JSON.parse(lastMessage);
        if (update.type === 'orderStatusUpdate' && update.orderId && update.newStatus) {
          setOrders(prevOrders =>
            prevOrders.map(order =>
              order.orderId === update.orderId ? { ...order, status: update.newStatus } : order
            )
          );
          logActivity("Order status updated via WebSocket", { orderId: update.orderId, newStatus: update.newStatus });
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    }
  }, [lastMessage]);

  const handleFileUpload = async (file: File) => {
    console.log('File uploaded:', file.name);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/orders/upload-csv', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`${result.message}\n\nCreated: ${result.created} orders\nErrors: ${result.errors}`);
        // Reload orders from database
        loadOrders();
      } else {
        alert(`Upload failed: ${result.message}`);
      }
    } catch (error) {
      alert('Upload failed: Network error');
    }
    
    logActivity("File uploaded", { fileName: file.name, fileSize: file.size });
  };

  const handleDownloadCSV = () => {
    const csvHeaders = ['Order ID', 'Customer ID', 'Customer Name', 'Channel', 'Status', 'Payment Status', 'Amount', 'Date'];
    const csvData = filteredOrders.map(order => [
      order.orderId,
      order.customerId,
      order.customerName,
      order.channel,
      order.status,
      order.paymentStatus || 'pending',
      order.amount,
      order.date
    ]);
    
    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    logActivity("Orders CSV downloaded", { recordCount: filteredOrders.length });
  };

  const handleDownloadExcel = () => {
    const headers = ['Order ID', 'Customer ID', 'Customer Name', 'Channel', 'Status', 'Payment Status', 'Amount', 'Date'];
    const data = filteredOrders.map(order => [
      order.orderId,
      order.customerId,
      order.customerName,
      order.channel,
      order.status,
      order.paymentStatus || 'pending',
      order.amount,
      order.date
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, `orders_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    logActivity("Orders Excel downloaded", { recordCount: filteredOrders.length });
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Orders Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 25);
    
    const headers = [['Order ID', 'Customer ID', 'Customer Name', 'Channel', 'Status', 'Payment Status', 'Amount', 'Date']];
    const data = filteredOrders.map(order => [
      order.orderId,
      order.customerId,
      order.customerName,
      order.channel,
      order.status,
      order.paymentStatus || 'pending',
      formatCurrency(order.amount),
      order.date
    ]);
    
    autoTable(doc, {
      head: headers,
      body: data,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    doc.save(`orders_${new Date().toISOString().split('T')[0]}.pdf`);
    
    logActivity("Orders PDF downloaded", { recordCount: filteredOrders.length });
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.customerId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || order.status === filterType;

    return matchesSearch && matchesFilter;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const aValue = a[sortKey];
    const bValue = b[sortKey];

    // Special handling for orderId to sort numerically
    if (sortKey === 'orderId') {
      const aStr = typeof aValue === 'string' ? aValue : String(aValue ?? '');
      const bStr = typeof bValue === 'string' ? bValue : String(bValue ?? '');
      const aNum = parseInt(aStr.replace('ORD', '')) || 0;
      const bNum = parseInt(bStr.replace('ORD', '')) || 0;
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    }
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }
    return 0;
  });



  const loadEmployees = async () => {
    // Only load employees if user is admin
    if (userRole !== 'admin') {
      return;
    }
    
    try {
      const response = await fetch('/api/users', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.users.filter((user: any) => user.role !== 'admin'));
      }
    } catch (error) {
      console.error('Failed to load employees');
    }
  };

  const handleAssignOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowAssignModal(true);
  };

  const submitAssignment = async () => {
    if (!selectedOrder || !assignmentData.userId) return;
    
    try {
      const response = await fetch('/api/orders/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          orderId: selectedOrder.id,
          userId: assignmentData.userId,
          deliveryNotes: assignmentData.deliveryNotes
        })
      });
      
      if (response.ok) {
        alert('Order assigned successfully!');
        setShowAssignModal(false);
        setAssignmentData({ userId: '', deliveryNotes: '' });
        setSelectedOrder(null);
        loadOrders(); // Refresh orders
      } else {
        alert('Failed to assign order');
      }
    } catch (error) {
      alert('Failed to assign order');
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      const endpoint = userRole === 'admin' 
        ? `/api/orders/${orderId}/status` 
        : `/api/employee/orders/${orderId}/status`;
      
      const method = userRole === 'admin' ? 'PATCH' : 'PUT';
      
      const response = await fetch(endpoint, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        // Update local state
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === orderId ? { ...order, status: newStatus } : order
          )
        );
      } else {
        alert('Failed to update order status');
      }
    } catch (error) {
      alert('Failed to update order status');
    }
  };

  const handlePaymentUpdate = async (orderId: string, paymentStatus: string, paymentMethod: string = 'cash', amount?: number) => {
    try {
      const response = await fetch(`/api/orders/${orderId}/payment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ 
          status: paymentStatus, 
          paymentMethod: paymentMethod,
          amount: amount
        })
      });
      
      if (response.ok) {
        alert(`Payment marked as ${paymentStatus}`);
        loadOrders(); // Refresh to show updated payment status
      } else {
        const errorData = await response.json();
        alert(`Failed to update payment: ${errorData.message}`);
      }
    } catch (error) {
      alert('Failed to update payment status');
    }
  };
  
  const handlePaymentClick = (order: Order, status: string) => {
    if (status === 'paid') {
      setSelectedPaymentOrder(order);
      setPaymentData({ amount: order.amount, paymentMethod: 'cash' });
      setShowPaymentModal(true);
    } else {
      handlePaymentUpdate(order.id, status);
    }
  };
  
  const submitPayment = async () => {
    if (!selectedPaymentOrder) return;
    
    await handlePaymentUpdate(
      selectedPaymentOrder.id, 
      'paid', 
      paymentData.paymentMethod, 
      paymentData.amount
    );
    
    setShowPaymentModal(false);
    setSelectedPaymentOrder(null);
    setPaymentData({ amount: 0, paymentMethod: 'cash' });
  };

  const handleAddOrder = async () => {
    try {
      console.log('Sending order data:', newOrder);
      const response = await fetch('/api/orders/add-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(newOrder)
      });
      
      console.log('Response status:', response.status);
      
      if (response.ok) {
        alert('Order added successfully!');
        setShowAddOrderModal(false);
        setNewOrder({
          customerName: '',
          customerPhone: '',
          customerEmail: '',
          customerAddress: '',
          productName: '',
          quantity: 1,
          unitPrice: 0,
          orderSource: 'Manual'
        });
        loadOrders();
      } else {
        const errorData = await response.json();
        console.log('Error response:', errorData);
        if (response.status === 401) {
          alert('Session expired. Please log in again.');
          window.location.href = '/login';
        } else {
          alert(`Failed to add order: ${errorData.message || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Network error:', error);
      alert('Failed to add order: Network error');
    }
  };





  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-900 dark:text-white">Orders</h1>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading orders...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-light-pink dark:bg-gray-900 text-gray-900 dark:text-white">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-900 dark:text-white">Orders</h1>

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0 sm:space-x-4">
        <input
          type="text"
          placeholder="Search by customer, customer ID, or order ID..."
          className="p-2 border border-gray-300 dark:border-gray-700 rounded-md w-full sm:w-auto bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="flex space-x-2 w-full sm:w-auto">
          <select
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'pending' | 'assigned' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled')}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as keyof Order)}
          >
            <option value="orderId">Sort by Order ID</option>
            <option value="date">Sort by Date</option>
            <option value="amount">Sort by Amount</option>
            <option value="status">Sort by Status</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            {sortOrder === 'asc' ? 'Asc' : 'Desc'}
          </button>
        </div>
      </div>

      {userRole === 'admin' && (
        <div className="mb-6">
          <FileUpload onFileUpload={handleFileUpload} />
          
          {/* CSV Format Instructions */}
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">CSV Upload Format:</h3>
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">Your CSV file should include these columns (in any order):</p>
            <div className="text-xs font-mono bg-white dark:bg-gray-800 p-2 rounded border overflow-x-auto">
              <div className="text-gray-600 dark:text-gray-400">customer_name, customer_phone, customer_email, customer_address, product_name, quantity, unit_price, order_source</div>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              <strong>Example:</strong> John Doe, +1234567890, john@email.com, 123 Main St, Product A, 2, 25.50, CSV
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              <strong>Note:</strong> You can also use spaces in column names like "Customer Name" instead of "customer_name"
            </p>
          </div>
          
          <div className="mt-4 space-y-2">
            <DownloadDropdown
              onDownloadCSV={handleDownloadCSV}
              onDownloadExcel={handleDownloadExcel}
              onDownloadPDF={handleDownloadPDF}
            />
            
            <button
              onClick={() => setShowAddOrderModal(true)}
              className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors w-full"
            >
              Add Order Manually
            </button>

          </div>
        </div>
      )}

      <div className="overflow-x-auto bg-light-pink-100 dark:bg-gray-800 rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Order ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Channel</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Order Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Payment</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-light-pink-100 dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedOrders.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  {loading ? 'Loading orders...' : 
                   userRole === 'admin' ? 'No orders found. Upload a CSV file or create orders manually.' :
                   'No orders assigned to you yet. Contact your admin to assign orders.'}
                </td>
              </tr>
            ) : (
              sortedOrders.map((order) => (
              <tr key={order.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{order.orderId}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{order.customerId}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{order.customerName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{order.channel}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{order.type}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                    order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                    order.status === 'confirmed' ? 'bg-purple-100 text-purple-800' :
                    order.status === 'assigned' ? 'bg-indigo-100 text-indigo-800' :
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex flex-col space-y-1">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                      order.paymentStatus === 'failed' ? 'bg-red-100 text-red-800' :
                      order.paymentStatus === 'refunded' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.paymentStatus || 'pending'}
                    </span>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handlePaymentClick(order, 'paid')}
                        disabled={order.paymentStatus === 'paid'}
                        className={`px-2 py-1 text-xs rounded ${
                          order.paymentStatus === 'paid' 
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                            : 'bg-green-500 text-white hover:bg-green-600'
                        }`}
                      >
                        Mark Paid
                      </button>
                      <button
                        onClick={() => handlePaymentClick(order, 'pending')}
                        disabled={order.paymentStatus === 'pending'}
                        className={`px-2 py-1 text-xs rounded ${
                          order.paymentStatus === 'pending' 
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                            : 'bg-yellow-500 text-white hover:bg-yellow-600'
                        }`}
                      >
                        Mark Pending
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatCurrency(order.amount)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{order.date}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {userRole === 'admin' ? (
                    <div className="flex space-x-2">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                        className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="pending">Pending</option>
                        <option value="assigned">Assigned</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <button
                        onClick={() => handleAssignOrder(order)}
                        disabled={order.status === 'confirmed' || !!order.user_id}
                        className={`text-xs ${
                          order.status === 'confirmed' || !!order.user_id
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200'
                        }`}
                      >
                        {order.status === 'confirmed' || !!order.user_id ? 'Assigned' : 'Assign'}
                      </button>
                    </div>
                  ) : (
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                      className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="pending">Pending</option>
                      <option value="assigned">Assigned</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  )}
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-gray-600 dark:text-gray-400">
        <h2 className="text-xl font-semibold mb-2">Additional Features Placeholder:</h2>
        <ul className="list-disc list-inside">
          <li>Detailed order view on click</li>
          <li>Pagination for large datasets</li>
        </ul>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Assign Order #{selectedOrder.orderId}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assign to Employee:
                </label>
                <select
                  value={assignmentData.userId}
                  onChange={(e) => setAssignmentData({...assignmentData, userId: e.target.value})}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select Employee</option>
                  {employees.map((employee: any) => (
                    <option key={employee.user_id} value={employee.user_id}>
                      {employee.username} ({employee.role})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Delivery Notes:
                </label>
                <textarea
                  value={assignmentData.deliveryNotes}
                  onChange={(e) => setAssignmentData({...assignmentData, deliveryNotes: e.target.value})}
                  placeholder="Special instructions for delivery..."
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={submitAssignment}
                disabled={!assignmentData.userId}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Assign Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Order Modal */}
      {showAddOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Add New Order</h3>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Customer Name"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newOrder.customerName}
                onChange={(e) => setNewOrder({...newOrder, customerName: e.target.value})}
              />
              <input
                type="tel"
                placeholder="Customer Phone"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newOrder.customerPhone}
                onChange={(e) => setNewOrder({...newOrder, customerPhone: e.target.value})}
              />
              <input
                type="email"
                placeholder="Customer Email"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newOrder.customerEmail}
                onChange={(e) => setNewOrder({...newOrder, customerEmail: e.target.value})}
              />
              <textarea
                placeholder="Customer Address"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={2}
                value={newOrder.customerAddress}
                onChange={(e) => setNewOrder({...newOrder, customerAddress: e.target.value})}
              />
              <input
                type="text"
                placeholder="Product Name"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newOrder.productName}
                onChange={(e) => setNewOrder({...newOrder, productName: e.target.value})}
              />
              <input
                type="number"
                placeholder="Quantity"
                min="1"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newOrder.quantity}
                onChange={(e) => setNewOrder({...newOrder, quantity: parseInt(e.target.value) || 1})}
              />
              <input
                type="number"
                placeholder="Unit Price"
                step="0.01"
                min="0"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newOrder.unitPrice}
                onChange={(e) => setNewOrder({...newOrder, unitPrice: parseFloat(e.target.value) || 0})}
              />
              <select
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newOrder.orderSource}
                onChange={(e) => setNewOrder({...newOrder, orderSource: e.target.value})}
              >
                <option value="Manual">Manual</option>
                <option value="Phone">Phone</option>
                <option value="Email">Email</option>
                <option value="Website">Website</option>
                <option value="WhatsApp">WhatsApp</option>
              </select>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowAddOrderModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAddOrder}
                disabled={!newOrder.customerName || !newOrder.productName}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Add Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedPaymentOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Mark Payment as Paid - Order #{selectedPaymentOrder.orderId}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Amount:
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({...paymentData, amount: parseFloat(e.target.value) || 0})}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter payment amount"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Method:
                </label>
                <select
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData({...paymentData, paymentMethod: e.target.value})}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={submitPayment}
                disabled={paymentData.amount <= 0}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                Mark as Paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}