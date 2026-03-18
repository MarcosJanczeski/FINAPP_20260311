import { createBrowserRouter } from 'react-router-dom';
import { ROUTES } from '../shared/constants/routes';
import { RequireAuth } from '../presentation/components/RequireAuth';
import { RequireGuest } from '../presentation/components/RequireGuest';
import { DashboardPage } from '../presentation/pages/DashboardPage';
import { ChartOfAccountsPage } from '../presentation/pages/ChartOfAccountsPage';
import { AccountsPage } from '../presentation/pages/AccountsPage';
import { CreditCardsPage } from '../presentation/pages/CreditCardsPage';
import { LedgerPage } from '../presentation/pages/LedgerPage';
import { HomePage } from '../presentation/pages/HomePage';
import { LoginPage } from '../presentation/pages/LoginPage';
import { PlanningPage } from '../presentation/pages/PlanningPage';
import { ProjectionPage } from '../presentation/pages/ProjectionPage';
import { RecurrencesPage } from '../presentation/pages/RecurrencesPage';
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
  {
    path: ROUTES.chartOfAccounts,
    element: (
      <RequireAuth>
        <ChartOfAccountsPage />
      </RequireAuth>
    ),
  },
  {
    path: ROUTES.accounts,
    element: (
      <RequireAuth>
        <AccountsPage />
      </RequireAuth>
    ),
  },
  {
    path: ROUTES.ledger,
    element: (
      <RequireAuth>
        <LedgerPage />
      </RequireAuth>
    ),
  },
  {
    path: ROUTES.creditCards,
    element: (
      <RequireAuth>
        <CreditCardsPage />
      </RequireAuth>
    ),
  },
  {
    path: ROUTES.recurrences,
    element: (
      <RequireAuth>
        <RecurrencesPage />
      </RequireAuth>
    ),
  },
  {
    path: ROUTES.projection,
    element: (
      <RequireAuth>
        <ProjectionPage />
      </RequireAuth>
    ),
  },
  {
    path: ROUTES.planning,
    element: (
      <RequireAuth>
        <PlanningPage />
      </RequireAuth>
    ),
  },
]);
