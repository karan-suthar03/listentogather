import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MusicService } from '../music.service';
import { SocketService } from '../socket.service';
import { RoomStateService } from '../room-state.service';
import { User, MusicMetadata } from '../models/room.model';

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

  currentMetadata: MusicMetadata | null = null;
  isPlaying: boolean = false;
  currentTime: number = 0;
  duration: number = 0;
  volume: number = 0.5;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private musicService: MusicService,
    private socketService: SocketService,
    private roomStateService: RoomStateService
  ) {}

  ngOnInit(): void {
    this.setupRoomStateListeners();
    this.setupMusicListeners();
    
    // Request initial music metadata
    this.socketService.getMusicMeta();
  }

  private setupRoomStateListeners(): void {
    // Listen to room state changes
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
    // Listen to music service state
    const metadataSub = this.musicService.getCurrentMetadata().subscribe(metadata => {
      this.currentMetadata = metadata;
      this.duration = metadata?.duration || 0;
    });
    this.subscriptions.push(metadataSub);

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

    const musicMetaSub = this.socketService.onMusicMeta().subscribe(metadata => {
      this.currentMetadata = metadata;
      this.duration = metadata.duration;
    });
    this.subscriptions.push(musicMetaSub);

    const errorSub = this.socketService.onError().subscribe(error => {
      console.error('Music control error:', error.message);
      alert(error.message);
    });
    this.subscriptions.push(errorSub);
  }

  // Host control methods
  togglePlay(): void {
    if (!this.isHost || !this.currentUser || !this.roomCode) {
      return;
    }

    if (this.isPlaying) {
      this.socketService.hostPause(this.roomCode, this.currentUser.id);
    } else {
      this.socketService.hostPlay(this.roomCode, this.currentUser.id);
    }
  }

  onSeek(event: any): void {
    if (!this.isHost || !this.currentUser || !this.roomCode) {
      return;
    }

    const seekTime = parseFloat(event.target.value);
    this.socketService.hostSeek(this.roomCode, this.currentUser.id, seekTime);
  }

  onVolumeChange(event: any): void {
    const volume = parseFloat(event.target.value) / 100;
    this.volume = volume;
    this.musicService.setVolume(volume);
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
