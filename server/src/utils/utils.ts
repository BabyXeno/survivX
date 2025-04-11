// src/utils/utils.ts
export const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common":
        return "bg-gray-500";
      case "uncommon":
        return "bg-green-500";
      case "rare":
        return "bg-blue-500";
      case "epic":
        return "bg-purple-500";
      case "legendary":
        return "bg-yellow-500";
      case "mythic":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };
  
  export const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case "common":
        return "shadow-gray-500/30";
      case "uncommon":
        return "shadow-green-500/30";
      case "rare":
        return "shadow-blue-500/30";
      case "epic":
        return "shadow-purple-500/30";
      case "legendary":
        return "shadow-yellow-500/30";
      case "mythic":
        return "shadow-orange-500/30";
      default:
        return "shadow-gray-500/30";
    }
  };
  
  export const getRarityBorder = (rarity: string) => {
    switch (rarity) {
      case "common":
        return "border-gray-600";
      case "uncommon":
        return "border-green-600";
      case "rare":
        return "border-blue-600";
      case "epic":
        return "border-purple-600";
      case "legendary":
        return "border-yellow-600";
      case "mythic":
        return "border-orange-600";
      default:
        return "border-gray-600";
    }
  };
  
  export const getRarityTextColor = (rarity: string) => {
    switch (rarity) {
      case "common":
        return "text-gray-300";
      case "uncommon":
        return "text-green-300";
      case "rare":
        return "text-blue-300";
      case "epic":
        return "text-purple-300";
      case "legendary":
        return "text-yellow-300";
      case "mythic":
        return "text-orange-300";
      default:
        return "text-gray-300";
    }
  };
  