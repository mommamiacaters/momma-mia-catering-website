import React from "react";
import Image from "../../components/Image/Image";
import { aboutUs_1, aboutUs_2 } from "../../images";

const AboutPage: React.FC = () => {
  return (
    <div className="bg-[#EEEDEB] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 lg:px-12 pt-8 pb-16 md:pt-16 md:pb-20 lg:pt-20 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
          <div className="space-y-6">
            <h1 className="text-4xl lg:text-5xl font-bold text-stone-900 leading-tight">
              About Us
            </h1>
            <div className="space-y-4 text-stone-600 leading-loose">
              <p>
                At Momma Mia, everything begins with one simple belief: good
                food brings people together.
              </p>
              <p>
                What started as lovingly prepared packed meals for busy days has
                grown into a passion for making life’s celebrations more
                memorable—one plate at a time.
              </p>
              <p>
                From our early days of delivering bento boxes filled with
                home-cooked comfort, we’ve grown into a trusted partner for
                birthdays, weddings, corporate gatherings, and everything in
                between.
              </p>
              <p>
                Our kitchen is guided by the heart of a mom—thoughtful,
                generous, and always eager to see you well-fed and happy. Every
                dish is made with the same care we’d give our own families:
                fresh ingredients, flavors that feel like home, and portions
                that make sure no one leaves hungry.
              </p>
            </div>
          </div>

          <Image src={aboutUs_1} alt="Fresh ingredients and cooking" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Image src={aboutUs_2} alt="Gourmet food preparation" />

          <div className="order-1 lg:order-2 space-y-6">
            <div className="space-y-4 text-stone-600 leading-loose">
              <p>
                Today, whether we’re serving a hundred guests at a grand
                celebration or packing a single lunch for someone’s busy
                workday, our mission is the same: {""}
                <span className="font-semibold italic">
                  to make every meal a moment worth remembering
                </span>
                .
              </p>
              <p>
                Because at Momma Mia, we don’t just serve food—we serve {""}
                <span className="font-semibold italic">warmth</span>, {""}
                <span className="font-semibold italic">connection</span>, and{" "}
                {""}
                <span className="font-semibold italic">joy</span>.
              </p>
            </div>

            {/* <div className="flex space-x-4 pt-8">
              <a
                href="https://www.facebook.com/profile.php?id=61559809667297"
                className="text-stone-400 hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaFacebookF size={20} />
              </a>
              <a
                href="https://www.instagram.com/momma_mia_caters/"
                className="text-stone-400 hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <AiFillInstagram size={24} />
              </a>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
