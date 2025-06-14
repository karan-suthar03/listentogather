import { Injectable } from '@angular/core';
import io from 'socket.io-client';
import { Observable } from 'rxjs';
import { Room, User, MusicSyncData } from './models/room.model';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: any;
  
  constructor(private configService: ConfigService) {
    this.socket = io(this.configService.socketUrl, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      timeout: 5000
    });
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
  // Listen for errors
  onError(): Observable<{ message: string }> {
    return new Observable(observer => {
      this.socket.on('error', (error: { message: string }) => {
        observer.next(error);
      });
    });
  }  // Music control methods (for any participant)
  playMusic(roomCode: string, userId: string): void {
    this.socket.emit('music-control', {
      roomCode,
      userId,
      action: 'play'
    });
  }

  pauseMusic(roomCode: string, userId: string): void {
    this.socket.emit('music-control', {
      roomCode,
      userId,
      action: 'pause'
    });
  }

  seekMusic(roomCode: string, userId: string, time: number): void {
    this.socket.emit('music-control', {
      roomCode,
      userId,
      action: 'seek',
      data: { time }
    });
  }

  nextTrack(roomCode: string, userId: string): void {
    this.socket.emit('music-control', {
      roomCode,
      userId,
      action: 'next'
    });
  }

  previousTrack(roomCode: string, userId: string): void {
    this.socket.emit('music-control', {
      roomCode,
      userId,
      action: 'previous'
    });
  }

  playTrackAtIndex(roomCode: string, userId: string, trackIndex: number): void {
    this.socket.emit('music-control', {
      roomCode,
      userId,
      action: 'playTrack',
      data: { trackIndex }
    });
  }

  // Host control methods (deprecated but kept for compatibility)
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

  // Listen for queue item progress updates
  onQueueItemProgress(): Observable<{ queueItemId: string, progress: number, status: string }> {
    return new Observable(observer => {
      this.socket.on('queueItemProgress', (data: { queueItemId: string, progress: number, status: string }) => {
        observer.next(data);
      });
    });
  }

  // Listen for queue item completion
  onQueueItemComplete(): Observable<{ queueItemId: string, mp3Url: string, status: string }> {
    return new Observable(observer => {
      this.socket.on('queueItemComplete', (data: { queueItemId: string, mp3Url: string, status: string }) => {
        observer.next(data);
      });
    });
  }

  // Listen for queue item errors
  onQueueItemError(): Observable<{ queueItemId: string, error: string, status: string }> {
    return new Observable(observer => {
      this.socket.on('queueItemError', (data: { queueItemId: string, error: string, status: string }) => {
        observer.next(data);
      });
    });
  }

  // Listen for queue updates
  onQueueUpdated(): Observable<{ queue: any[], currentTrackIndex: number }> {
    return new Observable(observer => {
      this.socket.on('queueUpdated', (data: { queue: any[], currentTrackIndex: number }) => {
        observer.next(data);
      });
    });
  }

  // Listen for room working state changes
  onRoomWorkingStateChanged(): Observable<{ isWorking: boolean, workingMessage: string }> {
    return new Observable(observer => {
      this.socket.on('roomWorkingStateChanged', (data: { isWorking: boolean, workingMessage: string }) => {
        observer.next(data);
      });
    });
  }
}
