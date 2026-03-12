import { createBrowserRouter } from 'react-router-dom';
import { ROUTES } from '../shared/constants/routes';
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
    element: <LoginPage />,
  },
  {
    path: ROUTES.signup,
    element: <SignupPage />,
  },
  {
    path: ROUTES.welcome,
    element: <WelcomePage />,
  },
  {
    path: ROUTES.dashboard,
    element: <DashboardPage />,
  },
]);
