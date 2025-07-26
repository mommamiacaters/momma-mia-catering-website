import React, { useState, useEffect } from "react";
import MealCard from "../../components/MealCard/MealCard";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry"; // Import these
import img1 from "../../images/IMG_1.jpg";
import img2 from "../../images/IMG_2.jpg";
import img3 from "../../images/IMG_3.jpg";
import img4 from "../../images/IMG_4.jpg";
import img5 from "../../images/IMG_5.jpg";

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
      description:
        "Packed meals with heart. Choose your meals for the week or day. Freshly prepared, delivered daily. No subscriptions—just food that works around your schedule.",
      image: img3,
      size: "small" as const,
    },
    {
      id: 2,
      title: "🍗 Party Trays",
      description:
        "Generous portions, easy hosting. Delicious, ready-to-serve trays for 8–10 people. Perfect for family get-togethers, potlucks, or surprise celebrations.",
      image: img1,
      size: "large" as const,
    },
    {
      id: 3,
      title: "🎁 Fun Boxes",
      description:
        "Pasta? Sandwich? Dessert? but make it fun. Curated lunch boxes you can mix and match—ideal for events, client gifts, team perks, and anything worth celebrating.",
      image: img2,
      size: "small" as const,
    },
    {
      id: 4,
      title: "🍽️ Catering",
      description:
        "Full-service catering for any occasion. From small gatherings to big events, we bring the food, setup, and service so you can focus on hosting.",
      image: img4,
      size: "small" as const,
    },
    {
      id: 5,
      title: "🛠️ Equipment Rental",
      description:
        "Need chafing dishes, buffet tables, or utensils? Rent what you need—no frills, no fuss, no overcharging.",
      image: img5,
      size: "large" as const,
    },
    // Add more items here, especially with different `size` values
    // to see the masonry effect!
    // For example:
    // { id: 6, title: "Dessert Platter", description: "Sweet treats for any occasion.", image: img1, size: "small" as const },
    // { id: 7, title: "Breakfast Bundles", description: "Start your day right.", image: img2, size: "large" as const },
    // { id: 8, title: "Drinks & Refreshments", description: "Quench your thirst.", image: img3, size: "small" as const },
  ];


  return (
    <div
      className={`bg-[#EEEDEB] min-h-screen transition-opacity duration-700 ease-in ${
        isPageLoaded ? "opacity-100" : "opacity-5"
      }`}
    >
      <div className="px-24 py-24">
        {/* Replace your current grid layout with ResponsiveMasonry */}
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