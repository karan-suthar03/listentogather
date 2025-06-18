import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {MusicSyncData} from './models/room.model';
import {QueueItem} from './queue.service';
import {ConfigService} from './config.service';
import {SocketService} from './socket.service';
import {RoomStateService} from './room-state.service';

@Injectable({
  providedIn: 'root'
})
export class MusicService {
  private audioPlayer: HTMLAudioElement;
  private currentTrack = new BehaviorSubject<QueueItem | null>(null);
  private playbackState = new BehaviorSubject<{ isPlaying: boolean, currentTime: number }>({
    isPlaying: false,
    currentTime: 0
  });
  private autoplayBlockedSubject = new BehaviorSubject<boolean>(false);
  public autoplayBlocked$ = this.autoplayBlockedSubject.asObservable();

  private pendingSync: any = null;

  constructor(
    private configService: ConfigService,
    private socketService: SocketService,
    private roomStateService: RoomStateService
  ) {
    this.audioPlayer = new Audio();
    this.audioPlayer.volume = 1.0;
    this.setupAudioListeners();
  }

  syncWithState(syncData: MusicSyncData): void {
    const {isPlaying, currentTime, metadata, queue, currentTrackIndex, serverTimestamp, lastUpdated} = syncData;

    const referenceTime = serverTimestamp || lastUpdated || Date.now();
    const clientTime = Date.now();
    const networkDelay = clientTime - referenceTime;

    let adjustedCurrentTime = currentTime;
    if (isPlaying && networkDelay > 0 && networkDelay < 10000) {
      adjustedCurrentTime = Math.max(0, currentTime + (networkDelay / 1000));
    }

    let currentTrack: QueueItem | null = null;
    if (queue && currentTrackIndex !== undefined && currentTrackIndex >= 0 && queue.length > currentTrackIndex) {
      const queueTrack = queue[currentTrackIndex];

      currentTrack = {
        id: queueTrack.id,
        title: queueTrack.title,
        artist: queueTrack.artist,
        duration: queueTrack.duration,
        addedBy: queueTrack.addedBy || 'Unknown User',
        addedAt: queueTrack.addedAt,
        coverUrl: (queueTrack as any).coverUrl || '',
        mp3Url: (queueTrack as any).mp3Url || '',
        youtubeUrl: (queueTrack as any).youtubeUrl || queueTrack.url,
        videoId: (queueTrack as any).videoId || '',
        downloadStatus: (queueTrack as any).downloadStatus || 'completed',
        downloadProgress: (queueTrack as any).downloadProgress || 100
      };
    }
    if (currentTrack && currentTrack.mp3Url) {
      this.currentTrack.next(currentTrack);

      const fullMp3Url = this.configService.getDownloadUrl(currentTrack.mp3Url);
      const isNewTrack = this.audioPlayer.src !== fullMp3Url;

      const currentAudioTime = this.audioPlayer.currentTime;
      const timeDifference = Math.abs(currentAudioTime - adjustedCurrentTime);
      const needsResync = !isNewTrack && timeDifference > 8 && this.audioPlayer.readyState >= 3;

      this.pendingSync = {
        isPlaying,
        adjustedCurrentTime,
        currentTrack,
        queue,
        currentTrackIndex
      };
      if (isNewTrack) {
        this.audioPlayer.src = fullMp3Url;
        this.audioPlayer.load();

        const handleCanPlay = async () => {
          this.audioPlayer.removeEventListener('canplay', handleCanPlay);
          try {
            this.audioPlayer.currentTime = adjustedCurrentTime;

            if (isPlaying) {
              await this.audioPlayer.play();
              this.clearAutoplayBlocked();
            } else {
              this.audioPlayer.pause();
            }
          } catch (error) {
            this.handleAutoplayBlocked();
          }
        };

        this.audioPlayer.addEventListener('canplay', handleCanPlay);
        setTimeout(() => {
          if (this.audioPlayer.readyState < 3) {
            const waitForReady = async () => {
              try {
                this.audioPlayer.currentTime = adjustedCurrentTime;
                if (isPlaying) {
                  await this.audioPlayer.play();
                  this.clearAutoplayBlocked();
                }
              } catch (error) {
                this.handleAutoplayBlocked();
              }
            };

            if (this.audioPlayer.readyState >= 3) {
              waitForReady();
            } else {
              this.audioPlayer.addEventListener('canplay', waitForReady, {once: true});
            }
          }
        }, 500);
      } else if (needsResync) {
        this.requestSync();

        try {
          this.audioPlayer.currentTime = adjustedCurrentTime;

          if (isPlaying && this.audioPlayer.paused) {
            this.audioPlayer.play().then(() => {
              this.clearAutoplayBlocked();
            }).catch(error => {
              this.handleAutoplayBlocked();
            });
          } else if (!isPlaying && !this.audioPlayer.paused) {
            this.audioPlayer.pause();
          }
        } catch (error) {
        }
      } else {
        try {
          if (timeDifference > 1) {
            this.audioPlayer.currentTime = adjustedCurrentTime;
          }

          if (isPlaying && this.audioPlayer.paused) {
            this.audioPlayer.play().then(() => {
              this.clearAutoplayBlocked();
            }).catch(error => {
              this.handleAutoplayBlocked();
            });
          } else if (!isPlaying && !this.audioPlayer.paused) {
            this.audioPlayer.pause();
          }
        } catch (error) {
        }
      }
    } else {
      if (!this.audioPlayer.paused) {
        this.audioPlayer.pause();
      }
      this.currentTrack.next(null);
    }
  }

  async resumePlayback(): Promise<boolean> {
    if (!this.pendingSync) {
      return false;
    }

    try {
      const {isPlaying, adjustedCurrentTime} = this.pendingSync;

      if (isPlaying) {
        this.audioPlayer.currentTime = adjustedCurrentTime;
        await this.audioPlayer.play();
        this.clearAutoplayBlocked();
        return true;
      }
    } catch (error) {
    }

    return false;
  }

  getCurrentTrack(): Observable<QueueItem | null> {
    return this.currentTrack.asObservable();
  }

  getPlaybackState(): Observable<{ isPlaying: boolean, currentTime: number }> {
    return this.playbackState.asObservable();
  }

  setVolume(volume: number): void {
    this.audioPlayer.volume = Math.max(0, Math.min(1, volume));
  }

  getVolume(): number {
    return this.audioPlayer.volume;
  }

  getDuration(): number {
    return this.audioPlayer.duration || 0;
  }

  seekTo(time: number): void {
    if (this.audioPlayer.duration && time >= 0 && time <= this.audioPlayer.duration) {
      this.audioPlayer.currentTime = time;
    }
  }

  play(): Promise<void> {
    return this.audioPlayer.play();
  }

  pause(): void {
    this.audioPlayer.pause();
  }

  togglePlay(): Promise<void> {
    if (this.audioPlayer.paused) {
      return this.play();
    } else {
      this.pause();
      return Promise.resolve();
    }
  }

  destroy(): void {
    this.audioPlayer.pause();
    this.audioPlayer.removeAttribute('src');
    this.currentTrack.complete();
    this.playbackState.complete();
  }

  requestSync(): void {
    const roomCode = this.roomStateService.getRoomCode();
    if (roomCode) {
      this.socketService.requestSync(roomCode);
    }
  }

  forceReloadAudio(): void {
    console.log('🎵 Force reloading audio player');
    const currentSrc = this.audioPlayer.src;
    const currentTime = this.audioPlayer.currentTime;
    const wasPaused = this.audioPlayer.paused;

    this.audioPlayer.load();

    const handleCanPlay = () => {
      this.audioPlayer.currentTime = currentTime;
      if (!wasPaused) {
        this.audioPlayer.play().catch(error => {
          console.error('Error resuming after force reload:', error);
        });
      }
      this.audioPlayer.removeEventListener('canplay', handleCanPlay);
    };

    this.audioPlayer.addEventListener('canplay', handleCanPlay);
  }

  isAudioReady(): boolean {
    return this.audioPlayer.readyState >= 3;
  }

  private handleAutoplayBlocked() {
    this.autoplayBlockedSubject.next(true);
  }

  private clearAutoplayBlocked() {
    if (this.autoplayBlockedSubject.value) {
      this.autoplayBlockedSubject.next(false);
    }
  }

  private setupAudioListeners(): void {
    let lastTimeUpdate = 0;
    this.audioPlayer.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - lastTimeUpdate > 100) {
        this.playbackState.next({
          isPlaying: !this.audioPlayer.paused,
          currentTime: this.audioPlayer.currentTime
        });
        lastTimeUpdate = now;
      }
    });

    this.audioPlayer.addEventListener('play', () => {
      this.playbackState.next({
        isPlaying: true,
        currentTime: this.audioPlayer.currentTime
      });
    });

    this.audioPlayer.addEventListener('pause', () => {
      this.playbackState.next({
        isPlaying: false,
        currentTime: this.audioPlayer.currentTime
      });
    });

    this.audioPlayer.addEventListener('loadedmetadata', () => {
      this.playbackState.next({
        isPlaying: !this.audioPlayer.paused,
        currentTime: this.audioPlayer.currentTime
      });
    });

    this.audioPlayer.addEventListener('seeked', () => {
      this.playbackState.next({
        isPlaying: !this.audioPlayer.paused,
        currentTime: this.audioPlayer.currentTime
      });
    });
  }
}
