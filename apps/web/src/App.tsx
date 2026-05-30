import { useState, useEffect, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import Navigation from "./components/Navigation/Navigation";
import Footer from "./components/Footer/Footer";
import Chatbot from "./components/Chatbot/Chatbot";
import MealsPage from "./pages/MealsPage/MealsPage";
import AboutPage from "./pages/AboutPage/AboutPage";
import ContactPage from "./pages/ContactPage/ContactPage";
import ServicePage from "./pages/ServicePage/ServicePage";
import CheckoutPage from "./pages/CheckoutPage/CheckoutPage";
import LoginPage from "./pages/LoginPage/LoginPage";
import RegisterPage from "./pages/RegisterPage/RegisterPage";
import AccountPage from "./pages/AccountPage/AccountPage";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminCompanyProfile from "./pages/admin/AdminCompanyProfile";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

function AppContent() {
  const location = useLocation();
  const [showNavbar, setShowNavbar] = useState(true);
  const lastScrollY = useRef(0); // Use useRef to persist scroll position across renders

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Determine scroll direction
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        // Scrolling down and not near the very top
        setShowNavbar(false);
      } else if (
        currentScrollY < lastScrollY.current ||
        currentScrollY <= 100
      ) {
        // Scrolling up or near the very top
        setShowNavbar(true);
      }
      lastScrollY.current = currentScrollY; // Update last scroll position
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // Initial check (useful for cases where page loads with a scroll position)
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []); 

  // Reset navbar visibility to true when route changes
  useEffect(() => {
    setShowNavbar(true);
    lastScrollY.current = 0; // Reset scroll position when route changes
    window.scrollTo(0, 0); // Scroll to top on route change for consistent behavior
  }, [location.pathname]);

  const path = location.pathname;
  // Hide marketing navigation on service pages and checkout
  const isServicePage = path.startsWith('/services/') || path === '/checkout';
  // "Bare" pages render their own full-screen chrome (no marketing nav/footer/chatbot)
  const isBarePage = path === '/login' || path === '/register' || path.startsWith('/admin');

  return (
    <div className="min-h-screen bg-brand-secondary">
      {!isServicePage && !isBarePage && <Navigation isVisible={showNavbar} />}
      <main className={!isServicePage && !isBarePage ? 'pt-16 md:pt-20' : ''}>
        <Routes>
          <Route path="/" element={<MealsPage />} />
          <Route path="/meals" element={<MealsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/services/:slug" element={<ServicePage />} />
          <Route path="/checkout" element={<CheckoutPage />} />

          {/* auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />

          {/* admin (role-gated) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="company" element={<AdminCompanyProfile />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </main>
      {!isBarePage && <Footer />}
      {!isBarePage && <Chatbot />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
