import React from "react";
import { Facebook, Instagram } from "lucide-react";

const Footer: React.FC = () => {
  return (
    <footer className="bg-stone-800 text-white transition-transform duration-300">
      <div className="max-w-7xl mx-auto px-16 py-24">
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-4">
            Subscribe to our newsletter.
          </h3>
          <p className="text-stone-300 mb-8 max-w-md mx-auto">
            Sign up with your email address to receive news and updates.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-12">
            <input
              type="email"
              placeholder="Your Email Address"
              className="px-4 py-3 w-full sm:w-80 text-stone-900 rounded-none border-none focus:outline-none focus:ring-2 focus:ring-stone-500"
            />
            <button className="px-8 py-3 bg-stone-700 hover:bg-stone-600 text-white font-medium transition-colors">
              Sign Up
            </button>
          </div>

          <div className="flex justify-center space-x-6">
            <a
              href="https://www.facebook.com/profile.php?id=61559809667297"
              className="text-stone-400 hover:text-white transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Facebook size={24} />
            </a>
            <a
              href="https://www.instagram.com/momma_mia_caters/"
              className="text-stone-400 hover:text-white transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram size={24} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
