import { catering, checkLunch, funBoxes, partyTrays, equipmentRental } from "../images";

/**
 * The three services you can order online. These are the homepage panels, so
 * they carry a plain display name (no emoji) alongside the card copy.
 */
export interface HomeService {
  name: string;
  slug: string;
  description: string;
  image: string;
}

export const ORDERABLE_SERVICES: HomeService[] = [
  {
    name: "Check-a-Lunch",
    slug: "check-a-lunch",
    description:
      "Packed meals with heart. Choose your meals for the week or day. Freshly prepared, delivered daily. No subscriptions—just food that works around your schedule.",
    image: checkLunch,
  },
  {
    name: "Party Trays",
    slug: "party-trays",
    description:
      "Generous portions, easy hosting. Delicious, ready-to-serve trays for 8–10 people. Perfect for family get-togethers, potlucks, or surprise celebrations.",
    image: partyTrays,
  },
  {
    name: "Merienda Meals",
    slug: "merienda-meals",
    description:
      "Pasta? Sandwich? Dessert? Curated merienda boxes you can mix and match—ideal for events, client gifts, team perks, and anything worth celebrating.",
    image: funBoxes,
  },
];

/**
 * Quote-based services. They have no online ordering, so they live on their own
 * page rather than competing with the three that do.
 */
export const OTHER_SERVICES: HomeService[] = [
  {
    name: "Catering",
    slug: "catering",
    description:
      "Full-service catering for any occasion. From small gatherings to big events, we bring the food, setup, and service so you can focus on hosting.",
    image: catering,
  },
  {
    name: "Equipment Rental",
    slug: "equipment-rental",
    description:
      "Need chafing dishes, buffet tables, or utensils? Rent what you need—no frills, no fuss, no overcharging.",
    image: equipmentRental,
  },
];
