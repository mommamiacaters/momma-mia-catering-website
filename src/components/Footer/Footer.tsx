import React from "react";
import { FaFacebookF } from "react-icons/fa6";
import { AiFillInstagram } from "react-icons/ai";

const Footer: React.FC = () => {
  return (
    // The main footer container to hold the two sections
    <footer className="bg-stone-800 text-white transition-transform duration-300">
      {/* Top Section: Newsletter (existing content) */}
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
        </div>
      </div>

      {/* Bottom Section: Social Icons */}
      {/* This new div will separate the social icons as requested */}
      {/* It currently inherits background and text color from the parent footer. */}
      {/* If you add a specific background color later, place it here. */}
      <div className="bg-[#EEEDEB] py-32">
        {/* Added padding for separation */}
        <div className="max-w-7xl mx-auto flex justify-center space-x-6">
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
      </div>
    </footer>
  );
};

export default Footer;
