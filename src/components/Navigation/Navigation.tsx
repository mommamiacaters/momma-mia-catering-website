import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { FaFacebookF } from "react-icons/fa6";
import { AiFillInstagram } from "react-icons/ai";

interface NavigationProps {
  isVisible: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ isVisible }) => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Close menu when navigating
  React.useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Helper function for custom underline styling
  const getLinkClasses = (path: string, isMobileMenu: boolean = false) => {
    const active = isActive(path) || (path === "/meals" && isActive("/"));
    const baseClasses = `
      inline-block
      text-brand-secondary font-normal
      pb-1
      md:border-b-[2px]
      transition-colors duration-300 ease-in-out
    `;
    const activeClasses = "md:border-brand-secondary";
    const inactiveClasses = "md:border-transparent md:hover:border-brand-secondary";

    // Mobile: default transparent underline, show on hover; solid when active
    const mobileSpecificClasses = isMobileMenu
      ? active
        ? "text-lg py-2 border-b-[2px] border-brand-secondary"
        : "text-lg py-2 border-b-[2px] border-transparent hover:border-brand-secondary"
      : "";

    return `${baseClasses} ${
      active ? activeClasses : inactiveClasses
    } ${mobileSpecificClasses}`;
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 bg-brand-primary transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto px-4 sm:px-6 md:px-10 lg:px-[68px] py-4 md:py-6 lg:py-10">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="text-lg sm:text-xl md:text-2xl font-medium text-brand-secondary">
              MOMMA MIA CATERS
            </Link>
          </div>

          {/* Desktop Navigation Links - Center (Hidden on small screens) */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
            <Link to="/meals" className={`${getLinkClasses("/meals")} whitespace-nowrap text-sm lg:text-base`}>
              Your Meals & More
            </Link>
            <Link to="/about" className={`${getLinkClasses("/about")} text-sm lg:text-base`}>
              About
            </Link>
            <Link to="/contact" className={`${getLinkClasses("/contact")} text-sm lg:text-base`}>
              Contact
            </Link>
          </div>

          {/* Social Icons (Visible on desktop) */}
          <div className="hidden md:flex items-center space-x-4">
            <a
              href="https://www.facebook.com/profile.php?id=61559809667297"
              className="text-brand-secondary hover:text-brand-text transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaFacebookF size={20} />
            </a>
            <a
              href="https://www.instagram.com/momma_mia_caters/"
              className="text-brand-secondary hover:text-brand-text transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <AiFillInstagram size={24} />
            </a>
          </div>

          {/* Mobile Hamburger/Close Icon and Social Icons (Visible on small screens) */}
          <div className="md:hidden flex items-center space-x-4">
            {/* Social icons for mobile - positioned right of hamburger */}
            <a
              href="https://www.facebook.com/profile.php?id=61559809667297"
              className="text-brand-secondary hover:text-brand-text transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaFacebookF size={20} />
            </a>
            <a
              href="https://www.instagram.com/momma_mia_caters/"
              className="text-brand-secondary hover:text-brand-text transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <AiFillInstagram size={24} />
            </a>
            <button
              onClick={toggleMenu}
              className="text-brand-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-divider"
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? <X size={30} /> : <Menu size={30} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-brand-primary shadow-lg">
          <div className="px-4 py-6 space-y-4 flex flex-col items-center">
            <Link
              to="/meals"
              className={getLinkClasses("/meals", true)} // Apply custom underline classes, pass true for mobile
              onClick={toggleMenu}
            >
              Your Meals & More
            </Link>
            <Link
              to="/about"
              className={getLinkClasses("/about", true)} // Apply custom underline classes, pass true for mobile
              onClick={toggleMenu}
            >
              About Us
            </Link>
            <Link
              to="/contact"
              className={getLinkClasses("/contact", true)} // Apply custom underline classes, pass true for mobile
              onClick={toggleMenu}
            >
              Contact
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
