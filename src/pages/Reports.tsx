import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '../utils/currency';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportData {
  date: string;
  sales: number;
  revenue: number;
}

export default function Reports() {
  const [reportType, setReportType] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real data from database
  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports?type=${reportType}&startDate=${startDate}&endDate=${endDate}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        setData(result.data || []);
      } else {
        console.error('Failed to fetch reports data');
        setData([]);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [reportType, startDate, endDate]);
  
  const handleDownloadCSV = () => {
    const csvHeaders = ['Date', 'Sales Count', 'Revenue'];
    const csvData = data.map(item => [
      item.date,
      item.sales,
      item.revenue
    ]);
    
    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadExcel = () => {
    const headers = ['Date', 'Sales Count', 'Revenue'];
    const excelData = data.map(item => [
      item.date,
      item.sales,
      item.revenue
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...excelData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
    XLSX.writeFile(wb, `sales_report_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Sales Report - ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 25);
    
    const headers = [['Date', 'Sales Count', 'Revenue']];
    const pdfData = data.map(item => [
      item.date,
      item.sales.toString(),
      formatCurrency(item.revenue)
    ]);
    
    autoTable(doc, {
      head: headers,
      body: pdfData,
      startY: 35,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 139, 202] }
    });
    
    doc.save(`sales_report_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Sales Reports</h1>

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0">
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="daily">Daily Sales</option>
            <option value="monthly">Monthly Sales</option>
            <option value="yearly">Yearly Sales</option>
          </select>
          <div className="flex space-x-2">
            <button
              onClick={handleDownloadCSV}
              className="p-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
            >
              CSV
            </button>
            <button
              onClick={handleDownloadExcel}
              className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Excel
            </button>
            <button
              onClick={handleDownloadPDF}
              className="p-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
            >
              PDF
            </button>
          </div>
        </div>

        {(reportType === 'daily' || reportType === 'monthly') && (
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full sm:w-2/3 justify-end">
            <input
              type={reportType === 'daily' ? 'date' : 'month'}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <input
              type={reportType === 'daily' ? 'date' : 'month'}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Sales and Revenue Overview</h2>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-lg">Loading reports...</div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-lg text-gray-500">No data available for the selected period</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a4a4a" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis yAxisId="left" stroke="#9ca3af" />
              <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (name === 'Revenue') {
                    return [formatCurrency(value), name];
                  }
                  return [value, name];
                }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="sales" stroke="#8884d8" name="Sales" />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#82ca9d" name="Revenue" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Total Sales</h2>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {loading ? '...' : data.reduce((sum, item) => sum + item.sales, 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Total Revenue</h2>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            {loading ? '...' : formatCurrency(data.reduce((sum, item) => sum + item.revenue, 0))}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Average Sales per Period</h2>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {loading ? '...' : data.length > 0 ? (data.reduce((sum, item) => sum + item.sales, 0) / data.length).toFixed(2) : '0'}
          </p>
        </div>
      </div>
    </div>
  );
}