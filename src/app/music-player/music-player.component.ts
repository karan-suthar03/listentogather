import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MusicService } from '../music.service';
import { SocketService } from '../socket.service';
import { RoomStateService } from '../room-state.service';
import { QueueService, QueueItem } from '../queue.service';
import { User } from '../models/room.model';

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
  volume: number = 0.5;
  isMuted: boolean = false;
  previousVolume: number = 0.5;
  
  queue: QueueItem[] = [];
  currentTrackIndex: number = -1;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private musicService: MusicService,
    private socketService: SocketService,
    private roomStateService: RoomStateService,
    private queueService: QueueService
  ) {}

  ngOnInit(): void {
    this.setupRoomStateListeners();
    this.setupMusicListeners();
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
    });
    this.subscriptions.push(inRoomSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private setupMusicListeners(): void {
    const queueSub = this.queueService.queue$.subscribe(queueData => {
      this.queue = queueData.queue;
      this.currentTrackIndex = queueData.currentTrackIndex;
      
      if (queueData.currentTrackIndex >= 0 && queueData.queue.length > queueData.currentTrackIndex) {
        this.currentTrack = queueData.queue[queueData.currentTrackIndex];
        this.duration = this.currentTrack.duration || 0;
      } else {
        this.currentTrack = null;
        this.duration = 0;
      }
    });
    this.subscriptions.push(queueSub);

    const playbackSub = this.musicService.getPlaybackState().subscribe(state => {
      this.isPlaying = state.isPlaying;
      this.currentTime = state.currentTime;
    });
    this.subscriptions.push(playbackSub);

    // Listen to socket events
    const musicStateSub = this.socketService.onMusicState().subscribe(syncData => {
      this.musicService.syncWithState(syncData);
    });
    this.subscriptions.push(musicStateSub);

    const errorSub = this.socketService.onError().subscribe(error => {
      console.error('Music control error:', error.message);
      alert(error.message);
    });
    this.subscriptions.push(errorSub);
  }

  togglePlay(): void {
    if (!this.currentUser || !this.roomCode) {
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

  // Helper methods for button states
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

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }
}
