import { Injectable } from '@angular/core';
import { io } from 'socket.io-client';
import { Observable } from 'rxjs';
import { Room, User, MusicSyncData, MusicMetadata } from './models/room.model';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: any;
  private readonly url = 'http://localhost:3000';

  constructor() {
    this.socket = io(this.url);
  }

  // Join a room
  joinRoom(roomCode: string, user: User): void {
    this.socket.emit('join-room', { roomCode, user });
  }

  // Leave a room
  leaveRoom(roomCode: string): void {
    this.socket.emit('leave-room', { roomCode });
  }

  // Listen for room updates
  onRoomUpdate(): Observable<Room> {
    return new Observable(observer => {
      this.socket.on('room-updated', (room: Room) => {
        observer.next(room);
      });
    });
  }
  // Listen for user joined events
  onUserJoined(): Observable<{ user: User, room: Room }> {
    return new Observable(observer => {
      this.socket.on('user-joined', (data: { user: User, room: Room }) => {
        observer.next(data);
      });
    });
  }

  // Listen for user left events
  onUserLeft(): Observable<{ user: User, room: Room }> {
    return new Observable(observer => {
      this.socket.on('user-left', (data: { user: User, room: Room }) => {
        observer.next(data);
      });
    });
  }

  // Listen for participant list updates
  onParticipantList(): Observable<User[]> {
    return new Observable(observer => {
      this.socket.on('participant-list', (participants: User[]) => {
        observer.next(participants);
      });
    });
  }

  // Request current participant list
  getParticipants(roomCode: string): void {
    this.socket.emit('get-participants', { roomCode });
  }

  // Listen for music state updates
  onMusicState(): Observable<MusicSyncData> {
    return new Observable(observer => {
      this.socket.on('music-state', (syncData: MusicSyncData) => {
        observer.next(syncData);
      });
    });
  }

  // Listen for music metadata
  onMusicMeta(): Observable<MusicMetadata> {
    return new Observable(observer => {
      this.socket.on('music-meta', (metadata: MusicMetadata) => {
        observer.next(metadata);
      });
    });
  }

  // Listen for errors
  onError(): Observable<{ message: string }> {
    return new Observable(observer => {
      this.socket.on('error', (error: { message: string }) => {
        observer.next(error);
      });
    });
  }

  // Host control methods
  hostPlay(roomCode: string, userId: string): void {
    this.socket.emit('host-control', {
      roomCode,
      userId,
      action: 'play'
    });
  }

  hostPause(roomCode: string, userId: string): void {
    this.socket.emit('host-control', {
      roomCode,
      userId,
      action: 'pause'
    });
  }

  hostSeek(roomCode: string, userId: string, time: number): void {
    this.socket.emit('host-control', {
      roomCode,
      userId,
      action: 'seek',
      data: { time }
    });
  }

  // Request music metadata
  getMusicMeta(): void {
    this.socket.emit('get-music-meta');
  }

  // Request sync state
  requestSync(roomCode: string): void {
    this.socket.emit('sync-request', { roomCode });
  }

  // Disconnect socket
  disconnect(): void {
    this.socket.disconnect();
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket.connected;
  }
}
