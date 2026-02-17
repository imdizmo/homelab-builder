import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import RecommendationsPage from './pages/RecommendationsPage';
import ShoppingListPage from './pages/ShoppingListPage';
import ChecklistPage from './pages/ChecklistPage';
import Navbar from './components/Navbar';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/recommendations" element={<RecommendationsPage />} />
            <Route path="/shopping-list" element={<ShoppingListPage />} />
            <Route path="/checklist" element={<ChecklistPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
