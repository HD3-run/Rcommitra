import { useState, useEffect } from 'react';
import FileUpload from '../components/FileUpload';
import DownloadDropdown from '../components/DownloadDropdown';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/currency';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Product {
    product_id: number;
    product_name: string;
    sku: string;
    category: string;
    quantity_available: number;
    reorder_level: number;
    is_low_stock: boolean;
    unit_price?: number;
}

interface EditingPrice {
    productId: number;
    value: string;
}

const Inventory = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newProduct, setNewProduct] = useState({
        name: '',
        category: '',
        stock: 0,
        reorderLevel: 0,
        unitPrice: 0
    });
    const [editingPrice, setEditingPrice] = useState<EditingPrice | null>(null);
    
    const { user } = useAuth();
    useTheme();
    const userRole = user?.role || 'admin';

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            const response = await fetch('/api/inventory', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                setProducts(data.products || []);
            }
        } catch (error) {
            console.error('Failed to load products:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const handleFileUpload = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch('/api/inventory/upload-csv', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert(`${result.message}\n\nCreated: ${result.created} products`);
                await loadProducts();
            } else {
                alert(`Upload failed: ${result.message}`);
            }
        } catch (error) {
            alert('Upload failed: Network error');
        }
    };
    
    const handleAddProduct = async () => {
        try {
            const response = await fetch('/api/inventory/add-product', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(newProduct)
            });
            
            if (response.ok) {
                alert('Product added successfully!');
                setShowAddModal(false);
                setNewProduct({ name: '', category: '', stock: 0, reorderLevel: 0, unitPrice: 0 });
                await loadProducts();
            } else {
                alert('Failed to add product');
            }
        } catch (error) {
            alert('Failed to add product');
        }
    };
    
    const handlePriceEdit = (productId: number, currentPrice: number) => {
        setEditingPrice({ productId, value: currentPrice?.toString() || '0' });
    };
    
    const handlePriceSave = async (productId: number) => {
        if (!editingPrice) return;
        
        const newPrice = parseFloat(editingPrice.value);
        if (isNaN(newPrice) || newPrice < 0) {
            alert('Please enter a valid price');
            return;
        }
        
        try {
            const response = await fetch(`/api/inventory/${productId}/price`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ unitPrice: newPrice })
            });
            
            if (response.ok) {
                setEditingPrice(null);
                await loadProducts();
            } else {
                alert('Failed to update price');
            }
        } catch (error) {
            alert('Failed to update price');
        }
    };
    
    const handlePriceCancel = () => {
        setEditingPrice(null);
    };
    
    const handleDownloadCSV = () => {
        const csvHeaders = ['Product Name', 'SKU', 'Category', 'Unit Price', 'Stock Quantity', 'Reorder Level', 'Status'];
        const csvData = filteredProducts.map(product => [
            product.product_name,
            product.sku,
            product.category || 'Uncategorized',
            product.unit_price || 0,
            product.quantity_available || 0,
            product.reorder_level || 0,
            product.is_low_stock ? 'Low Stock' : 'In Stock'
        ]);
        
        const csvContent = [csvHeaders, ...csvData]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `inventory_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadExcel = () => {
        const headers = ['Product Name', 'SKU', 'Category', 'Unit Price', 'Stock Quantity', 'Reorder Level', 'Status'];
        const data = filteredProducts.map(product => [
            product.product_name,
            product.sku,
            product.category || 'Uncategorized',
            product.unit_price || 0,
            product.quantity_available || 0,
            product.reorder_level || 0,
            product.is_low_stock ? 'Low Stock' : 'In Stock'
        ]);
        
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
        XLSX.writeFile(wb, `inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Inventory Report', 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 25);
        
        const headers = [['Product Name', 'SKU', 'Category', 'Unit Price', 'Stock Quantity', 'Reorder Level', 'Status']];
        const data = filteredProducts.map(product => [
            product.product_name,
            product.sku,
            product.category || 'Uncategorized',
            product.unit_price ? formatCurrency(product.unit_price) : '₹0.00',
            product.quantity_available || 0,
            product.reorder_level || 0,
            product.is_low_stock ? 'Low Stock' : 'In Stock'
        ]);
        
        autoTable(doc, {
            head: headers,
            body: data,
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [66, 139, 202] }
        });
        
        doc.save(`inventory_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              product.sku.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const totalStock = products.reduce((sum, product) => sum + (product.quantity_available || 0), 0);
    const lowStockCount = products.filter(product => product.is_low_stock).length;
    const categories = [...new Set(products.map(product => product.category).filter(Boolean))];

    if (loading) {
        return (
            <div className="p-6 bg-gray-100 dark:bg-gray-900 min-h-screen">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Inventory</h1>
                <div className="flex justify-center items-center h-64">
                    <div className="text-lg text-gray-600 dark:text-gray-300">Loading inventory...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-light-pink dark:bg-gray-900 min-h-screen">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Inventory</h1>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-light-pink-100 dark:bg-gray-800 p-5 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-3">Total Products</h2>
                    <p className="text-4xl font-bold text-indigo-600">{products.length}</p>
                </div>
                <div className="bg-light-pink-100 dark:bg-gray-800 p-5 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-3">Total Stock</h2>
                    <p className="text-4xl font-bold text-green-600">{totalStock}</p>
                </div>
                <div className="bg-light-pink-100 dark:bg-gray-800 p-5 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-3">Low Stock Items</h2>
                    <p className="text-4xl font-bold text-red-600">{lowStockCount}</p>
                </div>
            </div>

            {userRole === 'admin' && (
                <div className="mb-6">
                    <FileUpload onFileUpload={handleFileUpload} />
                    
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">CSV Upload Format:</h3>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">Your CSV file should include these columns:</p>
                        <div className="text-xs font-mono bg-white dark:bg-gray-800 p-2 rounded border overflow-x-auto">
                            <div className="text-gray-600 dark:text-gray-400">product_name, category, stock_quantity, reorder_level, unit_price</div>
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                            <strong>Example:</strong> iPhone 15, Electronics, 50, 10, 25000.00
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            <strong>Note:</strong> SKU will be auto-generated for each product
                        </p>
                    </div>
                    
                    <div className="mt-4 space-y-2">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="p-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors w-full"
                        >
                            Add Product Manually
                        </button>
                        <DownloadDropdown
                            onDownloadCSV={handleDownloadCSV}
                            onDownloadExcel={handleDownloadExcel}
                            onDownloadPDF={handleDownloadPDF}
                        />
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Search products..."
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                >
                    <option value="all">All Categories</option>
                    {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                    ))}
                </select>
            </div>

            {/* Products Table */}
            <div className="bg-light-pink-100 dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Product Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">SKU</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Unit Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Stock</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Reorder Level</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-light-pink-100 dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                                        No products found. {products.length === 0 ? 'Add some products to get started.' : 'Try adjusting your search or filters.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr key={product.product_id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                            {product.product_name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                            {product.sku}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                            {product.category || 'Uncategorized'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                            {userRole === 'admin' ? (
                                                editingPrice?.productId === product.product_id ? (
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={editingPrice.value}
                                                            onChange={(e) => setEditingPrice({...editingPrice, value: e.target.value})}
                                                            className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={() => handlePriceSave(product.product_id)}
                                                            className="text-green-600 hover:text-green-800 text-xs"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            onClick={handlePriceCancel}
                                                            className="text-red-600 hover:text-red-800 text-xs"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center space-x-2">
                                                        <span>
                                                            {product.unit_price && product.unit_price > 0 ? formatCurrency(product.unit_price) : 
                                                             <span className="text-gray-400 italic">Not set</span>}
                                                        </span>
                                                        <button
                                                            onClick={() => handlePriceEdit(product.product_id, product.unit_price || 0)}
                                                            className="text-blue-600 hover:text-blue-800 text-xs ml-2"
                                                            title="Edit price"
                                                        >
                                                            ✏️
                                                        </button>
                                                    </div>
                                                )
                                            ) : (
                                                <span>
                                                    {product.unit_price && product.unit_price > 0 ? formatCurrency(product.unit_price) : 
                                                     <span className="text-gray-400 italic">Not set</span>}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                            {product.quantity_available || 0}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                            {product.reorder_level || 0}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                product.is_low_stock 
                                                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                                                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                            }`}>
                                                {product.is_low_stock ? 'Low Stock' : 'In Stock'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Add Product Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold mb-4">Add New Product</h3>
                        
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Product Name"
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                value={newProduct.name}
                                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                            />
                            <input
                                type="text"
                                placeholder="Category"
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                value={newProduct.category}
                                onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                            />
                            <input
                                type="number"
                                placeholder="Stock Quantity"
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                value={newProduct.stock}
                                onChange={(e) => setNewProduct({...newProduct, stock: parseInt(e.target.value) || 0})}
                            />
                            <input
                                type="number"
                                placeholder="Unit Price"
                                step="0.01"
                                min="0"
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                value={newProduct.unitPrice}
                                onChange={(e) => setNewProduct({...newProduct, unitPrice: parseFloat(e.target.value) || 0})}
                            />
                            <input
                                type="number"
                                placeholder="Reorder Level"
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                value={newProduct.reorderLevel}
                                onChange={(e) => setNewProduct({...newProduct, reorderLevel: parseInt(e.target.value) || 0})}
                            />
                        </div>
                        
                        <div className="flex justify-end space-x-2 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddProduct}
                                disabled={!newProduct.name}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                            >
                                Add Product
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;