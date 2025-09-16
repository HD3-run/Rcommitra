import { ReactNode } from 'react';
import { Route, Redirect } from 'wouter';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  path: string;
  children: ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute = ({ path, children, allowedRoles }: ProtectedRouteProps) => {
  const { user } = useAuth();

  if (!user) {
    // If not logged in, redirect to login page
    return <Redirect to="/login" />;
  }

  if (!allowedRoles.includes(user.role)) {
    // If logged in but not authorized, redirect to dashboard or an unauthorized page
    return <Redirect to="/dashboard" />;
  }

  return <Route path={path}>{children}</Route>;
};

export default ProtectedRoute;