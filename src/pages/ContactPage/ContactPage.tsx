import React, { useState } from "react";

const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    topic: "",
    message: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 lg:px-12 pt-8 pb-16 md:pt-16 md:pb-20 lg:pt-20 lg:pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Contact Information */}
        <div className="space-y-8">
          <div className="mt-12">
            <h1 className="text-4xl lg:text-5xl font-bold text-brand-text leading-tight mb-6">
              We'd love to hear from you.
            </h1>
            <p className="text-brand-text leading-loose">
              Got feedback, questions, or a craving we can help with? Momma’s all ears.
              Send us a note and we’ll get back to you faster than pasta disappears at a party.
            </p>
          </div>

          {/* <div className="space-y-4">
            <div>
              <a
                href="mailto:email@example.com"
                className="text-lg font-semibold text-brand-text hover:text-brand-text transition-colors"
              >
                email@example.com
              </a>
            </div>
            <div>
              <a
                href="tel:555-555-5555"
                className="text-lg font-semibold text-brand-text hover:text-brand-text transition-colors"
              >
                (555) 555-5555
              </a>
            </div>
          </div> */}
        </div>

        {/* Contact Form */}
        <div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-brand-text mb-2"
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
                    className="w-full px-4 py-3 border border-brand-divider focus:border-brand-primary focus:outline-none transition-colors"
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
                    className="w-full px-4 py-3 border border-brand-divider focus:border-brand-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-brand-text mb-2"
              >
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-brand-divider focus:border-brand-primary focus:outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label
                htmlFor="topic"
                className="block text-sm font-medium text-brand-text mb-2"
              >
                What's this about? <span className="text-red-500">*</span>
              </label>
              <select
                name="topic"
                value={formData.topic}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-brand-divider focus:border-brand-primary focus:outline-none transition-colors bg-white"
              >
                <option value="" disabled>
                  Select a topic
                </option>
                <option value="catering">Catering & Events</option>
                <option value="feedback">Comments, Suggestions, or Concerns</option>
                <option value="wholesale">Wholesale Inquiry</option>
                <option value="partnerships">Partnerships & Collaborations</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium text-brand-text mb-2"
              >
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                name="message"
                rows={6}
                value={formData.message}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-brand-divider focus:border-brand-primary focus:outline-none transition-colors resize-none"
                required
              />
            </div>

            <button
              type="submit"
              className="px-8 py-3 bg-brand-primary text-white font-medium hover:bg-brand-primary transition-colors focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2"
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
