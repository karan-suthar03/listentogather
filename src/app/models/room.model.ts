export interface User {
  id: string;
  name: string;
  isHost: boolean;
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
  metadata: MusicMetadata;
}

export interface RoomCreationResponse {
  room: Room;
  user: User;
}

export interface JoinRoomResponse {
  room: Room;
  user: User;
}
