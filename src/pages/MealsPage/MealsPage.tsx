import React from "react";
import MealCard from "../../components/MealCard/MealCard";
import img1 from "../../images/IMG_1.jpg";
import img2 from "../../images/IMG_2.jpg";
import img3 from "../../images/IMG_3.jpg";
import img4 from "../../images/IMG_4.jpg";
import img5 from "../../images/IMG_5.jpg";

const MealsPage: React.FC = () => {
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
      size: "large" as const,
    },
    {
      id: 5,
      title: "🛠️ Equipment Rental",
      description:
        "Need chafing dishes, buffet tables, or utensils? Rent what you need—no frills, no fuss, no overcharging.",
      image: img5,
      size: "small" as const,
    },
    // {
    //   id: 6,
    //   title: "Blog Post Six",
    //   description:
    //     "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    //   image:
    //     "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=600",
    //   size: "large" as const,
    // },
    // {
    //   id: 7,
    //   title: "Blog Post Seven",
    //   description:
    //     "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    //   image:
    //     "https://images.pexels.com/photos/1099680/pexels-photo-1099680.jpeg?auto=compress&cs=tinysrgb&w=600",
    //   size: "small" as const,
    // },
    // {
    //   id: 8,
    //   title: "Blog Post Eight",
    //   description:
    //     "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    //   image:
    //     "https://images.pexels.com/photos/1410235/pexels-photo-1410235.jpeg?auto=compress&cs=tinysrgb&w=600",
    //   size: "small" as const,
    // },
    // {
    //   id: 9,
    //   title: "Blog Post Nine",
    //   description:
    //     "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    //   image:
    //     "https://images.pexels.com/photos/1633578/pexels-photo-1633578.jpeg?auto=compress&cs=tinysrgb&w=600",
    //   size: "large" as const,
    // },
    // {
    //   id: 10,
    //   title: "Blog Post Ten",
    //   description:
    //     "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    //   image:
    //     "https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg?auto=compress&cs=tinysrgb&w=600",
    //   size: "small" as const,
    // },
    // {
    //   id: 11,
    //   title: "Blog Post Eleven",
    //   description:
    //     "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    //   image:
    //     "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=600",
    //   size: "small" as const,
    // },
    // {
    //   id: 12,
    //   title: "Blog Post Twelve",
    //   description:
    //     "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    //   image:
    //     "https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=600",
    //   size: "large" as const,
    // },
    // {
    //   id: 13,
    //   title: "Blog Post Thirteen",
    //   description:
    //     "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    //   image:
    //     "https://images.pexels.com/photos/1438672/pexels-photo-1438672.jpeg?auto=compress&cs=tinysrgb&w=600",
    //   size: "small" as const,
    // },
    // {
    //   id: 14,
    //   title: "Blog Post Fourteen",
    //   description:
    //     "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    //   image:
    //     "https://images.pexels.com/photos/1109197/pexels-photo-1109197.jpeg?auto=compress&cs=tinysrgb&w=600",
    //   size: "small" as const,
    // },
    // {
    //   id: 15,
    //   title: "Blog Post Fifteen",
    //   description:
    //     "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    //   image:
    //     "https://images.pexels.com/photos/1211887/pexels-photo-1211887.jpeg?auto=compress&cs=tinysrgb&w=600",
    //   size: "large" as const,
    // },
  ];

  return (
    <div className="bg-[#EEEDEB] min-h-screen">
      <div className="px-24 py-24">
        <div className="grid grid-cols-3 gap-8 auto-rows-max">
          {/* Column 1 */}
          <div className="space-y-8">
            <MealCard post={mealPosts[0]} />
            <MealCard post={mealPosts[3]} />
          </div>

          {/* Column 2 - Center with mixed sizes */}
          <div className="space-y-8">
            <MealCard post={mealPosts[1]} />
          </div>

          {/* Column 3 */}
          <div className="space-y-8">
            <MealCard post={mealPosts[2]} />
          </div>
          {/* Column 1 */}
          {/* <div className="space-y-8">
            <MealCard post={mealPosts[0]} />
            <MealCard post={mealPosts[4]} />
            <MealCard post={mealPosts[7]} />
            <MealCard post={mealPosts[10]} />
            <MealCard post={mealPosts[13]} />
          </div> */}

          {/* Column 2 - Center with mixed sizes */}
          {/* <div className="space-y-8">
            <MealCard post={mealPosts[1]} />
            <MealCard post={mealPosts[5]} />
            <MealCard post={mealPosts[8]} />
            <MealCard post={mealPosts[11]} />
            <MealCard post={mealPosts[14]} />
          </div> */}

          {/* Column 3 */}
          {/* <div className="space-y-8">
            <MealCard post={mealPosts[2]} />
            <MealCard post={mealPosts[3]} />
            <MealCard post={mealPosts[6]} />
            <MealCard post={mealPosts[9]} />
            <MealCard post={mealPosts[12]} />
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default MealsPage;
