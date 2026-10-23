import { lazy, Suspense, useState, useEffect, useRef } from "react";
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
import MealsPage from "./pages/MealsPage/MealsPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

// Only the homepage ships in the first bundle; every other page is its own
// chunk. The service page is the road to an order, so it's fetched as soon as
// the browser is idle rather than on the click.
const loadServicePage = () => import("./pages/ServicePage/ServicePage");
const ServicePage = lazy(loadServicePage);
const OtherServicesPage = lazy(() => import("./pages/OtherServicesPage/OtherServicesPage"));
const AboutPage = lazy(() => import("./pages/AboutPage/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage/ContactPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage/CheckoutPage"));
const LoginPage = lazy(() => import("./pages/LoginPage/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage/RegisterPage"));
const AccountPage = lazy(() => import("./pages/AccountPage/AccountPage"));
const Chatbot = lazy(() => import("./components/Chatbot/Chatbot"));

// The admin console is role-gated and never part of a customer's visit, yet it
// shipped in the storefront bundle. Lazy chunks keep it off the first load;
// admins pay one short fetch on entry instead.
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCarousels = lazy(() => import("./pages/admin/AdminCarousels"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminMealPlans = lazy(() => import("./pages/admin/AdminMealPlans"));
const AdminServiceDetail = lazy(() => import("./pages/admin/AdminServiceDetail"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

/** Desktop only: on phones and tablets the chatbot isn't shown, so it isn't loaded either. */
function useIsDesktop(): boolean {
  const query = "(min-width: 1024px)";
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return desktop;
}

function AppContent() {
  const location = useLocation();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const prefetch = () => void loadServicePage();
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(prefetch, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(prefetch, 2000);
    return () => window.clearTimeout(id);
  }, []);
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
        {/* Holds the page's height while a chunk loads, so the footer doesn't jump up. */}
        <Suspense fallback={<div className="min-h-screen" />}>
        <Routes>
          <Route path="/" element={<MealsPage />} />
          <Route path="/meals" element={<MealsPage />} />
          <Route path="/other-services" element={<OtherServicesPage />} />
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
            <Route path="services/:slug" element={<AdminServiceDetail />} />
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
        </Suspense>
        </PageTransition>
      </main>
      {!isBarePage && <Footer />}
      {/* Desktop only: on phones and tablets the bottom of the screen belongs
          to the lunch-box bar and the section jumper. */}
      {!isBarePage && isDesktop && (
        <Suspense fallback={null}>
          <Chatbot />
        </Suspense>
      )}
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
