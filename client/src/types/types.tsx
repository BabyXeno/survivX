// src/types/types.ts
export interface Mission {
    id: number;
    title: string;
    progress: number;
    total: number;
    xp: number;
  }
  
  export interface Streamer {
    id: number;
    name: string;
    viewers: number;
    avatar: string;
  }
  
  export interface Reward {
    id: number;
    rarity: string;
    isPremium: boolean;
    position: number;
    image: string;
    icon?: any;
    type?: string;
  }
  
  export interface LoadoutItem {
    id: number;
    name: string;
    rarity: string;
    type: string;
    image: string;
    price?: number;
  }
  