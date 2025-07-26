import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Facebook, Instagram } from "lucide-react";

interface NavigationProps {
  isVisible: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ isVisible }) => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 bg-[#EEEDEB] transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto px-16 py-16">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="text-2xl font-medium text-black">
              Momma Mia Catering
            </Link>
          </div>

          {/* Navigation Links - Center */}
          <div className="flex items-center space-x-8">
            <Link
              to="/meals"
              className={`text-black font-normal ${
                isActive("/meals") || isActive("/")
                  ? "underline"
                  : "hover:underline"
              }`}
            >
              Your Meals & More
            </Link>
            <Link
              to="/about"
              className={`text-black font-normal ${
                isActive("/about") ? "underline" : "hover:underline"
              }`}
            >
              About
            </Link>
            <Link
              to="/contact"
              className={`text-black font-normal ${
                isActive("/contact") ? "underline" : "hover:underline"
              }`}
            >
              Contact
            </Link>
          </div>

          {/* Social Icons */}
          <div className="flex items-center space-x-4">
            <a
              href="https://www.facebook.com/profile.php?id=61559809667297"
              className="text-black hover:text-gray-600 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Facebook size={24} />
            </a>
            <a
              href="https://www.instagram.com/momma_mia_caters/"
              className="text-black hover:text-gray-600 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram size={24} />
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
