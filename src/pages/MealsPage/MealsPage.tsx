import React, { useState, useEffect } from "react";
import MealCard from "../../components/MealCard/MealCard";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import { catering, checkLunch, funBoxes, partyTrays, equipmentRental } from "../../images";

interface MealsPageProps {
  currentLocation?: string;
}

const MealsPage: React.FC<MealsPageProps> = ({ currentLocation }) => {
  const [isPageLoaded, setIsPageLoaded] = useState(false);

  useEffect(() => {
    setIsPageLoaded(false);
    const timer = setTimeout(() => {
      setIsPageLoaded(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [currentLocation]);

  const mealPosts = [
    {
      id: 1,
      title: "🍱 Check-a-Lunch",
      slug: "check-a-lunch",
      description:
        "Packed meals with heart. Choose your meals for the week or day. Freshly prepared, delivered daily. No subscriptions—just food that works around your schedule.",
      image: checkLunch,
      size: "small" as const,
    },
    {
      id: 2,
      title: "🍗 Party Trays",
      slug: "party-trays",
      description:
        "Generous portions, easy hosting. Delicious, ready-to-serve trays for 8–10 people. Perfect for family get-togethers, potlucks, or surprise celebrations.",
      image: partyTrays,
      size: "large" as const,
    },
    {
      id: 3,
      title: "🎁 Fun Boxes",
      slug: "fun-boxes",
      description:
        "Pasta? Sandwich? Dessert? but make it fun. Curated lunch boxes you can mix and match—ideal for events, client gifts, team perks, and anything worth celebrating.",
      image: funBoxes,
      size: "small" as const,
    },
    {
      id: 4,
      title: "🍽️ Catering",
      slug: "catering",
      description:
        "Full-service catering for any occasion. From small gatherings to big events, we bring the food, setup, and service so you can focus on hosting.",
      image: catering,
      size: "small" as const,
    },
    {
      id: 5,
      title: "🛠️ Equipment Rental",
      slug: "equipment-rental",
      description:
        "Need chafing dishes, buffet tables, or utensils? Rent what you need—no frills, no fuss, no overcharging.",
      image: equipmentRental,
      size: "large" as const,
    },
  ];

  return (
    <div
      className={`bg-brand-secondary min-h-screen transition-opacity duration-700 ease-in ${
        isPageLoaded ? "opacity-100" : "opacity-5"
      }`}
    >
      {/* Hero tagline */}
      <div className="text-center pt-10 pb-4 md:pt-14 md:pb-6 lg:pt-16 lg:pb-8 px-4">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-arvo-bold text-brand-text mb-3">
          Good Food, Made with Love
        </h1>
        <p className="text-brand-text/60 font-poppins max-w-xl mx-auto text-sm md:text-base">
          From packed lunches to full-service catering — explore what Momma Mia has for you.
        </p>
        <div className="mt-6 flex justify-center">
          <div className="w-16 h-0.5 bg-brand-primary rounded-full"></div>
        </div>
      </div>

      {/* Masonry grid */}
      <div className="mx-auto px-4 sm:px-6 md:px-10 lg:px-16 pb-16 md:pb-20 lg:pb-24">
        <ResponsiveMasonry
          columnsCountBreakPoints={{ 350: 1, 750: 2, 1200: 3 }}
        >
          <Masonry gutter="24px">
            {mealPosts.map((post) => (
              <MealCard key={post.id} post={post} />
            ))}
          </Masonry>
        </ResponsiveMasonry>
      </div>
    </div>
  );
};

export default MealsPage;
