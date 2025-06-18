import {Injectable, OnDestroy} from '@angular/core';
import io from 'socket.io-client';
import {Observable, Subject} from 'rxjs';
import {MusicSyncData, Room, User} from './models/room.model';
import {ConfigService} from './config.service';

@Injectable({
  providedIn: 'root'
})
export class SocketService implements OnDestroy {
  private socket: any;
  private roomUpdate$ = new Subject<Room>();
  private userJoined$ = new Subject<{ user: User, room: Room }>();
  private userLeft$ = new Subject<{ user: User, room: Room }>();
  private userDisconnected$ = new Subject<{ userId: string, user: User, room: Room }>();
  private userReconnected$ = new Subject<{ userId: string, user: User, room: Room }>();
  private participantList$ = new Subject<User[]>();
  private musicState$ = new Subject<MusicSyncData>();
  private error$ = new Subject<{ message: string }>();
  private queueItemProgress$ = new Subject<{ queueItemId: string, progress: number, status: string }>();
  private queueItemComplete$ = new Subject<{ queueItemId: string, mp3Url: string, status: string }>();
  private queueItemError$ = new Subject<{ queueItemId: string, error: string, status: string }>();
  private queueUpdated$ = new Subject<{ queue: any[], currentTrackIndex: number }>();
  private roomWorkingStateChanged$ = new Subject<{ isWorking: boolean, workingMessage: string }>();
  private roomDeleted$ = new Subject<{ roomCode: string, reason: string, message: string }>();
  private forceDisconnect$ = new Subject<{ reason: string, message: string }>();
  private socketDisconnect$ = new Subject<string>();
  private socketConnect$ = new Subject<void>();
  private hostChanged$ = new Subject<{ newHost: User, previousHost?: User, reason: string, room: Room }>();

  constructor(private configService: ConfigService) {
    this.socket = io(this.configService.socketUrl, {
      transports: ['websocket', 'polling'],
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10000,
      upgrade: true,
      rememberUpgrade: true,
      autoConnect: true
    });

    this.setupSocketListeners();
  }

  joinRoom(roomCode: string, user: User): void {
    this.socket.emit('join-room', {roomCode, user});
  }

  leaveRoom(roomCode: string): void {
    this.socket.emit('leave-room', {roomCode});
  }

  onRoomUpdate(): Observable<Room> {
    return this.roomUpdate$.asObservable();
  }

  onUserJoined(): Observable<{ user: User, room: Room }> {
    return this.userJoined$.asObservable();
  }

  onUserLeft(): Observable<{ user: User, room: Room }> {
    return this.userLeft$.asObservable();
  }

  onUserDisconnected(): Observable<{ userId: string, user: User, room: Room }> {
    return this.userDisconnected$.asObservable();
  }

  onUserReconnected(): Observable<{ userId: string, user: User, room: Room }> {
    return this.userReconnected$.asObservable();
  }

  onParticipantList(): Observable<User[]> {
    return this.participantList$.asObservable();
  }

  getParticipants(roomCode: string): void {
    this.socket.emit('get-participants', {roomCode});
  }

  onMusicState(): Observable<MusicSyncData> {
    return this.musicState$.asObservable();
  }

  onError(): Observable<{ message: string }> {
    return this.error$.asObservable();
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

  getSocketStatus(): { connected: boolean, id: string | undefined, transport: string | undefined } {
    return {
      connected: this.socket.connected,
      id: this.socket.id,
      transport: this.socket.io?.engine?.transport?.name
    };
  }

  onQueueItemProgress(): Observable<{ queueItemId: string, progress: number, status: string }> {
    return this.queueItemProgress$.asObservable();
  }

  onQueueItemComplete(): Observable<{ queueItemId: string, mp3Url: string, status: string }> {
    return this.queueItemComplete$.asObservable();
  }

  onQueueItemError(): Observable<{ queueItemId: string, error: string, status: string }> {
    return this.queueItemError$.asObservable();
  }

  onQueueUpdated(): Observable<{ queue: any[], currentTrackIndex: number }> {
    return this.queueUpdated$.asObservable();
  }

  onRoomWorkingStateChanged(): Observable<{ isWorking: boolean, workingMessage: string }> {
    return this.roomWorkingStateChanged$.asObservable();
  }

  onRoomDeleted(): Observable<{ roomCode: string, reason: string, message: string }> {
    return this.roomDeleted$.asObservable();
  }

  onForceDisconnect(): Observable<{ reason: string, message: string }> {
    return this.forceDisconnect$.asObservable();
  }

  onSocketDisconnect(): Observable<string> {
    return this.socketDisconnect$.asObservable();
  }

  onSocketConnect(): Observable<void> {
    return this.socketConnect$.asObservable();
  }

  onHostChanged(): Observable<{ newHost: User, previousHost?: User, reason: string, room: Room }> {
    return this.hostChanged$.asObservable();
  }

  transferHost(roomCode: string, newHostId: string): void {
    this.socket.emit('transfer-host', {roomCode, newHostId});
  }

  layoutChangeReconnect(roomCode: string, user: User, reason: string): void {
    console.log(`📱 Sending layout change reconnect for room ${roomCode}`);
    this.socket.emit('layout-change-reconnect', {roomCode, user, reason});
  }

  onLayoutReconnectSuccess(): Observable<{ roomCode: string, message: string }> {
    return new Observable(observer => {
      this.socket.on('layout-reconnect-success', (data: { roomCode: string, message: string }) => {
        observer.next(data);
      });
    });
  }

  ngOnDestroy(): void {
    this.roomUpdate$.complete();
    this.userJoined$.complete();
    this.userLeft$.complete();
    this.userDisconnected$.complete();
    this.userReconnected$.complete();
    this.participantList$.complete();
    this.musicState$.complete();
    this.error$.complete();
    this.queueItemProgress$.complete();
    this.queueItemComplete$.complete();
    this.queueItemError$.complete();
    this.queueUpdated$.complete();
    this.roomWorkingStateChanged$.complete();
    this.roomDeleted$.complete();
    this.forceDisconnect$.complete();
    this.socketDisconnect$.complete();
    this.socketConnect$.complete();
    this.hostChanged$.complete();

    if (this.socket) {
      this.socket.disconnect();
    }
  }

  forceReconnect(): void {
    console.log('🔄 Force reconnecting socket...');
    if (this.socket) {
      this.socket.disconnect();
      setTimeout(() => {
        this.socket.connect();
      }, 100);
    }
  }

  private setupSocketListeners(): void {
    this.socket.on('room-updated', (room: Room) => {
      this.roomUpdate$.next(room);
    });

    this.socket.on('user-joined', (data: { user: User, room: Room }) => {
      this.userJoined$.next(data);
    });

    this.socket.on('user-left', (data: { user: User, room: Room }) => {
      this.userLeft$.next(data);
    });

    this.socket.on('user-disconnected', (data: { userId: string, user: User, room: Room }) => {
      this.userDisconnected$.next(data);
    });

    this.socket.on('user-reconnected', (data: { userId: string, user: User, room: Room }) => {
      this.userReconnected$.next(data);
    });

    this.socket.on('participant-list', (participants: User[]) => {
      this.participantList$.next(participants);
    });

    this.socket.on('music-state', (syncData: MusicSyncData) => {
      this.musicState$.next(syncData);
    });

    this.socket.on('error', (error: { message: string }) => {
      this.error$.next(error);
    });

    this.socket.on('queueItemProgress', (data: { queueItemId: string, progress: number, status: string }) => {
      this.queueItemProgress$.next(data);
    });

    this.socket.on('queueItemComplete', (data: { queueItemId: string, mp3Url: string, status: string }) => {
      this.queueItemComplete$.next(data);
    });

    this.socket.on('queueItemError', (data: { queueItemId: string, error: string, status: string }) => {
      this.queueItemError$.next(data);
    });

    this.socket.on('queueUpdated', (data: { queue: any[], currentTrackIndex: number }) => {
      this.queueUpdated$.next(data);
    });

    this.socket.on('roomWorkingStateChanged', (data: { isWorking: boolean, workingMessage: string }) => {
      this.roomWorkingStateChanged$.next(data);
    });

    this.socket.on('room-deleted', (data: { roomCode: string, reason: string, message: string }) => {
      this.roomDeleted$.next(data);
    });

    this.socket.on('force-disconnect', (data: { reason: string, message: string }) => {
      this.forceDisconnect$.next(data);
    });

    this.socket.on('connect', () => {
      console.log('🔌 Socket connected');
      this.socketConnect$.next();
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('🔌 Socket disconnected:', reason);
      this.socketDisconnect$.next(reason);
    });

    this.socket.on('host-changed', (data: { newHost: User, previousHost?: User, reason: string, room: Room }) => {
      this.hostChanged$.next(data);
    });
  }
}
