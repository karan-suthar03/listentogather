import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {MusicService} from '../music.service';
import {SocketService} from '../socket.service';
import {RoomStateService} from '../room-state.service';
import {QueueItem, QueueService} from '../queue.service';
import {User} from '../models/room.model';

@Component({
  selector: 'app-music-player',
  templateUrl: './music-player.component.html',
  styleUrls: ['./music-player.component.css']
})
export class MusicPlayerComponent implements OnInit, OnDestroy {
  roomCode: string = '';
  currentUser: User | null = null;
  isHost: boolean = false;
  isInRoom: boolean = false;

  currentTrack: QueueItem | null = null;
  isPlaying: boolean = false;
  currentTime: number = 0;
  duration: number = 0;
  volume: number = 1.0;
  isMuted: boolean = false;
  previousVolume: number = 1.0;

  queue: QueueItem[] = [];
  currentTrackIndex: number = -1;
  isDraggingProgress: boolean = false;
  isDraggingVolume: boolean = false;
  autoplayBlocked: boolean = false;
  isExpanded: boolean = false;
  isMobile: boolean = false;
  private lastSyncTime: number = 0;
  private syncTimeThreshold: number = 60000;
  private isInitialSyncReceived: boolean = false;
  private boundProgressMouseMove?: (event: MouseEvent) => void;
  private boundProgressMouseUp?: (event: MouseEvent) => void;
  private boundVolumeMouseMove?: (event: MouseEvent) => void;
  private boundVolumeMouseUp?: (event: MouseEvent) => void;
  private draggingProgressElement?: HTMLElement;
  private draggingVolumeElement?: HTMLElement;
  private lastProgressUpdate: number = 0;
  private progressUpdateThrottle: number = 100;
  private subscriptions: Subscription[] = [];

  constructor(
    private musicService: MusicService,
    private socketService: SocketService,
    private roomStateService: RoomStateService,
    private queueService: QueueService
  ) {
  }

  ngOnInit(): void {
    this.setupRoomStateListeners();
    this.setupMusicListeners();
    this.musicService.setVolume(this.volume);

    this.checkIfMobile();

    window.addEventListener('resize', () => {
      this.checkIfMobile();
    });

  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());

    window.removeEventListener('resize', () => {
      this.checkIfMobile();
    });

    this.draggingProgressElement = undefined;
    this.draggingVolumeElement = undefined;

    if (this.boundProgressMouseMove) {
      document.removeEventListener('mousemove', this.boundProgressMouseMove);
    }
    if (this.boundProgressMouseUp) {
      document.removeEventListener('mouseup', this.boundProgressMouseUp);
    }
    if (this.boundVolumeMouseMove) {
      document.removeEventListener('mousemove', this.boundVolumeMouseMove);
    }
    if (this.boundVolumeMouseUp) {
      document.removeEventListener('mouseup', this.boundVolumeMouseUp);
    }
  }

  togglePlay(): void {
    if (!this.currentUser || !this.roomCode) {
      return;
    }

    if (!this.isInitialSyncReceived || (Date.now() - this.lastSyncTime) > 300000) {
      console.log('🎵 User not synced recently, requesting sync before control');
      this.socketService.requestSync(this.roomCode);
      setTimeout(() => {
        if (this.currentUser && this.roomCode) {
          if (this.isPlaying) {
            this.socketService.pauseMusic(this.roomCode, this.currentUser.id);
          } else {
            this.socketService.playMusic(this.roomCode, this.currentUser.id);
          }
        }
      }, 500);
      return;
    }

    if (this.isPlaying) {
      this.socketService.pauseMusic(this.roomCode, this.currentUser.id);
    } else {
      this.socketService.playMusic(this.roomCode, this.currentUser.id);
    }
  }

  onSeek(event: any): void {
    if (!this.currentUser || !this.roomCode) {
      return;
    }

    const seekTime = parseFloat(event.target.value);
    this.socketService.seekMusic(this.roomCode, this.currentUser.id, seekTime);
  }

  onVolumeChange(event: any): void {
    const volume = parseFloat(event.target.value) / 100;
    this.volume = volume;
    this.musicService.setVolume(volume);
  }

  onProgressClick(event: MouseEvent): void {
    if (!this.currentUser || !this.roomCode || this.duration <= 0) {
      return;
    }

    const progressContainer = event.currentTarget as HTMLElement;
    const rect = progressContainer.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = percentage * this.duration;

    this.socketService.seekMusic(this.roomCode, this.currentUser.id, seekTime);
  }

  onVolumeClick(event: MouseEvent): void {
    const volumeTrack = event.currentTarget as HTMLElement;
    const rect = volumeTrack.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));

    this.volume = percentage;
    this.isMuted = false;
    this.musicService.setVolume(percentage);
  }

  toggleMute(): void {
    if (this.isMuted) {
      this.volume = this.previousVolume;
      this.isMuted = false;
      this.musicService.setVolume(this.volume);
    } else {
      this.previousVolume = this.volume;
      this.volume = 0;
      this.isMuted = true;
      this.musicService.setVolume(0);
    }
  }

  nextTrack(): void {
    if (!this.currentUser || !this.roomCode) return;
    this.socketService.nextTrack(this.roomCode, this.currentUser.id);
  }

  previousTrack(): void {
    if (!this.currentUser || !this.roomCode) return;
    this.socketService.previousTrack(this.roomCode, this.currentUser.id);
  }

  playTrackAtIndex(index: number): void {
    if (!this.currentUser || !this.roomCode) return;
    this.socketService.playTrackAtIndex(this.roomCode, this.currentUser.id, index);
  }

  isTrackReady(): boolean {
    return this.currentTrack !== null &&
      (this.currentTrack.downloadStatus === 'completed' ||
        !!(this.currentTrack.mp3Url && this.currentTrack.mp3Url.length > 0));
  }

  hasNextTrack(): boolean {
    return this.queue.length > 0 && this.currentTrackIndex < this.queue.length - 1;
  }

  hasPreviousTrack(): boolean {
    return this.queue.length > 0 && this.currentTrackIndex > 0;
  }

  getPlayButtonTitle(): string {
    if (!this.currentUser) return 'Join room to control';
    if (!this.currentTrack) return 'No track selected';
    if (!this.isTrackReady()) return 'Track is downloading...';
    return this.isPlaying ? 'Pause' : 'Play';
  }

  getVolumeIcon(): string {
    if (this.isMuted || this.volume === 0) {
      return 'volume-x';
    } else if (this.volume < 0.5) {
      return 'volume-1';
    } else {
      return 'volume-2';
    }
  }

  isInSync(): boolean {
    return this.isInitialSyncReceived;
  }

  checkSyncState(): void {
    console.log('🎵 Sync State Debug:', {
      isInitialSyncReceived: this.isInitialSyncReceived,
      lastSyncTime: new Date(this.lastSyncTime).toLocaleTimeString(),
      timeSinceLastSync: Date.now() - this.lastSyncTime,
      isInRoom: this.isInRoom,
      roomCode: this.roomCode,
      currentUser: this.currentUser?.name,
      currentTrack: this.currentTrack?.title,
      isPlaying: this.isPlaying,
      currentTime: this.currentTime
    });
  }

  manualSync(): void {
    if (this.roomCode) {
      console.log('🎵 Manual sync triggered');
      this.socketService.requestSync(this.roomCode);
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }

  onProgressMouseDown(event: MouseEvent): void {
    if (!this.currentUser || !this.roomCode || this.duration <= 0) {
      return;
    }

    this.isDraggingProgress = true;

    let progressElement = event.target as HTMLElement;
    while (progressElement && !progressElement.classList.contains('progress-track')) {
      progressElement = progressElement.parentElement as HTMLElement;
    }
    this.draggingProgressElement = progressElement;

    this.updateProgressFromEvent(event, false);

    this.boundProgressMouseMove = this.onProgressMouseMove.bind(this);
    this.boundProgressMouseUp = this.onProgressMouseUp.bind(this);

    document.addEventListener('mousemove', this.boundProgressMouseMove);
    document.addEventListener('mouseup', this.boundProgressMouseUp);

    event.preventDefault();
  }

  onProgressMouseMove(event: MouseEvent): void {
    if (!this.isDraggingProgress) return;
    this.updateProgressFromEvent(event, false);
  }

  onProgressMouseUp(event: MouseEvent): void {
    if (!this.isDraggingProgress) return;

    this.isDraggingProgress = false;
    this.updateProgressFromEvent(event, true);

    this.draggingProgressElement = undefined;

    if (this.boundProgressMouseMove) {
      document.removeEventListener('mousemove', this.boundProgressMouseMove);
    }
    if (this.boundProgressMouseUp) {
      document.removeEventListener('mouseup', this.boundProgressMouseUp);
    }
  }

  onVolumeMouseDown(event: MouseEvent): void {
    this.isDraggingVolume = true;

    let volumeElement = event.target as HTMLElement;
    while (volumeElement && !volumeElement.classList.contains('volume-track')) {
      volumeElement = volumeElement.parentElement as HTMLElement;
    }
    this.draggingVolumeElement = volumeElement;

    this.updateVolumeFromEvent(event);

    this.boundVolumeMouseMove = this.onVolumeMouseMove.bind(this);
    this.boundVolumeMouseUp = this.onVolumeMouseUp.bind(this);

    document.addEventListener('mousemove', this.boundVolumeMouseMove);
    document.addEventListener('mouseup', this.boundVolumeMouseUp);

    event.preventDefault();
  }

  onVolumeMouseMove(event: MouseEvent): void {
    if (!this.isDraggingVolume) return;
    this.updateVolumeFromEvent(event);
  }

  onVolumeMouseUp(event: MouseEvent): void {
    if (!this.isDraggingVolume) return;

    this.isDraggingVolume = false;
    this.updateVolumeFromEvent(event);

    this.draggingVolumeElement = undefined;

    if (this.boundVolumeMouseMove) {
      document.removeEventListener('mousemove', this.boundVolumeMouseMove);
    }
    if (this.boundVolumeMouseUp) {
      document.removeEventListener('mouseup', this.boundVolumeMouseUp);
    }
  }

  async onResumePlayback() {
    const success = await this.musicService.resumePlayback();
    if (!success) {
      console.log('Failed to resume playback after user interaction');
    }
  }

  toggleExpanded(): void {
    if (this.isMobile) {
      this.isExpanded = !this.isExpanded;
    }
  }

  closeExpanded(): void {
    this.isExpanded = false;
  }

  private setupRoomStateListeners(): void {
    const roomSub = this.roomStateService.getCurrentRoom().subscribe(room => {
      this.roomCode = room?.code || '';
      if (this.roomCode) {
        this.socketService.requestSync(this.roomCode);
      }
    });
    this.subscriptions.push(roomSub);

    const userSub = this.roomStateService.getCurrentUser().subscribe(user => {
      this.currentUser = user;
      this.isHost = user?.isHost || false;
    });
    this.subscriptions.push(userSub);

    const inRoomSub = this.roomStateService.getIsInRoom().subscribe(inRoom => {
      this.isInRoom = inRoom;

      if (inRoom && this.roomCode) {
        setTimeout(() => {
          if (this.roomCode) {
            this.socketService.requestSync(this.roomCode);
          }
        }, 100);
      }
    });
    this.subscriptions.push(inRoomSub);

    this.subscriptions.push(
      this.musicService.autoplayBlocked$.subscribe(blocked => {
        this.autoplayBlocked = blocked;
      })
    );
  }

  private setupMusicListeners(): void {
    this.subscriptions.push(
      this.musicService.getCurrentTrack().subscribe(track => {
        this.currentTrack = track;
        this.duration = this.musicService.getDuration();
      })
    );

    this.subscriptions.push(
      this.musicService.getPlaybackState().subscribe(state => {
        this.isPlaying = state.isPlaying;
        this.currentTime = state.currentTime;

        const newDuration = this.musicService.getDuration();
        if (newDuration && newDuration > 0) {
          this.duration = newDuration;
        }
      })
    );

    this.subscriptions.push(
      this.socketService.onMusicState().subscribe(syncData => {
        this.lastSyncTime = Date.now();
        this.isInitialSyncReceived = true;

        this.musicService.syncWithState(syncData);
      })
    );

    this.subscriptions.push(
      this.queueService.queue$.subscribe(queueData => {
        this.queue = queueData.queue;
        this.currentTrackIndex = queueData.currentTrackIndex;
      })
    );

    this.subscriptions.push(
      this.socketService.onSocketConnect().subscribe(() => {
        console.log('🎵 Socket reconnected - requesting sync');
        setTimeout(() => {
          if (this.roomCode) {
            console.log('🎵 Requesting sync after socket reconnection...');
            this.socketService.requestSync(this.roomCode);
          }
        }, 500);
      })
    );

    this.subscriptions.push(
      this.musicService.autoplayBlocked$.subscribe(blocked => {
        this.autoplayBlocked = blocked;
        console.log('🎵 Autoplay blocked state:', blocked);
      })
    );
  }

  private updateProgressFromEvent(event: MouseEvent, sendToServer: boolean = true): void {
    if (!this.currentUser || !this.roomCode || this.duration <= 0) return;

    let progressElement = this.draggingProgressElement;
    if (!progressElement) {
      progressElement = event.target as HTMLElement;
      while (progressElement && !progressElement.classList.contains('progress-track')) {
        progressElement = progressElement.parentElement as HTMLElement;
      }
    }
    if (!progressElement) return;

    const rect = progressElement.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const percentage = clickX / rect.width;
    const seekTime = percentage * this.duration;

    this.currentTime = seekTime;

    if (sendToServer) {
      this.socketService.seekMusic(this.roomCode, this.currentUser.id, seekTime);
    }
  }

  private updateVolumeFromEvent(event: MouseEvent): void {
    let volumeElement = this.draggingVolumeElement;
    if (!volumeElement) {
      volumeElement = event.target as HTMLElement;
      while (volumeElement && !volumeElement.classList.contains('volume-track')) {
        volumeElement = volumeElement.parentElement as HTMLElement;
      }
    }
    if (!volumeElement) return;

    const rect = volumeElement.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));

    this.volume = percentage;
    this.isMuted = false;
    this.musicService.setVolume(percentage);
  }

  private checkIfMobile(): void {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any)['opera'] || '';

    this.isMobile = window.innerWidth <= 768 || /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  }
}
