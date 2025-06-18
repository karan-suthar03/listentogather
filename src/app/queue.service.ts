import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Observable} from 'rxjs';
import {SocketService} from './socket.service';
import {ConfigService} from './config.service';

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
  private queueSubject = new BehaviorSubject<QueueData>({queue: [], currentTrackIndex: -1});

  public queue$ = this.queueSubject.asObservable();

  constructor(
    private http: HttpClient,
    private socketService: SocketService,
    private configService: ConfigService
  ) {
    this.setupSocketListeners();
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
  }

  updateQueue(queueData: QueueData): void {
    if (queueData.queue && Array.isArray(queueData.queue)) {
      if (queueData.currentTrackIndex < 0 && queueData.queue.length > 0) {
        const currentQueue = this.queueSubject.value;
        if (currentQueue.currentTrackIndex >= 0 &&
          currentQueue.currentTrackIndex < queueData.queue.length) {
          queueData.currentTrackIndex = currentQueue.currentTrackIndex;
        }
      }

      this.queueSubject.next(queueData);
    }
  }

  getCurrentQueue(): QueueData {
    return this.queueSubject.value;
  }
  private setupSocketListeners(): void {
    console.log('🔧 Setting up queue service socket listeners');

    this.socketService.onQueueUpdated().subscribe((data) => {
      console.log('📡 Received queueUpdated:', data);
      this.updateQueue({
        queue: data.queue,
        currentTrackIndex: data.currentTrackIndex
      });
    });
    this.socketService.onMusicState().subscribe((syncData) => {
      console.log('🎵 Queue service received music state:', syncData);
      if (syncData.queue && syncData.currentTrackIndex !== undefined) {
        const mappedQueue = syncData.queue.map(item => ({
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
        }));

        console.log('🎵 Mapped queue items:', mappedQueue.map(item => ({
          id: item.id,
          title: item.title,
          downloadStatus: item.downloadStatus,
          downloadProgress: item.downloadProgress
        })));

        this.updateQueue({
          queue: mappedQueue,
          currentTrackIndex: syncData.currentTrackIndex
        });
      }
    });
    this.socketService.onQueueItemProgress().subscribe((data) => {
      console.log('📡 Received queueItemProgress in queue service:', data);
      this.updateQueueItemProgress(data.queueItemId, data.progress, data.status);
    });

    this.socketService.onQueueItemComplete().subscribe((data) => {
      console.log('📡 Received queueItemComplete in queue service:', data);
      this.updateQueueItemComplete(data.queueItemId, data.mp3Url, data.status);
    });

    this.socketService.onQueueItemError().subscribe((data) => {
      console.log('📡 Received queueItemError in queue service:', data);
      this.updateQueueItemError(data.queueItemId, data.error, data.status);
    });
  }  private updateQueueItemProgress(queueItemId: string, progress: number, status: string): void {
    console.log(`🔄 Updating queue item progress: ${queueItemId} - ${progress}% - ${status}`);
    const currentQueue = this.queueSubject.value;
    const queueItem = currentQueue.queue.find(item => item.id === queueItemId);

    if (queueItem) {
      console.log(`✅ Found queue item to update:`, queueItem.title);
      console.log(`📊 Before update: status=${queueItem.downloadStatus}, progress=${queueItem.downloadProgress}`);

      queueItem.downloadProgress = progress;
      queueItem.downloadStatus = status as any;

      console.log(`📊 After update: status=${queueItem.downloadStatus}, progress=${queueItem.downloadProgress}`);

      const updatedQueue = {
        ...currentQueue,
        queue: [...currentQueue.queue]
      };

      console.log(`🔄 Emitting updated queue with ${updatedQueue.queue.length} items`);
      this.queueSubject.next(updatedQueue);
    } else {
      console.log(`❌ Queue item not found: ${queueItemId}`);
      console.log('Available queue items:', currentQueue.queue.map(item => ({id: item.id, title: item.title})));
    }
  }
  private updateQueueItemComplete(queueItemId: string, mp3Url: string, status: string): void {
    console.log(`✅ Updating queue item complete: ${queueItemId} - ${status}`);
    const currentQueue = this.queueSubject.value;
    const queueItem = currentQueue.queue.find(item => item.id === queueItemId);

    if (queueItem) {
      console.log(`✅ Found queue item to complete:`, queueItem.title);
      queueItem.mp3Url = mp3Url;
      queueItem.downloadStatus = status as any;
      queueItem.downloadProgress = 100;
      this.queueSubject.next({...currentQueue});
    }
  }

  private updateQueueItemError(queueItemId: string, error: string, status: string): void {
    const currentQueue = this.queueSubject.value;
    const queueItem = currentQueue.queue.find(item => item.id === queueItemId);

    if (queueItem) {
      queueItem.downloadStatus = status as any;
      queueItem.downloadProgress = 0;
      this.queueSubject.next({...currentQueue});
    }
  }
}
