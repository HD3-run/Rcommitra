import React, { useMemo } from 'react';
import { Link } from 'wouter';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();

  const isAdmin = useMemo(() => user?.role === 'admin', [user?.role]);

  if (!user) {
    return null; // Don't render sidebar if user is not logged in
  }

  return (
    <div className="w-64 bg-gray-800 dark:bg-gray-900 text-white p-4 space-y-4 h-screen flex-shrink-0">
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
      
      {/* Dark Mode Toggle and Logout */}
      <div className="mt-auto pt-4 border-t border-gray-700 space-y-2">
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center justify-center py-2 px-4 rounded transition duration-200 hover:bg-gray-700 dark:hover:bg-gray-800"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          <span className="ml-2">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <Link href="/login" className="w-full block">
          <button className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 rounded transition duration-200">
            Logout
          </button>
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;