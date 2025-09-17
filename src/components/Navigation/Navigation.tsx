import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { FaFacebookF } from "react-icons/fa6";
import { AiFillInstagram } from "react-icons/ai";
import { logo } from "../../images";

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
      text-white font-normal
      pb-1
      md:border-b-[2px]
      transition-colors duration-300 ease-in-out
    `;
    const activeClasses = "md:border-white";
    const inactiveClasses = "md:border-transparent md:hover:border-white";

    // Mobile: default transparent underline, show on hover; solid when active
    const mobileSpecificClasses = isMobileMenu
      ? active
        ? "text-lg py-2 border-b-[2px] border-white font-bold"
        : "text-lg py-2 border-b-[2px] border-transparent hover:border-white"
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
            <Link to="/meals" className="block h-full absolute transform -translate-x-1/2 -translate-y-1/2">
              <img 
                src={logo} 
                alt="Momma Mia Caters Logo" 
                className="h-full object-contain"
              />
            </Link>
          </div>

          {/* Desktop Navigation Links - Center (Hidden on small screens) */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-8 text-white">
            <Link to="/meals" className={`${getLinkClasses("/meals")} whitespace-nowrap md:text-1xl lg:text-2xl xl:text-4xl font-arvo-bold flex items-center`}>
              {isActive("/meals") && <span className="text-white mr-2 md:mr-3">•</span>}
              Your Meals & More
              {isActive("/meals") && <span className="text-white ml-2 md:ml-3">•</span>}
            </Link>
            <Link to="/about" className={`${getLinkClasses("/about")} whitespace-nowrap md:text-1xl lg:text-2xl xl:text-4xl font-arvo-bold flex items-center`}>
              {isActive("/about") && <span className="text-white mr-2 md:mr-3">•</span>}
              About
              {isActive("/about") && <span className="text-white ml-2 md:ml-3">•</span>}
            </Link>
            <Link to="/contact" className={`${getLinkClasses("/contact")} whitespace-nowrap md:text-1xl lg:text-2xl xl:text-4xl font-arvo-bold flex items-center`}>
              {isActive("/contact") && <span className="text-white mr-2 md:mr-3">•</span>}
              Contact
              {isActive("/contact") && <span className="text-white ml-2 md:ml-3">•</span>}
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
              className={`${getLinkClasses("/meals", true)} flex items-center`} // Apply custom underline classes, pass true for mobile
              onClick={toggleMenu}
            >
              <span className="text-brand-secondary mr-2">•</span>
              Your Meals & More
              <span className="text-brand-secondary ml-2">•</span>
            </Link>
            <Link
              to="/about"
              className={`${getLinkClasses("/about", true)} flex items-center`} // Apply custom underline classes, pass true for mobile
              onClick={toggleMenu}
            >
              <span className="text-brand-secondary mr-2">•</span>
              About Us
              <span className="text-brand-secondary ml-2">•</span>
            </Link>
            <Link
              to="/contact"
              className={`${getLinkClasses("/contact", true)} flex items-center`} // Apply custom underline classes, pass true for mobile
              onClick={toggleMenu}
            >
              <span className="text-brand-secondary mr-2">•</span>
              Contact
              <span className="text-brand-secondary ml-2">•</span>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;