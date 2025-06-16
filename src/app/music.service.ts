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
  // Add autoplay blocked state
  private autoplayBlockedSubject = new BehaviorSubject<boolean>(false);
  public autoplayBlocked$ = this.autoplayBlockedSubject.asObservable();
  
  private pendingSync: any = null; // Store sync data when autoplay is blocked

  constructor(
    private configService: ConfigService,
    private socketService: SocketService,
    private roomStateService: RoomStateService
  ) {
    this.audioPlayer = new Audio();
    this.audioPlayer.volume = 1.0; // Set default volume to 100%
    this.setupAudioListeners();
  }  syncWithState(syncData: MusicSyncData): void {
    const {isPlaying, currentTime, metadata, queue, currentTrackIndex, serverTimestamp, lastUpdated} = syncData;

    // Calculate time with server timestamp for better sync accuracy, but be less aggressive
    const referenceTime = serverTimestamp || lastUpdated || Date.now();
    const clientTime = Date.now();
    const networkDelay = clientTime - referenceTime;
    
    // Only adjust time if the network delay is reasonable (less than 10 seconds to avoid stale data)
    let adjustedCurrentTime = currentTime;
    if (isPlaying && networkDelay > 0 && networkDelay < 10000) {
      adjustedCurrentTime = Math.max(0, currentTime + (networkDelay / 1000));
    }

    // Get current track from queue if available
    let currentTrack: QueueItem | null = null;
    if (queue && currentTrackIndex !== undefined && currentTrackIndex >= 0 && queue.length > currentTrackIndex) {
      const queueTrack = queue[currentTrackIndex];

      // Convert to QueueItem format
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
    }    // Only handle audio if we have a current track with audio file
    if (currentTrack && currentTrack.mp3Url) {
      // Update the current track BehaviorSubject
      this.currentTrack.next(currentTrack);
      
      const fullMp3Url = this.configService.getDownloadUrl(currentTrack.mp3Url);
      const isNewTrack = this.audioPlayer.src !== fullMp3Url;
      
      // Check if we need to resync due to large offset (more than 8 seconds)
      const currentAudioTime = this.audioPlayer.currentTime;
      const timeDifference = Math.abs(currentAudioTime - adjustedCurrentTime);
      const needsResync = !isNewTrack && timeDifference > 8 && this.audioPlayer.readyState >= 3;
      
      // Store the sync data in case we need it for autoplay recovery
      this.pendingSync = {
        isPlaying,
        adjustedCurrentTime,
        currentTrack,
        queue,
        currentTrackIndex
      };      if (isNewTrack) {
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

        this.audioPlayer.addEventListener('canplay', handleCanPlay);        // Fallback timeout
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
              this.audioPlayer.addEventListener('canplay', waitForReady, { once: true });
            }
          }
        }, 500);      } else if (needsResync) {
        // Force resync if offset is more than 8 seconds
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
          // Handle any synchronous errors
        }
      } else {
        // Normal sync - only update time if playing state changes or small time adjustments needed
        try {
          // Only adjust time if the difference is significant but less than 8 seconds
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
          // Handle any synchronous errors
        }
      }
    } else {
      // No current track means no audio, pause and clear
      if (!this.audioPlayer.paused) {
        this.audioPlayer.pause();
      }
      this.currentTrack.next(null);
    }
  }
  private handleAutoplayBlocked() {
    this.autoplayBlockedSubject.next(true);
  }

  private clearAutoplayBlocked() {
    if (this.autoplayBlockedSubject.value) {
      this.autoplayBlockedSubject.next(false);
    }
  }
  // Method to resume playback after user interaction
  async resumePlayback(): Promise<boolean> {
    if (!this.pendingSync) {
      return false;
    }

    try {
      const { isPlaying, adjustedCurrentTime } = this.pendingSync;
      
      if (isPlaying) {
        this.audioPlayer.currentTime = adjustedCurrentTime;
        await this.audioPlayer.play();
        this.clearAutoplayBlocked();
        return true;
      }
    } catch (error) {
      // Failed to resume playback
    }
    
    return false;
  }

  // Get current track
  getCurrentTrack(): Observable<QueueItem | null> {
    return this.currentTrack.asObservable();
  }

  // Get current playback state
  getPlaybackState(): Observable<{ isPlaying: boolean, currentTime: number }> {
    return this.playbackState.asObservable();
  }

  // Set volume (local only)
  setVolume(volume: number): void {
    this.audioPlayer.volume = Math.max(0, Math.min(1, volume));
  }

  // Get current volume
  getVolume(): number {
    return this.audioPlayer.volume;
  }

  // Get duration
  getDuration(): number {
    return this.audioPlayer.duration || 0;
  }

  // Cleanup
  destroy(): void {
    this.audioPlayer.pause();
    this.audioPlayer.removeAttribute('src');
    this.currentTrack.complete();
    this.playbackState.complete();
  }  // Force sync request (useful for debugging or manual sync)
  requestSync(): void {
    const roomCode = this.roomStateService.getRoomCode();
    if (roomCode) {
      this.socketService.requestSync(roomCode);
    }
  }

  // Force reload audio player (useful when sync fails)
  forceReloadAudio(): void {
    console.log('🎵 Force reloading audio player');
    const currentSrc = this.audioPlayer.src;
    const currentTime = this.audioPlayer.currentTime;
    const wasPaused = this.audioPlayer.paused;
    
    this.audioPlayer.load(); // Force reload
    
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

  // Check if audio is ready to play
  isAudioReady(): boolean {
    return this.audioPlayer.readyState >= 3; // HAVE_FUTURE_DATA or higher
  }

  private setupAudioListeners(): void {
    // Throttle timeupdate events to improve performance
    let lastTimeUpdate = 0;
    this.audioPlayer.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - lastTimeUpdate > 100) { // Throttle to 10 updates per second
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
      // Ensure duration is updated when metadata loads
      this.playbackState.next({
        isPlaying: !this.audioPlayer.paused,
        currentTime: this.audioPlayer.currentTime
      });
    });

    this.audioPlayer.addEventListener('seeked', () => {
      // Update state after seeking
      this.playbackState.next({
        isPlaying: !this.audioPlayer.paused,
        currentTime: this.audioPlayer.currentTime
      });
    });
  }
}
