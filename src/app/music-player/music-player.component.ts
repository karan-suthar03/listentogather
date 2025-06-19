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
  isDraggingVolume: boolean = false;
  autoplayBlocked: boolean = false;
  isExpanded: boolean = false;
  isMobile: boolean = false;
  isDragging: boolean = false;
  seekPreview: number = 0;
  isHovering: boolean = false;
  private lastSyncTime: number = 0;
  private syncTimeThreshold: number = 60000;
  private isInitialSyncReceived: boolean = false;
  private boundVolumeMouseMove?: (event: MouseEvent) => void;
  private boundVolumeMouseUp?: (event: MouseEvent) => void;
  private draggingVolumeElement?: HTMLElement;
  private animationFrameId: number | null = null;
  private subscriptions: Subscription[] = [];

  isLoadingSync: boolean = false;
  private syncRequestTime: number = 0;

  // Add Math property for template access
  Math = Math;

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

    if (this.isDragging) {
      document.removeEventListener('mousemove', this.updateSeek);
      document.removeEventListener('mouseup', this.endSeek);
      document.body.style.cursor = '';
    }

    if (this.isDraggingVolume) {
      document.removeEventListener('mousemove', this.updateVolumeSeek);
      document.removeEventListener('mouseup', this.endVolumeSeek);
      document.body.style.cursor = '';
    }

    window.removeEventListener('resize', () => {
      this.checkIfMobile();
    });
  }
  togglePlay(): void {
    if (!this.currentUser || !this.roomCode) {
      return;
    }

    // Reduce sync threshold to be less aggressive
    if (!this.isInitialSyncReceived || (Date.now() - this.lastSyncTime) > 180000) {
      console.log('🎵 User not synced recently, requesting sync before control');
      this.socketService.requestSync(this.roomCode);
      // Reduce wait time from 500ms to 200ms
      setTimeout(() => {
        if (this.currentUser && this.roomCode) {
          if (this.isPlaying) {
            this.socketService.pauseMusic(this.roomCode, this.currentUser.id);
          } else {
            this.socketService.playMusic(this.roomCode, this.currentUser.id);
          }
        }
      }, 200);
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
    if (!this.currentUser || !this.roomCode || this.duration <= 0 || this.isDragging) {
      return;
    }

    const progressContainer = event.currentTarget as HTMLElement;
    const rect = progressContainer.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const seekTime = percentage * this.duration;

    this.currentTime = seekTime;

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

  shouldShowLoading(): boolean {
    // Only show loading if we're actually waiting for sync and it's been less than 3 seconds
    return this.isLoadingSync && (Date.now() - this.syncRequestTime) < 3000;
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
      currentTime: this.currentTime,
      musicServiceDebug: this.musicService.getSyncDebugInfo()
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

  seekTo(event: MouseEvent): void {
    if (!this.currentUser || !this.roomCode || this.duration <= 0 || this.isDragging) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const seekTime = percentage * this.duration;

    this.currentTime = seekTime;
    this.socketService.seekMusic(this.roomCode, this.currentUser.id, seekTime);
  }

  startSeek(event: MouseEvent): void {
    if (!this.currentUser || !this.roomCode || this.duration <= 0) return;

    this.isDragging = true;
    this.seekPreview = this.currentTime;

    document.addEventListener('mousemove', this.updateSeek);
    document.addEventListener('mouseup', this.endSeek);
    document.body.style.cursor = 'grabbing';

    event.preventDefault();
    event.stopPropagation();
  }

  updateSeek = (event: MouseEvent): void => {
    if (!this.isDragging || !this.duration) return;

    const seekbars = document.querySelectorAll('.seekbar-container, .desktop-seekbar-container');
    if (seekbars.length === 0) return;

    const rect = seekbars[0].getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    this.seekPreview = percentage * this.duration;
  }
  endSeek = (): void => {
    if (!this.isDragging || !this.currentUser || !this.roomCode) return;

    this.isDragging = false;
    document.removeEventListener('mousemove', this.updateSeek);
    document.removeEventListener('mouseup', this.endSeek);
    document.body.style.cursor = '';

    this.socketService.seekMusic(this.roomCode, this.currentUser.id, this.seekPreview);
  }

  getProgress(): number {
    if (!this.duration) return 0;
    const time = this.isDragging ? this.seekPreview : this.currentTime;
    return Math.max(0, Math.min(100, (time / this.duration) * 100));
  }

  startSeekTouch(event: TouchEvent): void {
    if (!this.currentUser || !this.roomCode || this.duration <= 0) return;

    const touch = event.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      button: 0
    });

    this.startSeek(mouseEvent);
    event.preventDefault();
  }

  async onResumePlayback() {
    const success = await this.musicService.resumePlayback();
    if (!success) {
      console.log('Failed to resume playback after user interaction');
    }
  }  toggleExpanded(): void {
    if (this.isMobile) {
      this.isExpanded = !this.isExpanded;
      // Don't request sync when expanding - we already have the data
      // Only sync if we haven't received initial sync or it's very old (>5 minutes)
      if (!this.isInitialSyncReceived || (Date.now() - this.lastSyncTime) > 300000) {
        this.isLoadingSync = true;
        this.syncRequestTime = Date.now();
        this.socketService.requestSync(this.roomCode);
      }
    }
  }

  closeExpanded(): void {
    this.isExpanded = false;
  }

  getVolumePercentage(): number {
    return Math.round((this.isMuted ? 0 : this.volume) * 100);
  }

  onVolumeClick(event: MouseEvent): void {
    if (this.isDraggingVolume) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));

    this.volume = percentage;
    this.isMuted = false;
    this.musicService.setVolume(percentage);
  }

  startVolumeSeek(event: MouseEvent): void {
    this.isDraggingVolume = true;

    document.addEventListener('mousemove', this.updateVolumeSeek);
    document.addEventListener('mouseup', this.endVolumeSeek);
    document.body.style.cursor = 'grabbing';

    event.preventDefault();
    event.stopPropagation();
  }

  updateVolumeSeek = (event: MouseEvent): void => {
    if (!this.isDraggingVolume) return;

    const volumeContainers = document.querySelectorAll('.volume-seekbar-container, .mobile-volume-seekbar-container');
    if (volumeContainers.length === 0) return;

    const rect = volumeContainers[0].getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));

    this.volume = percentage;
    this.isMuted = false;
    this.musicService.setVolume(percentage);
  }

  endVolumeSeek = (): void => {
    if (!this.isDraggingVolume) return;

    this.isDraggingVolume = false;
    document.removeEventListener('mousemove', this.updateVolumeSeek);
    document.removeEventListener('mouseup', this.endVolumeSeek);
    document.body.style.cursor = '';
  }

  startVolumeTouchSeek(event: TouchEvent): void {
    const touch = event.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      button: 0
    });

    this.startVolumeSeek(mouseEvent);
    event.preventDefault();
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
    this.subscriptions.push(userSub);    const inRoomSub = this.roomStateService.getIsInRoom().subscribe(inRoom => {
      this.isInRoom = inRoom;

      // Only sync when joining room, not on every state change
      if (inRoom && this.roomCode && !this.isInitialSyncReceived) {
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

        if (!this.isDragging) {
          this.currentTime = state.currentTime;
        }

        const newDuration = this.musicService.getDuration();
        if (newDuration && newDuration > 0) {
          this.duration = newDuration;
        }
      })
    );    this.subscriptions.push(
      this.socketService.onMusicState().subscribe(syncData => {
        this.lastSyncTime = Date.now();
        this.isInitialSyncReceived = true;
        this.isLoadingSync = false; // Stop loading indicator

        if (!this.isDragging) {
          this.musicService.syncWithState(syncData);
        }
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
      }));
  }

  private checkIfMobile(): void {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any)['opera'] || '';
    this.isMobile = window.innerWidth <= 768 || /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  }

  // Mobile-friendly seek methods
  onSeekClick(event: MouseEvent): void {
    if (!this.currentUser || !this.roomCode || this.duration <= 0) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const seekTime = percentage * this.duration;

    this.currentTime = seekTime;
    this.socketService.seekMusic(this.roomCode, this.currentUser.id, seekTime);
  }

  onSeekTouchStart(event: TouchEvent): void {
    if (!this.currentUser || !this.roomCode || this.duration <= 0) return;
    
    this.isDragging = true;
    this.seekPreview = this.currentTime;
    
    // Prevent default touch behavior
    event.preventDefault();
    event.stopPropagation();
  }

  onSeekTouchMove(event: TouchEvent): void {
    if (!this.isDragging || !this.duration) return;
    
    const touch = event.touches[0];
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    
    this.seekPreview = percentage * this.duration;
    
    event.preventDefault();
    event.stopPropagation();
  }

  onSeekTouchEnd(event: TouchEvent): void {
    if (!this.isDragging || !this.currentUser || !this.roomCode) return;
    
    this.isDragging = false;
    this.socketService.seekMusic(this.roomCode, this.currentUser.id, this.seekPreview);
    
    event.preventDefault();
    event.stopPropagation();
  }

  // Mobile-friendly volume methods
  onVolumeTouchStart(event: TouchEvent): void {
    this.isDraggingVolume = true;
    
    // Prevent default touch behavior
    event.preventDefault();
    event.stopPropagation();
  }

  onVolumeTouchMove(event: TouchEvent): void {
    if (!this.isDraggingVolume) return;
    
    const touch = event.touches[0];
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    
    this.volume = percentage;
    this.isMuted = false;
    this.musicService.setVolume(percentage);
    
    event.preventDefault();
    event.stopPropagation();
  }

  onVolumeTouchEnd(event: TouchEvent): void {
    if (!this.isDraggingVolume) return;
    
    this.isDraggingVolume = false;
    
    event.preventDefault();
    event.stopPropagation();
  }
}
