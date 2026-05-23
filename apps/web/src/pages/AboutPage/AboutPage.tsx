import React from "react";
import Image from "../../components/Image/Image";
import { aboutUs_1, aboutUs_2 } from "../../images";

const AboutPage: React.FC = () => {
  return (
    <div className="bg-brand-secondary min-h-screen">
      {/* Hero heading */}
      <div className="text-center pt-10 pb-2 md:pt-14 md:pb-4 lg:pt-16 lg:pb-6 px-4">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-arvo-bold text-brand-text">
          About Us
        </h1>
        <div className="mt-4 flex justify-center">
          <div className="w-16 h-0.5 bg-brand-primary rounded-full"></div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 lg:px-12 pb-16 md:pb-20 lg:pb-24">
        {/* Section 1: Text + Image */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center mb-20">
          <div className="space-y-5">
            <p className="text-brand-text/80 font-poppins leading-relaxed text-base">
              At Momma Mia, everything begins with one simple belief: good
              food brings people together.
            </p>
            <p className="text-brand-text/80 font-poppins leading-relaxed text-base">
              What started as lovingly prepared packed meals for busy days has
              grown into a passion for making life's celebrations more
              memorable—one plate at a time.
            </p>
            <p className="text-brand-text/80 font-poppins leading-relaxed text-base">
              From our early days of delivering bento boxes filled with
              home-cooked comfort, we've grown into a trusted partner for
              birthdays, weddings, corporate gatherings, and everything in
              between.
            </p>
            <p className="text-brand-text/80 font-poppins leading-relaxed text-base">
              Our kitchen is guided by the heart of a mom—thoughtful,
              generous, and always eager to see you well-fed and happy. Every
              dish is made with the same care we'd give our own families:
              fresh ingredients, flavors that feel like home, and portions
              that make sure no one leaves hungry.
            </p>
          </div>

          <div className="rounded-2xl overflow-hidden shadow-lg">
            <Image src={aboutUs_1} alt="Fresh ingredients and cooking" className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Highlight quote */}
        <div className="my-16 text-center px-4">
          <div className="max-w-2xl mx-auto">
            <div className="w-10 h-0.5 bg-brand-accent mx-auto mb-6 rounded-full"></div>
            <blockquote className="text-xl md:text-2xl font-arvo-italic text-brand-text/90 leading-relaxed">
              "We don't just serve food—we serve warmth, connection, and joy."
            </blockquote>
            <div className="w-10 h-0.5 bg-brand-accent mx-auto mt-6 rounded-full"></div>
          </div>
        </div>

        {/* Section 2: Image + Text */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="rounded-2xl overflow-hidden shadow-lg">
            <Image src={aboutUs_2} alt="Gourmet food preparation" className="w-full h-full object-cover" />
          </div>

          <div className="space-y-5">
            <p className="text-brand-text/80 font-poppins leading-relaxed text-base">
              Today, whether we're serving a hundred guests at a grand
              celebration or packing a single lunch for someone's busy
              workday, our mission is the same:{" "}
              <span className="font-semibold italic text-brand-text">
                to make every meal a moment worth remembering
              </span>
              .
            </p>
            <p className="text-brand-text/80 font-poppins leading-relaxed text-base">
              Because at Momma Mia, we don't just serve food—we serve{" "}
              <span className="font-semibold text-brand-primary">warmth</span>,{" "}
              <span className="font-semibold text-brand-primary">connection</span>, and{" "}
              <span className="font-semibold text-brand-primary">joy</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
