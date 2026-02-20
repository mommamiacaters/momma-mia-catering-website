import {
  lunch1, lunch2, lunch3, lunch4, lunch5,
  tray1, tray2, tray3, tray4, tray5, tray6, tray7, tray8, tray9,
  box1, box2, box3,
  catering1, catering2, catering3, catering4,
  rental1,
} from "../images";

export interface ServiceContent {
  title: string;
  description: string;
  images: string[];
  hasMenu: boolean;
}

const SERVICE_CONTENT_MAP: Record<string, ServiceContent> = {
  "check-a-lunch": {
    title: "Check-A-Lunch",
    description:
      "Fresh, healthy lunch options delivered daily to your workplace or event. Our check-a-lunch service provides nutritious meals that keep you energized throughout the day.",
    images: [lunch1, lunch2, lunch3, lunch4, lunch5],
    hasMenu: true,
  },
  "party-trays": {
    title: "Party Trays",
    description:
      "Perfect for celebrations, office gatherings, and special events. Our party trays feature an assortment of delicious appetizers, main courses, and desserts that will impress your guests.",
    images: [tray1, tray2, tray3, tray4, tray5, tray6, tray7, tray8, tray9],
    hasMenu: false,
  },
  "fun-boxes": {
    title: "Fun Boxes",
    description:
      "Individual meal boxes packed with flavor and fun! Perfect for picnics, lunch meetings, or when you want a complete meal in a convenient package. Each box is carefully curated with fresh ingredients.",
    images: [box1, box2, box3],
    hasMenu: true,
  },
  catering: {
    title: "Catering Services",
    description:
      "Full-service catering for weddings, corporate events, and special occasions. We handle everything from menu planning to setup, ensuring your event is memorable and stress-free.",
    images: [catering1, catering2, catering3, catering4],
    hasMenu: false,
  },
  "equipment-rental": {
    title: "Equipment Rental",
    description:
      "Professional-grade catering equipment available for rent. From chafing dishes and serving platters to tables and linens, we have everything you need to host the perfect event.",
    images: [rental1],
    hasMenu: false,
  },
};

const NOT_FOUND: ServiceContent = {
  title: "Service Not Found",
  description: "The requested service could not be found.",
  images: [],
  hasMenu: false,
};

export function getServiceContent(slug: string): ServiceContent {
  return SERVICE_CONTENT_MAP[slug] ?? NOT_FOUND;
}
