import {Component, OnDestroy, OnInit} from '@angular/core';
import {debounceTime, distinctUntilChanged, Subject, Subscription} from 'rxjs';
import {QueueService} from '../queue.service';
import {MusicService} from '../music.service';
import {HttpClient} from '@angular/common/http';
import {ConfigService} from '../config.service';
import {RoomStateService} from '../room-state.service';
import {ActivatedRoute} from '@angular/router';

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string | { seconds: number; timestamp: string };
  thumbnail?: string;
  url?: string;
  videoId?: string;
  spotifyId?: string;
}

@Component({
  selector: 'app-music-search',
  templateUrl: './music-search.component.html',
  styleUrls: ['./music-search.component.css']
})
export class MusicSearchComponent implements OnInit, OnDestroy {
  query = '';
  isFocused = false;
  isSearching = false;
  results: SearchResult[] = [];
  addedSongs = new Set<string>();
  addingSongs = new Set<string>();
  inputType: 'search' | 'spotify' | 'youtube' = 'search';

  private searchSubject = new Subject<string>();
  private subscriptions: Subscription[] = [];

  constructor(
    private queueService: QueueService,
    private musicService: MusicService,
    private http: HttpClient,
    private configService: ConfigService,
    private roomStateService: RoomStateService,
    private route: ActivatedRoute
  ) {
  }

  ngOnInit(): void {
    this.subscriptions.push(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(query => {
        if (query.trim()) {
          this.performSearch(query);
        } else {
          this.results = [];
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onQueryChange(event: any): void {
    this.query = event.target.value;
    this.detectInputType(this.query);

    if (this.query.trim()) {
      this.searchSubject.next(this.query);
    } else {
      this.results = [];
      this.isSearching = false;
    }
  }

  onFocus(): void {
    this.isFocused = true;
  }

  onBlur(): void {
    this.isFocused = false;
  }

  handleSearch(event: Event): void {
    event.preventDefault();
    if (this.query.trim()) {
      this.performSearch(this.query);
    }
  }
  async handleSongAdd(result: SearchResult): Promise<void> {
    if (this.addedSongs.has(result.id) || this.addingSongs.has(result.id)) {
      return;
    }

    this.addingSongs.add(result.id);
    try {
      const roomCode = this.roomStateService.getRoomCode();
      const currentUser = this.roomStateService.getUser();
      const addedBy = currentUser?.name || 'You';      // Always use add-from-search endpoint for YouTube videos since we have all the data
      if (result.videoId) {
        const durationSeconds = typeof result.duration === 'object' && result.duration.seconds 
          ? result.duration.seconds 
          : this.parseDurationToSeconds(result.duration as string);

        const searchResultData = {
          videoId: result.videoId,
          title: result.title,
          author: {
            name: result.artist
          },
          duration: {
            seconds: durationSeconds
          },
          thumbnail: result.thumbnail,
          url: result.url || `https://youtube.com/watch?v=${result.videoId}`
        };

        await this.http.post(`${this.configService.apiUrl}/api/queue/${roomCode}/add-from-search`, {
          searchResult: searchResultData,
          addedBy: addedBy
        }).toPromise();      } else {
        // Fallback for non-YouTube results (Spotify, etc.)
        const durationSeconds = typeof result.duration === 'object' && result.duration.seconds 
          ? result.duration.seconds 
          : this.parseDurationToSeconds(result.duration as string);

        await this.queueService.addToQueue(roomCode, {
          id: result.id,
          title: result.title,
          artist: result.artist,
          duration: durationSeconds,
          url: result.url || '',
          videoId: result.videoId || '',
          spotifyId: result.spotifyId || '',
          thumbnail: result.thumbnail
        }, addedBy).toPromise();
      }

      this.addedSongs.add(result.id);

      setTimeout(() => {
        this.addedSongs.delete(result.id);
      }, 3000);

    } catch (error) {
      console.error('Error adding song to queue:', error);
    } finally {
      this.addingSongs.delete(result.id);
    }
  }

  getPlaceholderText(): string {
    if (this.inputType === 'spotify') {
      return "Spotify link detected!";
    } else if (this.inputType === 'youtube') {
      return "YouTube link detected!";
    } else if (this.isFocused) {
      return "Search songs, paste Spotify/YouTube links...";
    } else {
      return "Search or paste links...";
    }
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.style.display = 'none';
    }
  }

  private detectInputType(query: string): void {
    if (query.includes('spotify.com/')) {
      this.inputType = 'spotify';
    } else if (query.includes('youtube.com/') || query.includes('youtu.be/')) {
      this.inputType = 'youtube';
    } else {
      this.inputType = 'search';
    }
  }  private async performSearch(query: string): Promise<void> {
    this.isSearching = true;

    try {
      let searchResults: SearchResult[] = [];

      // Use the same search endpoint for all searches (YouTube URLs, Spotify URLs, and text queries)
      searchResults = await this.searchGeneral(query);

      this.results = searchResults;
    } catch (error) {
      console.error('Search error:', error);
      this.results = [];
    } finally {
      this.isSearching = false;
    }
  }  private async searchGeneral(query: string): Promise<SearchResult[]> {
    const response = await this.http.get<any>(`${this.configService.apiUrl}/api/search/youtube?q=${encodeURIComponent(query)}&limit=10`).toPromise();
    if (response.success && response.data && response.data.results) {
      return this.mapYouTubeToSearchResults(response.data.results);
    }
    return [];
  }

  private mapToSearchResults(tracks: any[], source: string): SearchResult[] {
    return tracks.map((track: any) => ({
      id: track.id || track.videoId || track.spotifyId || Math.random().toString(36),
      title: track.title || track.name || 'Unknown Title',
      artist: track.artist || track.artists?.[0]?.name || 'Unknown Artist',
      album: track.album || track.album?.name || 'Unknown Album',
      duration: this.formatDuration(track.duration || track.duration_ms || 0),
      thumbnail: track.thumbnail || track.image || track.album?.images?.[0]?.url,
      url: track.url || track.external_urls?.spotify,
      videoId: track.videoId,
      spotifyId: track.spotifyId || track.id
    }));
  }

  private mapYouTubeToSearchResults(videos: any[]): SearchResult[] {
    return videos.map((video: any) => ({
      id: video.videoId,
      title: video.title,
      artist: video.author.name,
      album: '',
      duration: video.duration.timestamp,
      thumbnail: video.thumbnail,
      url: video.url,
      videoId: video.videoId,
      spotifyId: ''
    }));
  }

  private formatDuration(duration: number): string {
    let seconds = duration;
    if (duration > 10000) {
      seconds = Math.floor(duration / 1000);
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  private parseDurationToSeconds(duration: string): number {
    const parts = duration.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return 0;
  }

  private getRoomCode(): string {
    let roomCode = this.roomStateService.getRoomCode();

    if (!roomCode) {
      roomCode = this.route.snapshot.params['roomCode'];
      console.log('🔄 Room code from route params:', roomCode);
    }

    if (!roomCode && this.route.parent) {
      roomCode = this.route.parent.snapshot.params['roomCode'];
      console.log('🔄 Room code from parent route params:', roomCode);
    }

    if (!roomCode) {
      console.error('❌ No room code available in music search component');
    }

    return roomCode || '';
  }
}
