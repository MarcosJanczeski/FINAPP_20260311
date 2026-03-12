import { createBrowserRouter } from 'react-router-dom';
import { ROUTES } from '../shared/constants/routes';
import { RequireAuth } from '../presentation/components/RequireAuth';
import { RequireGuest } from '../presentation/components/RequireGuest';
import { DashboardPage } from '../presentation/pages/DashboardPage';
import { HomePage } from '../presentation/pages/HomePage';
import { LoginPage } from '../presentation/pages/LoginPage';
import { SignupPage } from '../presentation/pages/SignupPage';
import { WelcomePage } from '../presentation/pages/WelcomePage';

export const appRouter = createBrowserRouter([
  {
    path: ROUTES.home,
    element: <HomePage />,
  },
  {
    path: ROUTES.login,
    element: (
      <RequireGuest>
        <LoginPage />
      </RequireGuest>
    ),
  },
  {
    path: ROUTES.signup,
    element: (
      <RequireGuest>
        <SignupPage />
      </RequireGuest>
    ),
  },
  {
    path: ROUTES.welcome,
    element: (
      <RequireAuth>
        <WelcomePage />
      </RequireAuth>
    ),
  },
  {
    path: ROUTES.dashboard,
    element: (
      <RequireAuth>
        <DashboardPage />
      </RequireAuth>
    ),
  },
]);
