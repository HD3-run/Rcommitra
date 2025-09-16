import React, { useMemo } from 'react';
import { Link } from 'wouter';
import { useAuth } from '../context/AuthContext';

const Sidebar: React.FC = () => {
  const { user } = useAuth();

  const isAdmin = useMemo(() => user?.role === 'admin', [user?.role]);
  const isEmployee = useMemo(() => user?.role !== 'admin', [user?.role]);

  if (!user) {
    return null; // Don't render sidebar if user is not logged in
  }

  return (
    <div className="w-64 bg-gray-800 text-white p-4 space-y-4 min-h-screen">
      <h2 className="text-2xl font-bold mb-6">{isAdmin ? 'Merchant Portal' : 'User Portal'}</h2>
      <nav>
        <ul>
          {isAdmin ? (
            // Admin Navigation
            <>
              <li>
                <Link href="/dashboard" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/orders" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
                  Orders
                </Link>
              </li>
              <li>
                <Link href="/inventory" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
                  Inventory
                </Link>
              </li>
              <li>
                <Link href="/reports" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
                  Reports
                </Link>
              </li>
              <li>
                <Link href="/invoices" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
                  Invoices
                </Link>
              </li>
              <li>
                <Link href="/settings" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
                  Settings
                </Link>
              </li>
            </>
          ) : (
            // User Navigation (Limited Access)
            <>
              <li>
                <Link href="/employee-dashboard" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/employee-orders" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
                  Orders
                </Link>
              </li>
              <li>
                <Link href="/employee-inventory" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
                  Inventory
                </Link>
              </li>
              <li>
                <Link href="/settings" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
                  Settings
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;