import React from "react";
import { useLocation } from "react-router-dom";

const Footer: React.FC = () => {
  const { pathname } = useLocation();
  const isServicePage = pathname.startsWith("/service");
  return (
    <footer className="bg-brand-primary text-white transition-transform duration-300">
      {/* Newsletter Section */}
      {!isServicePage && (
        <div className="max-w-7xl mx-auto px-6 sm:px-10 md:px-16 py-16 md:py-20">
          <div className="text-center">
            <h3 className="text-2xl font-arvo-bold mb-4">
              Psst… Momma's Got Secrets
            </h3>
            <div className="mb-8 max-w-md mx-auto">
              <ul className="inline-block text-brand-secondary text-left space-y-2 font-poppins text-sm">
                <li className="grid grid-cols-[1.25rem,1fr] items-start gap-2">
                  <i className="pi pi-check mt-0.5"></i>
                  <span>Sneak peek menus</span>
                </li>
                <li className="grid grid-cols-[1.25rem,1fr] items-start gap-2">
                  <i className="pi pi-check mt-0.5"></i>
                  <span>First dibs on promos</span>
                </li>
                <li className="grid grid-cols-[1.25rem,1fr] items-start gap-2">
                  <i className="pi pi-check mt-0.5"></i>
                  <span>Tips to make your parties pop</span>
                </li>
                <li className="grid grid-cols-[1.25rem,1fr] items-start gap-2">
                  <i className="pi pi-check mt-0.5"></i>
                  <span>Random acts of deliciousness</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-3 mb-6">
              <input
                type="email"
                placeholder="Your Email Address"
                className="px-4 py-3 w-full sm:w-80 text-brand-text rounded-lg border-none focus:outline-none focus:ring-2 focus:ring-brand-accent font-poppins text-sm"
              />
              <button className="px-8 py-3 bg-brand-accent text-brand-text font-poppins font-semibold rounded-lg hover:bg-brand-accent/90 transition-colors text-sm">
                Sign Up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Section */}
      <div className="bg-brand-secondary py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-4">
          <div className="flex items-center space-x-5">
            <a
              href="https://www.facebook.com/profile.php?id=61559809667297"
              className="text-brand-text/60 hover:text-brand-primary transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <i className="pi pi-facebook text-xl"></i>
            </a>
            <a
              href="https://www.instagram.com/momma_mia_caters/"
              className="text-brand-text/60 hover:text-brand-primary transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <i className="pi pi-instagram text-xl"></i>
            </a>
          </div>
          <p className="text-brand-text/40 font-poppins text-xs">
            &copy; {new Date().getFullYear()} Momma Mia Caters. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
