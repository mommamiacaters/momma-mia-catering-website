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
      text-black font-normal
      pb-1
      border-b-[2px]
      transition-colors duration-300 ease-in-out
    `;
    const activeClasses = "border-black";
    const inactiveClasses = "border-transparent hover:border-black";

    const mobileSpecificClasses = isMobileMenu ? "text-lg py-2" : "";

    return `${baseClasses} ${
      active ? activeClasses : inactiveClasses
    } ${mobileSpecificClasses}`;
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 bg-[#EEEDEB] transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto px-4 sm:px-6 md:px-16 py-4 md:py-10">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="text-2xl font-medium text-black">
              Momma Mia Catering
            </Link>
          </div>

          {/* Desktop Navigation Links - Center (Hidden on small screens) */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/meals" className={getLinkClasses("/meals")}>
              Your Meals & More
            </Link>
            <Link to="/about" className={getLinkClasses("/about")}>
              About
            </Link>
            <Link to="/contact" className={getLinkClasses("/contact")}>
              Contact
            </Link>
          </div>

          {/* Social Icons (Visible on desktop) */}
          <div className="hidden md:flex items-center space-x-4">
            <a
              href="https://www.facebook.com/profile.php?id=61559809667297"
              className="text-black hover:text-gray-600 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaFacebookF size={20} />
            </a>
            <a
              href="https://www.instagram.com/momma_mia_caters/"
              className="text-black hover:text-gray-600 transition-colors"
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
              className="text-black hover:text-gray-600 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaFacebookF size={20} />
            </a>
            <a
              href="https://www.instagram.com/momma_mia_caters/"
              className="text-black hover:text-gray-600 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <AiFillInstagram size={24} />
            </a>
            <button
              onClick={toggleMenu}
              className="text-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? <X size={30} /> : <Menu size={30} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div
        className={`md:hidden absolute top-full left-0 right-0 bg-[#EEEDEB] shadow-lg overflow-hidden transition-all duration-300 ease-in-out ${
          isMenuOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
        }`}
      >
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
            About
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
    </nav>
  );
};

export default Navigation;
