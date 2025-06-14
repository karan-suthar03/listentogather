import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { SocketService } from './socket.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ConfigService } from './config.service';

export interface QueueItem {
  id: string;
  title: string;
  artist: string;
  duration: number;
  coverUrl: string;
  mp3Url: string;
  youtubeUrl?: string;
  videoId?: string;
  spotifyUrl?: string;
  spotifyTitle?: string;
  spotifyArtist?: string;
  source?: 'youtube' | 'spotify' | 'direct';
  downloadStatus?: 'pending' | 'downloading' | 'completed' | 'error';
  downloadProgress?: number;
  addedBy: string;
  addedAt: Date;
}

export interface QueueData {
  queue: QueueItem[];
  currentTrackIndex: number;
}

@Injectable({
  providedIn: 'root'
})
export class QueueService {
  private queueSubject = new BehaviorSubject<QueueData>({ queue: [], currentTrackIndex: -1 });
  
  public queue$ = this.queueSubject.asObservable();

  constructor(
    private http: HttpClient,
    private socketService: SocketService,
    private configService: ConfigService
  ) {
    this.setupSocketListeners();
  }  private setupSocketListeners(): void {
    // Listen for queue updates from server
    this.socketService.onQueueUpdated().subscribe((data) => {
      this.updateQueue({
        queue: data.queue,
        currentTrackIndex: data.currentTrackIndex
      });
    });

    // Listen for music state updates to get current track index
    this.socketService.onMusicState().subscribe((syncData) => {
      if (syncData.queue && syncData.currentTrackIndex !== undefined) {        this.updateQueue({
          queue: syncData.queue.map(item => ({
            id: item.id,
            title: item.title,
            artist: item.artist,
            duration: item.duration,
            addedBy: item.addedBy,
            addedAt: item.addedAt,
            coverUrl: (item as any).coverUrl || '',
            mp3Url: (item as any).mp3Url || '',
            youtubeUrl: (item as any).youtubeUrl || '',
            videoId: (item as any).videoId || '',
            spotifyUrl: (item as any).spotifyUrl || '',
            spotifyTitle: (item as any).spotifyTitle || '',
            spotifyArtist: (item as any).spotifyArtist || '',
            source: (item as any).source || 'direct',
            downloadStatus: (item as any).downloadStatus || 'completed',
            downloadProgress: (item as any).downloadProgress || 100
          })),
          currentTrackIndex: syncData.currentTrackIndex
        });
      }
    });// Listen for queue item progress updates
    this.socketService.onQueueItemProgress().subscribe((data) => {
      this.updateQueueItemProgress(data.queueItemId, data.progress, data.status);
    });

    // Listen for queue item completion
    this.socketService.onQueueItemComplete().subscribe((data) => {
      this.updateQueueItemComplete(data.queueItemId, data.mp3Url, data.status);
    });

    // Listen for queue item errors
    this.socketService.onQueueItemError().subscribe((data) => {
      this.updateQueueItemError(data.queueItemId, data.error, data.status);
    });
  }  private updateQueueItemProgress(queueItemId: string, progress: number, status: string): void {
    const currentQueue = this.queueSubject.value;
    const queueItem = currentQueue.queue.find(item => item.id === queueItemId);
    
    if (queueItem) {
      queueItem.downloadProgress = progress;
      queueItem.downloadStatus = status as any;
      this.queueSubject.next({ ...currentQueue });
    }
  }

  private updateQueueItemComplete(queueItemId: string, mp3Url: string, status: string): void {
    const currentQueue = this.queueSubject.value;
    const queueItem = currentQueue.queue.find(item => item.id === queueItemId);
    
    if (queueItem) {
      queueItem.mp3Url = mp3Url;
      queueItem.downloadStatus = status as any;
      queueItem.downloadProgress = 100;
      this.queueSubject.next({ ...currentQueue });
    }
  }

  private updateQueueItemError(queueItemId: string, error: string, status: string): void {
    const currentQueue = this.queueSubject.value;
    const queueItem = currentQueue.queue.find(item => item.id === queueItemId);
    
    if (queueItem) {
      queueItem.downloadStatus = status as any;
      queueItem.downloadProgress = 0;
      this.queueSubject.next({ ...currentQueue });
    }
  }
  getQueue(roomCode: string): Observable<QueueData> {
    return this.http.get<QueueData>(`${this.configService.queueApiUrl}/${roomCode}`);
  }
  
  addToQueue(roomCode: string, songData: any, addedBy: string): Observable<any> {
    return this.http.post(`${this.configService.queueApiUrl}/${roomCode}/add`, {
      songData,
      addedBy
    });
  }

  removeFromQueue(roomCode: string, index: number): Observable<any> {
    return this.http.delete(`${this.configService.queueApiUrl}/${roomCode}/${index}`);
  }

  moveQueueItem(roomCode: string, fromIndex: number, toIndex: number): Observable<any> {
    return this.http.put(`${this.configService.queueApiUrl}/${roomCode}/move`, {
      fromIndex,
      toIndex
    });
  }updateQueue(queueData: QueueData): void {
    // Validate the queue data before updating
    if (queueData.queue && Array.isArray(queueData.queue)) {
      // If currentTrackIndex is invalid but queue has items, try to preserve a valid index
      if (queueData.currentTrackIndex < 0 && queueData.queue.length > 0) {
        const currentQueue = this.queueSubject.value;
        // If we had a valid track before and it still exists, try to maintain it
        if (currentQueue.currentTrackIndex >= 0 && 
            currentQueue.currentTrackIndex < queueData.queue.length) {
          queueData.currentTrackIndex = currentQueue.currentTrackIndex;
        }
      }
      
      this.queueSubject.next(queueData);
    }
  }

  // Get current queue state
  getCurrentQueue(): QueueData {
    return this.queueSubject.value;
  }
}
