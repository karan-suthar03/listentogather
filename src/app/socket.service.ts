import {Injectable} from '@angular/core';
import io from 'socket.io-client';
import {Observable} from 'rxjs';
import {MusicSyncData, Room, User} from './models/room.model';
import {ConfigService} from './config.service';

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

  joinRoom(roomCode: string, user: User): void {
    this.socket.emit('join-room', {roomCode, user});
  }

  leaveRoom(roomCode: string): void {
    this.socket.emit('leave-room', {roomCode});
  }

  onRoomUpdate(): Observable<Room> {
    return new Observable(observer => {
      this.socket.on('room-updated', (room: Room) => {
        observer.next(room);
      });
    });
  }

  onUserJoined(): Observable<{ user: User, room: Room }> {
    return new Observable(observer => {
      this.socket.on('user-joined', (data: { user: User, room: Room }) => {
        observer.next(data);
      });
    });
  }

  onUserLeft(): Observable<{ user: User, room: Room }> {
    return new Observable(observer => {
      this.socket.on('user-left', (data: { user: User, room: Room }) => {
        observer.next(data);
      });
    });
  }

  onUserDisconnected(): Observable<{ userId: string, user: User, room: Room }> {
    return new Observable(observer => {
      this.socket.on('user-disconnected', (data: { userId: string, user: User, room: Room }) => {
        observer.next(data);
      });
    });
  }

  onUserReconnected(): Observable<{ userId: string, user: User, room: Room }> {
    return new Observable(observer => {
      this.socket.on('user-reconnected', (data: { userId: string, user: User, room: Room }) => {
        observer.next(data);
      });
    });
  }

  onParticipantList(): Observable<User[]> {
    return new Observable(observer => {
      this.socket.on('participant-list', (participants: User[]) => {
        observer.next(participants);
      });
    });
  }

  getParticipants(roomCode: string): void {
    this.socket.emit('get-participants', {roomCode});
  }

  onMusicState(): Observable<MusicSyncData> {
    return new Observable(observer => {
      this.socket.on('music-state', (syncData: MusicSyncData) => {
        observer.next(syncData);
      });
    });
  }

  onError(): Observable<{ message: string }> {
    return new Observable(observer => {
      this.socket.on('error', (error: { message: string }) => {
        observer.next(error);
      });
    });
  }

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
      data: {time}
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
      data: {trackIndex}
    });
  }

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
      data: {time}
    });
  }

  requestSync(roomCode: string): void {
    this.socket.emit('sync-request', {roomCode});
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  isConnected(): boolean {
    return this.socket.connected;
  }

  onQueueItemProgress(): Observable<{ queueItemId: string, progress: number, status: string }> {
    return new Observable(observer => {
      this.socket.on('queueItemProgress', (data: { queueItemId: string, progress: number, status: string }) => {
        observer.next(data);
      });
    });
  }

  onQueueItemComplete(): Observable<{ queueItemId: string, mp3Url: string, status: string }> {
    return new Observable(observer => {
      this.socket.on('queueItemComplete', (data: { queueItemId: string, mp3Url: string, status: string }) => {
        observer.next(data);
      });
    });
  }

  onQueueItemError(): Observable<{ queueItemId: string, error: string, status: string }> {
    return new Observable(observer => {
      this.socket.on('queueItemError', (data: { queueItemId: string, error: string, status: string }) => {
        observer.next(data);
      });
    });
  }

  onQueueUpdated(): Observable<{ queue: any[], currentTrackIndex: number }> {
    return new Observable(observer => {
      this.socket.on('queueUpdated', (data: { queue: any[], currentTrackIndex: number }) => {
        observer.next(data);
      });
    });
  }

  onRoomWorkingStateChanged(): Observable<{ isWorking: boolean, workingMessage: string }> {
    return new Observable(observer => {
      this.socket.on('roomWorkingStateChanged', (data: { isWorking: boolean, workingMessage: string }) => {
        observer.next(data);
      });
    });
  }

  onRoomDeleted(): Observable<{ roomCode: string, reason: string, message: string }> {
    return new Observable(observer => {
      this.socket.on('room-deleted', (data: { roomCode: string, reason: string, message: string }) => {
        observer.next(data);
      });
    });
  }

  onForceDisconnect(): Observable<{ reason: string, message: string }> {
    return new Observable(observer => {
      this.socket.on('force-disconnect', (data: { reason: string, message: string }) => {
        observer.next(data);
      });
    });
  }

  onSocketDisconnect(): Observable<string> {
    return new Observable(observer => {
      this.socket.on('disconnect', (reason: string) => {
        observer.next(reason);
      });
    });
  }

  onSocketConnect(): Observable<void> {
    return new Observable(observer => {
      this.socket.on('connect', () => {
        observer.next();
      });
    });
  }
}
