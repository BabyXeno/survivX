// src/components/SellItems.tsx
import React, { useState } from "react";
import { LoadoutItem } from "../types/types";
import { initialLoadout } from "../data/data";

const SellItems = () => {
  const [loadout, setLoadout] = useState<LoadoutItem[]>(initialLoadout);
  const [selectedRarity, setSelectedRarity] = useState("");
  const [selectedType, setSelectedType] = useState("");

  const handleRarityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRarity(e.target.value);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedType(e.target.value);
  };

  const filteredLoadout = loadout.filter((item) => {
    if (selectedRarity && item.rarity !== selectedRarity) {
      return false;
    }
    if (selectedType && item.type !== selectedType) {
      return false;
    }
    return true;
  });

  const handleSellItem = (itemId: number) => {
    console.log(`Selling item with ID: ${itemId}`);
  };

  return (
    <div className="flex">
      <div className="w-1/4 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-bold text-white mb-4">Filter Items</h3>
        <div>
          <label className="block text-gray-400 text-sm mb-2">Rarity:</label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:shadow-outline bg-gray-700 text-white"
            value={selectedRarity}
            onChange={handleRarityChange}
          >
            <option value="">All Rarities</option>
            <option value="common">Common</option>
            <option value="uncommon">Uncommon</option>
            <option value="rare">Rare</option>
            <option value="epic">Epic</option>
            <option value="legendary">Legendary</option>
            <option value="mythic">Mythic</option>
          </select>
        </div>

        <div className="mt-4">
          <label className="block text-gray-400 text-sm mb-2">Type:</label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:shadow-outline bg-gray-700 text-white"
            value={selectedType}
            onChange={handleTypeChange}
          >
            <option value="">All Types</option>
            <option value="skin">Skin</option>
            <option value="emote">Emote</option>
            <option value="melee">Melee</option>
            {/* Add more types as needed */}
          </select>
        </div>
      </div>

      <div className="w-3/4 p-4">
        <h3 className="text-lg font-bold text-white mb-4">Your Loadout</h3>
        <div className="grid grid-cols-3 gap-4">
          {filteredLoadout.map((item) => (
            <div
              key={item.id}
              className="bg-gray-700 rounded-lg p-4 flex flex-col"
            >
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-32 object-contain mb-2"
              />
              <h4 className="text-md font-semibold text-white">{item.name}</h4>
              <p className="text-gray-400 text-sm">
                Rarity: {item.rarity}
              </p>
              <p className="text-gray-400 text-sm">Type: {item.type}</p>
              <button
                className="mt-auto bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded"
                onClick={() => handleSellItem(item.id)}
              >
                Sell Item
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SellItems;
