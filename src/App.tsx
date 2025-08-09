import { useState, useEffect, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import Navigation from "./components/Navigation/Navigation";
import Footer from "./components/Footer/Footer";
import MealsPage from "./pages/MealsPage/MealsPage";
import AboutPage from "./pages/AboutPage/AboutPage";
import ContactPage from "./pages/ContactPage/ContactPage";
import ServicePage from "./pages/ServicePage/ServicePage";
 

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

  return (
    <div className="min-h-screen bg-[#EEEDEB]">
      <Navigation isVisible={showNavbar} />
      <main className="pt-20">
        <Routes>
          {/* Pass location.pathname as a prop */}
          <Route
            path="/"
            element={<MealsPage currentLocation={location.pathname} />}
          />
          <Route
            path="/meals"
            element={<MealsPage currentLocation={location.pathname} />}
          />
          <Route
            path="/about"
            element={<AboutPage/>}
          />
          <Route
            path="/contact"
            element={<ContactPage/>}
          />
          <Route
            path="/services/:slug"
            element={<ServicePage />}
          />
        </Routes>
      </main>
      <Footer />
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
