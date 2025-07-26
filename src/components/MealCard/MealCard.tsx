import React from "react";

interface MealPost {
  id: number;
  title: string;
  description: string;
  image: string;
  size: "small" | "medium" | "large";
}

interface MealCardProps {
  post: MealPost;
}

const MealCard: React.FC<MealCardProps> = ({ post }) => {
  const getImageHeight = () => {
    switch (post.size) {
      case "large":
        return "h-96";
      case "small":
        return "h-64";
      default:
        return "h-80";
    }
  };

  return (
    <article className="bg-[#EEEDEB] cursor-pointer group">
      <div className={`relative overflow-hidden ${getImageHeight()}`}>
        <img
          src={post.image}
          alt={post.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-6 text-center">
        <h1 className="font-medium text-2xl text-black mt-2 mb-4 group-hover:text-gray-700 transition-colors">
          {post.title}
        </h1>
        <p className="text-gray-700 leading-relaxed mb-6 text-sm">
          {post.description}
        </p>
        <button className="text-black font-normal border-b border-black hover:border-gray-600 hover:text-gray-600 transition-colors text-sm">
          Read More
        </button>
      </div>
    </article>
  );
};

export default MealCard;
