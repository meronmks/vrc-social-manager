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
    hidden?: string;
    friends?: string;
    private?: string;
}

export interface World {
    authorId: string;
    name: string;
    description: string;
    instances: any;
    thumbnailImageUrl: string;
}

export interface Friend {
    id: string;
    name: string;
    status: string;
    avatar: string;
    location: string;
    bio: string;
}

export interface Instance {
    id: string;
    worldId: string;
    instanceId: string;
    name: string;
    thumbnail: string;
    friends: Friend[];
}