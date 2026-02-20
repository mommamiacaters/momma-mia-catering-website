import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { logo } from "../../images";

interface NavigationProps {
  isVisible: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ isVisible }) => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/meals") {
      return location.pathname === path || location.pathname === "/";
    }
    return location.pathname === path;
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  React.useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 bg-brand-primary shadow-lg transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/meals" className="flex-shrink-0 flex items-center">
            <img
              src={logo}
              alt="Momma Mia Caters Logo"
              className="h-14 md:h-20 w-auto object-contain"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-6">
            {[
              { to: "/meals", label: "Your Meals & More" },
              { to: "/about", label: "About" },
              { to: "/contact", label: "Contact" },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-3 py-2 text-base lg:text-lg xl:text-xl font-arvo-bold text-white whitespace-nowrap transition-all duration-200 hover:text-brand-secondary ${
                  isActive(link.to) ? "text-brand-secondary" : ""
                }`}
              >
                {link.label}
                <span
                  className={`absolute bottom-0 left-3 right-3 h-0.5 bg-brand-secondary transition-transform duration-200 origin-left ${
                    isActive(link.to) ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </Link>
            ))}
          </div>

          {/* Social Icons - Desktop */}
          <div className="hidden md:flex items-center space-x-3">
            <a
              href="https://www.facebook.com/profile.php?id=61559809667297"
              className="text-white/80 hover:text-white transition-colors p-1"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <i className="pi pi-facebook text-lg"></i>
            </a>
            <a
              href="https://www.instagram.com/momma_mia_caters/"
              className="text-white/80 hover:text-white transition-colors p-1"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <i className="pi pi-instagram text-lg"></i>
            </a>
          </div>

          {/* Mobile: Social + Hamburger */}
          <div className="md:hidden flex items-center space-x-3">
            <a
              href="https://www.facebook.com/profile.php?id=61559809667297"
              className="text-white/80 hover:text-white transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <i className="pi pi-facebook text-lg"></i>
            </a>
            <a
              href="https://www.instagram.com/momma_mia_caters/"
              className="text-white/80 hover:text-white transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <i className="pi pi-instagram text-lg"></i>
            </a>
            <button
              onClick={toggleMenu}
              className="text-white p-1 focus:outline-none focus:ring-2 focus:ring-white/30 rounded"
              aria-label="Toggle navigation menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? (
                <i className="pi pi-times text-xl"></i>
              ) : (
                <i className="pi pi-bars text-xl"></i>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          isMenuOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 pb-6 pt-2 space-y-1 border-t border-white/20">
          {[
            { to: "/meals", label: "Your Meals & More" },
            { to: "/about", label: "About" },
            { to: "/contact", label: "Contact" },
          ].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`block px-3 py-3 text-base font-arvo-bold rounded transition-colors ${
                isActive(link.to)
                  ? "text-brand-secondary bg-white/10"
                  : "text-white hover:bg-white/5"
              }`}
              onClick={toggleMenu}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
