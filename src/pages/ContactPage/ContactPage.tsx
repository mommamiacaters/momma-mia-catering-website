import React, { useState } from "react";
import { Facebook, Instagram } from "lucide-react";

const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    message: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    // Handle form submission here
  };

  return (
    <div className="max-w-7xl mx-auto px-16 py-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Contact Information */}
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl lg:text-5xl font-bold text-stone-900 leading-tight mb-6">
              We'd love to hear from you.
            </h1>
            <p className="text-stone-600 leading-relaxed">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <a
                href="mailto:email@example.com"
                className="text-lg font-semibold text-stone-900 hover:text-stone-700 transition-colors"
              >
                email@example.com
              </a>
            </div>
            <div>
              <a
                href="tel:555-555-5555"
                className="text-lg font-semibold text-stone-900 hover:text-stone-700 transition-colors"
              >
                (555) 555-5555
              </a>
            </div>
          </div>

          <div className="flex space-x-4 pt-8">
            <a
              href="https://www.facebook.com/profile.php?id=61559809667297"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-400 hover:text-white transition-colors"
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

        {/* Contact Form */}
        <div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-stone-700 mb-2"
              >
                Name <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <input
                    type="text"
                    name="firstName"
                    placeholder="First Name"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-stone-300 focus:border-stone-500 focus:outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <input
                    type="text"
                    name="lastName"
                    placeholder="Last Name"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-stone-300 focus:border-stone-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-stone-700 mb-2"
              >
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-stone-300 focus:border-stone-500 focus:outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium text-stone-700 mb-2"
              >
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                name="message"
                rows={6}
                value={formData.message}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-stone-300 focus:border-stone-500 focus:outline-none transition-colors resize-none"
                required
              />
            </div>

            <button
              type="submit"
              className="px-8 py-3 bg-stone-900 text-white font-medium hover:bg-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
