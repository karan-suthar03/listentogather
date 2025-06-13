import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MusicMetadata, MusicSyncData } from './models/room.model';

@Injectable({
  providedIn: 'root'
})
export class MusicService {
  private audioPlayer: HTMLAudioElement;
  private currentMetadata = new BehaviorSubject<MusicMetadata | null>(null);
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
  }

  // Sync with server state
  syncWithState(syncData: MusicSyncData): void {
    const { isPlaying, currentTime, metadata } = syncData;
    
    // Set audio source if different
    const fullMp3Url = `http://localhost:3000${metadata.mp3Url}`;
    if (this.audioPlayer.src !== fullMp3Url) {
      this.audioPlayer.src = fullMp3Url;
      this.currentMetadata.next(metadata);
    }
    
    // Sync playback position (with small tolerance for network lag)
    const timeDiff = Math.abs(this.audioPlayer.currentTime - currentTime);
    if (timeDiff > 1) { // Only sync if difference is more than 1 second
      this.audioPlayer.currentTime = currentTime;
    }
    
    // Sync play/pause state
    if (isPlaying && this.audioPlayer.paused) {
      this.audioPlayer.play().catch(console.error);
    } else if (!isPlaying && !this.audioPlayer.paused) {
      this.audioPlayer.pause();
    }
  }

  // Get current metadata
  getCurrentMetadata(): Observable<MusicMetadata | null> {
    return this.currentMetadata.asObservable();
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
    this.currentMetadata.complete();
    this.playbackState.complete();
  }
}
