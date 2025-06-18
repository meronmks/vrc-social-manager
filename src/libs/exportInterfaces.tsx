export interface InstanceDetailData {
  id: string;
  instanceId: string;
  ownerId: string | null;
  name: string;
  location: string;
  active: boolean;
  ageGate: boolean | null;
  capacity: number;
  userCount: number;
  n_users: number;
  full: boolean;
  hardClose: string | null;
  closedAt: string | null;
  type: string;
  world: World;
  worldId: string;
  region: string;
  photonRegion: string;
  canRequestInvite: boolean;
  queueEnabled: boolean;
  queueSize: number;
  groupAccessType?: string;
  hidden?: string;
  friends?: string;
  private?: string;
  platforms?: {
    android?: number;
    ios?: number;
    standalonewindows?: number;
  };
  contentSettings?: {
    drones?: boolean;
    emoji?: boolean;
    pedestals?: boolean;
    prints?: boolean;
    stickers?: boolean;
    props?: boolean;
  }
  tags: string[];
}

export interface World {
  authorId: string;
  name: string;
  description: string;
  instances: any;
  thumbnailImageUrl: string;
  authorName?: string;
  popularity?: number;
  visits?: number;
  recommendedCapacity: number;
  tags: string[];
  defaultContentSettings?: {
    drones?: boolean;
    emoji?: boolean;
    pedestals?: boolean;
    prints?: boolean;
    stickers?: boolean;
    props?: boolean;
  };
}

export interface Friend {
  id: string;
  name: string;
  status: string;
  avatar: string;
  location: string;
  bio: string;
  statusDescription?: string;
  platform?: string;
  bioLinks?: string[];
}

export interface Instance {
  id: string;
  worldId: string;
  instanceId: string;
  name: string;
  thumbnail: string;
  friends: Friend[];
}