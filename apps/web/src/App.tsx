import { useState, useEffect, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { PageTransition } from "./components/ui/PageTransition";
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
import AdminCarousels from "./pages/admin/AdminCarousels";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminMealPlans from "./pages/admin/AdminMealPlans";
import AdminSettings from "./pages/admin/AdminSettings";
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

  // Transition per ROUTE GROUP, not per pathname: moving between admin sub-pages
  // must not remount AdminLayout, or the sidebar and brand bar would flash on
  // every tab click. AdminLayout runs its own PageTransition around the content
  // pane so only that region crossfades.
  const routeGroup = path.startsWith('/admin') ? '/admin' : path;

  return (
    <div className="min-h-screen bg-brand-secondary">
      {!isServicePage && !isBarePage && <Navigation isVisible={showNavbar} />}
      <main className={!isServicePage && !isBarePage ? 'pt-16 md:pt-20' : ''}>
        <PageTransition transitionKey={routeGroup}>
        <Routes>
          <Route path="/" element={<MealsPage />} />
          <Route path="/meals" element={<MealsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          {/* Fun Boxes became Merienda Meals; keep old links and bookmarks alive. */}
          <Route path="/services/fun-boxes" element={<Navigate to="/services/merienda-meals" replace />} />
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
            <Route index element={<AdminOrders />} />
            <Route path="plans" element={<AdminMealPlans />} />
            <Route path="menu" element={<AdminProducts />} />
            <Route path="carousels" element={<AdminCarousels />} />
            {/* Company Profile merged into Settings; keep old links alive. */}
            <Route path="company" element={<Navigate to="/admin/settings" replace />} />
            <Route path="settings" element={<AdminSettings />} />
            {/* Orders moved to the index; keep old links and bookmarks alive. */}
            <Route path="orders" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
        </PageTransition>
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
