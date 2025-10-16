import React from 'react';

interface ContactSectionProps {
  title?: string;
  description?: string;
  messengerUrl?: string;
}

const ContactSection: React.FC<ContactSectionProps> = ({
  title = "Start Your Order",
  description = "Got a custom order or want a personalized quote? Reach out to us via Facebook Messenger or our Virtual Assistant Mia. We're here to make your event unforgettable.",
  messengerUrl = "https://m.me/61559809667297"
}) => {
  return (
    <div className="mt-20 text-center relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-brand-primary">
      <div className="max-w-7xl mx-auto px-16 py-24">
        <h2 className="text-3xl font-bold text-brand-secondary mb-4">
          {title}
        </h2>
        <p className="text-brand-secondary mb-8 max-w-2xl mx-auto">
          {description}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href={messengerUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Message us on Facebook Messenger"
            className="inline-flex items-center justify-center gap-2 w-56 px-8 py-3 border-2 border-brand-secondary text-brand-secondary font-medium text-center hover:bg-brand-secondary hover:text-brand-text transition-colors"
          >
            <i className="pi pi-comment mr-2"></i>
            Message Us
          </a>
        </div>
      </div>
    </div>
  );
};

export default ContactSection;