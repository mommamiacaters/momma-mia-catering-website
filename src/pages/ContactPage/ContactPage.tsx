import React, { useState } from "react";

const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    topic: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");

    try {
      const webhookUrl = import.meta.env.VITE_N8N_BASE_URL
        ? `${import.meta.env.VITE_N8N_BASE_URL}/webhook/contact-form`
        : `${import.meta.env.VITE_N8N_LOCAL}/webhook/contact-form`;

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          topic: formData.topic,
          message: formData.message,
        }),
      });

      if (!response.ok) throw new Error("Failed to send");

      setStatus("success");
      setFormData({ firstName: "", lastName: "", email: "", topic: "", message: "" });
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="bg-brand-secondary min-h-screen flex flex-col">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 lg:px-12 pt-8 pb-12 md:pt-14 md:pb-16 lg:pt-16 lg:pb-20 flex-1 flex items-start">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 w-full">
          {/* Contact Information */}
          <div className="space-y-8 pt-4 lg:pt-8 lg:sticky lg:top-28 lg:self-start">
            <div>
              <h1 className="text-3xl lg:text-4xl font-arvo-bold text-brand-text leading-tight mb-4">
                We'd love to hear from you.
              </h1>
              <div className="w-12 h-0.5 bg-brand-primary rounded-full mb-6"></div>
              <p className="text-brand-text/70 font-poppins leading-relaxed">
                Got feedback, questions, or a craving we can help with? Momma's all ears.
                Send us a note and we'll get back to you faster than pasta disappears at a party.
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white rounded-xl shadow-sm p-6 md:p-8">
            {status === "success" ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">✉️</div>
                <h3 className="text-xl font-arvo-bold text-brand-text mb-2">Message Sent!</h3>
                <p className="text-brand-text/70 font-poppins text-sm mb-6">
                  Thanks for reaching out — we'll get back to you soon.
                </p>
                <button
                  onClick={() => setStatus("idle")}
                  className="text-brand-primary font-poppins font-medium text-sm hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-poppins font-medium text-brand-text mb-1.5"
                  >
                    Name <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      name="firstName"
                      id="firstName"
                      placeholder="First Name"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-brand-divider rounded-lg font-poppins text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary focus:outline-none transition-colors"
                      required
                      disabled={status === "sending"}
                    />
                    <input
                      type="text"
                      name="lastName"
                      placeholder="Last Name"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-brand-divider rounded-lg font-poppins text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary focus:outline-none transition-colors"
                      disabled={status === "sending"}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-poppins font-medium text-brand-text mb-1.5"
                  >
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-brand-divider rounded-lg font-poppins text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary focus:outline-none transition-colors"
                    required
                    disabled={status === "sending"}
                  />
                </div>

                <div>
                  <label
                    htmlFor="topic"
                    className="block text-sm font-poppins font-medium text-brand-text mb-1.5"
                  >
                    What's this about? <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="topic"
                    id="topic"
                    value={formData.topic}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-brand-divider rounded-lg font-poppins text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary focus:outline-none transition-colors bg-white"
                    disabled={status === "sending"}
                  >
                    <option value="" disabled>
                      Select a topic
                    </option>
                    <option value="Catering & Events">Catering & Events</option>
                    <option value="Comments, Suggestions, or Concerns">Comments, Suggestions, or Concerns</option>
                    <option value="Wholesale Inquiry">Wholesale Inquiry</option>
                    <option value="Partnerships & Collaborations">Partnerships & Collaborations</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-poppins font-medium text-brand-text mb-1.5"
                  >
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="message"
                    id="message"
                    rows={5}
                    value={formData.message}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-brand-divider rounded-lg font-poppins text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary focus:outline-none transition-colors resize-none"
                    required
                    disabled={status === "sending"}
                  />
                </div>

                {status === "error" && (
                  <p className="text-red-500 font-poppins text-sm">
                    Something went wrong. Please try again.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full sm:w-auto px-8 py-2.5 bg-brand-primary text-white font-poppins font-semibold rounded-lg hover:bg-brand-primary/90 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {status === "sending" ? (
                    <>
                      <i className="pi pi-spin pi-spinner text-sm"></i>
                      Sending...
                    </>
                  ) : (
                    "Send Message"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
