import {Component, OnDestroy, OnInit} from '@angular/core';
import {debounceTime, distinctUntilChanged, Subject, Subscription} from 'rxjs';
import {QueueService} from '../queue.service';
import {MusicService} from '../music.service';
import {HttpClient} from '@angular/common/http';
import {ConfigService} from '../config.service';
import {RoomStateService} from '../room-state.service';

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
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
    private roomStateService: RoomStateService
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
      const addedBy = currentUser?.name || 'You';

      await this.queueService.addToQueue(roomCode, {
        id: result.id,
        title: result.title,
        artist: result.artist,
        duration: this.parseDurationToSeconds(result.duration),
        url: result.url || '',
        videoId: result.videoId || '',
        spotifyId: result.spotifyId || '',
        thumbnail: result.thumbnail
      }, addedBy).toPromise();

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
  }

  private async performSearch(query: string): Promise<void> {
    this.isSearching = true;

    try {
      let searchResults: SearchResult[] = [];

      if (this.inputType === 'spotify') {
        searchResults = await this.searchSpotify(query);
      } else if (this.inputType === 'youtube') {
        searchResults = await this.searchYoutube(query);
      } else {
        searchResults = await this.searchGeneral(query);
      }

      this.results = searchResults;
    } catch (error) {
      console.error('Search error:', error);
      this.results = [];
    } finally {
      this.isSearching = false;
    }
  }

  private async searchSpotify(url: string): Promise<SearchResult[]> {
    const response = await this.http.post<any>(`${this.configService.apiUrl}/api/music/search/spotify`, {url}).toPromise();
    return this.mapToSearchResults(response.tracks || [response], 'spotify');
  }

  private async searchYoutube(url: string): Promise<SearchResult[]> {
    const response = await this.http.post<any>(`${this.configService.apiUrl}/api/music/search/youtube`, {url}).toPromise();
    return this.mapToSearchResults([response], 'youtube');
  }

  private async searchGeneral(query: string): Promise<SearchResult[]> {
    const response = await this.http.post<any>(`${this.configService.apiUrl}/api/music/search`, {query}).toPromise();
    return this.mapToSearchResults(response.results || [], 'search');
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
}
