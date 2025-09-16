import { lazy, Suspense } from 'react';
import { Route, Switch } from 'wouter';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import Sidebar from './components/Sidebar';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard'));
const EmployeeOrders = lazy(() => import('./pages/EmployeeOrders'));
const EmployeeInventory = lazy(() => import('./pages/EmployeeInventory'));
const Orders = lazy(() => import('./pages/Orders'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Reports = lazy(() => import('./pages/Reports'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Landing = lazy(() => import('./pages/Landing'));
const Signup = lazy(() => import('./pages/Signup'));

function AppContent() {
  const { user } = useAuth();

  return (
    <WebSocketProvider url="ws://localhost:8080">
      <Suspense fallback={<div>Loading...</div>}>
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <Route path="/" component={user ? (user.role === 'admin' ? Dashboard : EmployeeDashboard) : Landing} />
          
          {/* Protected routes with sidebar layout */}
          <Route>
            {user ? (
              <div className="flex">
                <Sidebar />
                <div className="flex-grow">
                  <Switch>
                    {user?.role === 'admin' ? (
                      // Admin routes
                      <>
                        <Route path="/dashboard" component={Dashboard} />
                        <Route path="/orders" component={Orders} />
                        <Route path="/inventory" component={Inventory} />
                        <Route path="/invoices" component={Invoices} />
                        <Route path="/reports" component={Reports} />
                        <Route path="/suppliers" component={Suppliers} />
                        <Route path="/settings" component={Settings} />
                        <Route component={Dashboard} />
                      </>
                    ) : (
                      // Employee routes
                      <>
                        <Route path="/employee-dashboard" component={EmployeeDashboard} />
                        <Route path="/employee-orders" component={EmployeeOrders} />
                        <Route path="/employee-inventory" component={EmployeeInventory} />
                        <Route path="/settings" component={Settings} />
                        <Route path="/dashboard" component={EmployeeDashboard} />
                        <Route component={EmployeeDashboard} />
                      </>
                    )}
                  </Switch>
                </div>
              </div>
            ) : (
              <Login />
            )}
          </Route>
        </Switch>
      </Suspense>
    </WebSocketProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;