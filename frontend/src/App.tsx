import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './components/theme-provider';
import { DashboardLayout } from './components/layout/dashboard-layout';
import ServicesPage from './features/catalog/pages/services-page';
import AdminPage from './features/admin/pages/admin-page';
import ShoppingListPage from './features/shopping/pages/shopping-list-page';
import RecommendationsPage from './features/builder/pages/recommendations-page';
import ChecklistPage from './features/setup-guide/pages/checklist-page';
import HomePage from './features/landing/pages/home-page';
import ServiceDetailPage from './features/catalog/pages/service-detail-page';
import HardwareCatalogPage from './features/catalog/pages/hardware-catalog-page';
import ConfigGeneratorPage from './features/builder/pages/config-generator-page';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
        retry: 1,
        refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <Router>
          <DashboardLayout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/services/:id" element={<ServiceDetailPage />} />
              <Route path="/builder" element={<RecommendationsPage />} />
              <Route path="/shopping-list" element={<ShoppingListPage />} />
              <Route path="/checklist" element={<ChecklistPage />} />
              <Route path="/hardware" element={<HardwareCatalogPage />} />
              <Route path="/generate" element={<ConfigGeneratorPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </DashboardLayout>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
