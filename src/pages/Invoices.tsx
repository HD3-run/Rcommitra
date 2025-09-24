import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import FileUpload from '../components/FileUpload';
import DownloadDropdown from '../components/DownloadDropdown';
import { formatCurrency } from '../utils/currency';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Invoice {
  invoice_id: number;
  order_id: number;
  customer_name: string;
  total_amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  due_date: string;
  created_at: string;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    orderId: '',
    dueDate: '',
    status: 'pending'
  });
  
  const { user } = useAuth();
  const { } = useTheme();
  const userRole = user?.role || 'admin';

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const response = await fetch('/api/invoices', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/invoices/upload-csv', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`${result.message}\n\nCreated: ${result.created} invoices`);
        loadInvoices();
      } else {
        alert(`Upload failed: ${result.message}`);
      }
    } catch (error) {
      alert('Upload failed: Network error');
    }
  };

  const handleAddInvoice = async () => {
    try {
      const response = await fetch('/api/invoices/add-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(newInvoice)
      });
      
      if (response.ok) {
        alert('Invoice created successfully!');
        setShowAddModal(false);
        setNewInvoice({ orderId: '', dueDate: '', status: 'pending' });
        loadInvoices();
      } else {
        const errorData = await response.json();
        alert(`Failed to create invoice: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      alert('Failed to create invoice: Network error');
    }
  };

  const handleDownloadCSV = () => {
    const csvHeaders = ['Invoice ID', 'Order ID', 'Customer Name', 'Amount', 'Status', 'Due Date', 'Created Date'];
    const csvData = filteredInvoices.map(invoice => [
      `INV${invoice.invoice_id}`,
      `ORD${invoice.order_id}`,
      invoice.customer_name,
      invoice.total_amount,
      invoice.status,
      invoice.due_date,
      new Date(invoice.created_at).toLocaleDateString()
    ]);
    
    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `invoices_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadExcel = () => {
    const headers = ['Invoice ID', 'Order ID', 'Customer Name', 'Amount', 'Status', 'Due Date', 'Created Date'];
    const data = filteredInvoices.map(invoice => [
      `INV${invoice.invoice_id}`,
      `ORD${invoice.order_id}`,
      invoice.customer_name,
      invoice.total_amount,
      invoice.status,
      invoice.due_date,
      new Date(invoice.created_at).toLocaleDateString()
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `invoices_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Invoices Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 25);
    
    const headers = [['Invoice ID', 'Order ID', 'Customer Name', 'Amount', 'Status', 'Due Date', 'Created Date']];
    const data = filteredInvoices.map(invoice => [
      `INV${invoice.invoice_id}`,
      `ORD${invoice.order_id}`,
      invoice.customer_name,
      formatCurrency(invoice.total_amount),
      invoice.status,
      invoice.due_date,
      new Date(invoice.created_at).toLocaleDateString()
    ]);
    
    autoTable(doc, {
      head: headers,
      body: data,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    doc.save(`invoices_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterStatus === 'all' || invoice.status === filterStatus)
  );

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Invoice Management</h1>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading invoices...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-light-pink dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Invoice Management</h1>

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
        <input
          type="text"
          placeholder="Search by customer name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-1/3 p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full sm:w-1/4 p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {userRole === 'admin' && (
        <div className="mb-6">
          <FileUpload onFileUpload={handleFileUpload} />
          
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">CSV Upload Format:</h3>
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">Your CSV file should include these columns:</p>
            <div className="text-xs font-mono bg-white dark:bg-gray-800 p-2 rounded border overflow-x-auto">
              <div className="text-gray-600 dark:text-gray-400">order_id, due_date, status</div>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              <strong>Example:</strong> 1, 2024-02-15, pending
            </p>
          </div>
          
          <div className="mt-4 space-y-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors w-full"
            >
              Create Invoice Manually
            </button>
            
            <DownloadDropdown
              onDownloadCSV={handleDownloadCSV}
              onDownloadExcel={handleDownloadExcel}
              onDownloadPDF={handleDownloadPDF}
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto bg-light-pink-100 dark:bg-gray-800 rounded-lg shadow mb-6">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Invoice ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Order ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Due Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody className="bg-light-pink-100 dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  {loading ? 'Loading invoices...' : 'No invoices found. Create invoices from orders or upload CSV data.'}
                </td>
              </tr>
            ) : (
              filteredInvoices.map((invoice) => (
                <tr key={invoice.invoice_id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">INV{invoice.invoice_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">ORD{invoice.order_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{invoice.customer_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{formatCurrency(invoice.total_amount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                      invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{invoice.due_date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{new Date(invoice.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Invoice Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Create New Invoice</h3>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Order ID"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newInvoice.orderId}
                onChange={(e) => setNewInvoice({...newInvoice, orderId: e.target.value})}
              />
              <input
                type="date"
                placeholder="Due Date"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newInvoice.dueDate}
                onChange={(e) => setNewInvoice({...newInvoice, dueDate: e.target.value})}
              />
              <select
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={newInvoice.status}
                onChange={(e) => setNewInvoice({...newInvoice, status: e.target.value})}
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAddInvoice}
                disabled={!newInvoice.orderId || !newInvoice.dueDate}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}