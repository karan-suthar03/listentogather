import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MusicSyncData } from './models/room.model';
import { QueueItem } from './queue.service';

@Injectable({
  providedIn: 'root'
})
export class MusicService {
  private audioPlayer: HTMLAudioElement;
  private currentTrack = new BehaviorSubject<QueueItem | null>(null);
  private playbackState = new BehaviorSubject<{ isPlaying: boolean, currentTime: number }>({ isPlaying: false, currentTime: 0 });
  
  constructor() {
    this.audioPlayer = new Audio();
    this.setupAudioListeners();
  }

  private setupAudioListeners(): void {
    this.audioPlayer.addEventListener('timeupdate', () => {
      this.playbackState.next({
        isPlaying: !this.audioPlayer.paused,
        currentTime: this.audioPlayer.currentTime
      });
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
  }  syncWithState(syncData: MusicSyncData): void {
    const { isPlaying, currentTime, metadata, queue, currentTrackIndex } = syncData;

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
    }
    
    // Only handle audio if we have a current track with audio file
    if (currentTrack && currentTrack.mp3Url) {
      const fullMp3Url = `http://localhost:3000${currentTrack.mp3Url}`;
      if (this.audioPlayer.src !== fullMp3Url) {
        this.audioPlayer.src = fullMp3Url;
        this.currentTrack.next(currentTrack);
      }
      
      // Sync playback position (with small tolerance for network lag)
      const timeDiff = Math.abs(this.audioPlayer.currentTime - currentTime);
      if (timeDiff > 1) { // Only sync if difference is more than 1 second
        this.audioPlayer.currentTime = currentTime;
      }
      
      // Sync play/pause state
      if (isPlaying && this.audioPlayer.paused) {
        this.audioPlayer.play().catch(error => {
          console.error('Play error:', error);
        });
      } else if (!isPlaying && !this.audioPlayer.paused) {
        this.audioPlayer.pause();
      }
    } else {
      // No current track means no audio, pause and clear
      if (!this.audioPlayer.paused) {
        this.audioPlayer.pause();
      }
      this.currentTrack.next(null);
    }
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
  }
}
