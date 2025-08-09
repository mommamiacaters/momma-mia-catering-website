import React, { useState, useEffect } from "react";
import MealCard from "../../components/MealCard/MealCard";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry"; // Import these
import { service1, service2, service3, service4, service5 } from "../../images";

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
      image: service3,
      size: "small" as const,
    },
    {
      id: 2,
      title: "🍗 Party Trays",
      slug: "party-trays",
      description:
        "Generous portions, easy hosting. Delicious, ready-to-serve trays for 8–10 people. Perfect for family get-togethers, potlucks, or surprise celebrations.",
      image: service1,
      size: "large" as const,
    },
    {
      id: 3,
      title: "🎁 Fun Boxes",
      slug: "fun-boxes",
      description:
        "Pasta? Sandwich? Dessert? but make it fun. Curated lunch boxes you can mix and match—ideal for events, client gifts, team perks, and anything worth celebrating.",
      image: service2,
      size: "small" as const,
    },
    {
      id: 4,
      title: "🍽️ Catering",
      slug: "catering",
      description:
        "Full-service catering for any occasion. From small gatherings to big events, we bring the food, setup, and service so you can focus on hosting.",
      image: service5,
      size: "small" as const,
    },
    {
      id: 5,
      title: "🛠️ Equipment Rental",
      slug: "equipment-rental",
      description:
        "Need chafing dishes, buffet tables, or utensils? Rent what you need—no frills, no fuss, no overcharging.",
      image: service4,
      size: "large" as const,
    },
  ];

  return (
    <div
      className={`bg-[#EEEDEB] min-h-screen transition-opacity duration-700 ease-in ${
        isPageLoaded ? "opacity-100" : "opacity-5"
      }`}
    >
      <div className="px-24 py-24">
        <ResponsiveMasonry
          columnsCountBreakPoints={{ 350: 1, 750: 2, 1200: 3 }} // Example breakpoints
        >
          <Masonry gutter="40px">
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
