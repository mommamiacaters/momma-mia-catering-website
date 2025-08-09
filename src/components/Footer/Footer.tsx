import React from "react";
import { useLocation } from "react-router-dom";
import { FaFacebookF, FaCheck } from "react-icons/fa6";
import { AiFillInstagram } from "react-icons/ai";

const Footer: React.FC = () => {
  const { pathname } = useLocation();
  const isServicePage = pathname.startsWith("/service");
  return (
    // The main footer container to hold the two sections
    <footer className="bg-brand-primary text-white transition-transform duration-300">
      {/* Top Section: Newsletter (existing content) */}
      {!isServicePage && (
        <div className="max-w-7xl mx-auto px-16 py-24">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">
              Psst… Momma’s Got Secrets
            </h3>
            <div className="mb-8 max-w-md mx-auto">
              {/* <p className="text-brand-secondary mb-3">Only for the chosen few:</p> */}
              <ul className="inline-block text-brand-secondary text-left space-y-2">
                <li className="grid grid-cols-[1.25rem,1fr] items-start gap-2">
                  <FaCheck className="mt-0.5" />
                  <span>Sneak peek menus</span>
                </li>
                <li className="grid grid-cols-[1.25rem,1fr] items-start gap-2">
                  <FaCheck className="mt-0.5" />
                  <span>First dibs on promos</span>
                </li>
                <li className="grid grid-cols-[1.25rem,1fr] items-start gap-2">
                  <FaCheck className="mt-0.5" />
                  <span>Tips to make your parties pop</span>
                </li>
                <li className="grid grid-cols-[1.25rem,1fr] items-start gap-2">
                  <FaCheck className="mt-0.5" />
                  <span>Random acts of deliciousness</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-12">
              <input
                type="email"
                placeholder="Your Email Address"
                className="px-4 py-3 w-full sm:w-80 text-brand-text rounded-none border-none focus:outline-none focus:ring-2 focus:ring-stone-500"
              />
              <button className="px-8 py-3 bg-brand-primary border-2 border-brand-secondary hover:bg-brand-secondary hover:text-brand-text text-brand-cream font-medium transition-colors">
                Sign Up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Section: Social Icons */}
      {/* This new div will separate the social icons as requested */}
      {/* It currently inherits background and text color from the parent footer. */}
      {/* If you add a specific background color later, place it here. */}
      <div className="bg-brand-secondary py-32">
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
