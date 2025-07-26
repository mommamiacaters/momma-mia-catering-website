import React from "react";
import { FaFacebookF } from "react-icons/fa6";
import { AiFillInstagram } from "react-icons/ai";

const AboutPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-16 py-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
        <div className="space-y-6">
          <h1 className="text-4xl lg:text-5xl font-bold text-stone-900 leading-tight">
            A food knowledge sharing community.
          </h1>
          <div className="space-y-4 text-stone-600 leading-relaxed">
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
              reprehenderit in voluptate velit esse cillum dolore eu fugiat
              nulla pariatur. Excepteur sint occaecat cupidatat non proident,
              sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
            <p>
              Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
              reprehenderit in voluptate velit esse cillum dolore eu fugiat
              nulla pariatur. Excepteur sint occaecat cupidatat non proident,
              sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
          </div>
        </div>

        <div className="relative">
          <img
            src="https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800"
            alt="Fresh ingredients and cooking"
            className="w-full h-96 object-cover rounded-lg shadow-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="order-2 lg:order-1 relative">
          <img
            src="https://images.pexels.com/photos/566566/pexels-photo-566566.jpeg?auto=compress&cs=tinysrgb&w=800"
            alt="Gourmet food preparation"
            className="w-full h-96 object-cover rounded-lg shadow-lg"
          />
        </div>

        <div className="order-1 lg:order-2 space-y-6">
          <div className="space-y-4 text-stone-600 leading-relaxed">
            <p>
              Laoreet suspendisse interdum consectetur libero. Mattis nunc sed
              blandit libero volutpat sed cras ornare arcu. Ridiculus mus mauris
              vitae ultricies leo integer malesuada. Amet est placerat in
              egestas. Donec enim diam vulputate ut.
            </p>
            <p className="text-sm italic">
              Images shot on location at Buvette.
            </p>
          </div>

          <div className="flex space-x-4 pt-8">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
