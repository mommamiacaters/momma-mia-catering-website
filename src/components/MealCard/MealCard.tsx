import React from "react";
import { useNavigate } from "react-router-dom";
import Image from "../../components/Image/Image";

interface MealPost {
  id: number;
  title: string;
  slug: string;
  description: string;
  image: string;
  size: "small" | "medium" | "large";
}

interface MealCardProps {
  post: MealPost;
  visible?: boolean;
}

const MealCard: React.FC<MealCardProps> = ({ post, visible = true }) => {
  const navigate = useNavigate();

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
    <article
      className="bg-[#EEEDEB] cursor-pointer group"
      onClick={() => navigate(`/services/${post.slug}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/services/${post.slug}`);
        }
      }}
      aria-label={`View details for ${post.title}`}
    >
      <div className={`relative overflow-hidden ${getImageHeight()}`}>
        <Image src={post.image} alt={post.title} visible={visible} />
      </div>
      <div className="p-6 text-center">
        <h1 className="font-medium text-2xl text-black mt-2 mb-4 group-hover:text-gray-700 transition-colors">
          {post.title}
        </h1>
        <p className="text-gray-700 leading-relaxed mb-6 text-sm">
          {post.description}
        </p>
        <button
          type="button"
          className="text-black font-normal border-b border-black hover:border-gray-600 hover:text-gray-600 transition-colors text-sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/services/${post.slug}`);
          }}
        >
          Read More
        </button>
      </div>
    </article>
  );
};

export default MealCard;
