export interface User {
  id: string;
  name: string;
  isHost: boolean;
  isConnected?: boolean;
  disconnectedAt?: number;
}

export interface MusicMetadata {
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
  mp3Url: string;
  year?: number;
  genre?: string;
  description?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  startedAt: number;
  lastUpdated: number;
  duration: number;
}

export interface Room {
  code: string;
  hostId: string;
  members: User[];
  playback?: PlaybackState;
}

export interface MusicSyncData {
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number;
  serverTimestamp?: number;
  metadata?: MusicMetadata;
  queue?: QueueItem[];
  currentTrackIndex?: number;
}

export interface RoomCreationResponse {
  success: boolean;
  message: string;
  data: {
    room: Room;
    user: User;
  };
}

export interface JoinRoomResponse {
  success: boolean;
  message: string;
  data: {
    room: Room;
    user: User;
  };
}

export interface QueueItem {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url: string;
  addedBy: string;
  addedAt: Date;
}
