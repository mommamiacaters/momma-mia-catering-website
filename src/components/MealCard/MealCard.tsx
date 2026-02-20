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
        return "md:h-[32rem]";
      case "small":
        return "md:h-[24rem]";
      default:
        return "md:h-[28rem]";
    }
  };

  return (
    <article
      className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl cursor-pointer group transition-all duration-300 hover:-translate-y-1"
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
      <div className={`relative overflow-hidden h-auto aspect-[4/3] md:aspect-auto ${getImageHeight()}`}>
        <Image
          src={post.image}
          alt={post.title}
          visible={visible}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-6 text-center">
        <h2 className="font-arvo-bold text-xl text-brand-text mt-1 mb-3 group-hover:text-brand-primary transition-colors duration-200">
          {post.title}
        </h2>
        <p className="text-brand-text/70 font-poppins leading-relaxed mb-5 text-sm">
          {post.description}
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-brand-primary font-poppins font-medium text-sm hover:gap-2.5 transition-all duration-200"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/services/${post.slug}`);
          }}
        >
          Read More
          <span className="text-xs">&rarr;</span>
        </button>
      </div>
    </article>
  );
};

export default MealCard;
