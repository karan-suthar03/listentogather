import { Component, EventEmitter, Output } from '@angular/core';
import { SearchService, YouTubeSearchResult } from '../search.service';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class SearchComponent {
  @Output() trackSelected = new EventEmitter<YouTubeSearchResult>();
  
  searchQuery: string = '';
  searchResults: YouTubeSearchResult[] = [];
  isSearching: boolean = false;
  searchError: string | null = null;

  constructor(private searchService: SearchService) {}

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      return;
    }

    this.isSearching = true;
    this.searchError = null;

    this.searchService.searchYouTube(this.searchQuery, 10).subscribe({
      next: (response) => {
        if (response.success) {
          this.searchResults = response.data.results;
        } else {
          this.searchError = response.message || 'Search failed';
        }
        this.isSearching = false;
      },
      error: (error) => {
        console.error('Search error:', error);
        this.searchError = 'Failed to search. Please try again.';
        this.isSearching = false;
      }
    });
  }

  onTrackSelect(track: YouTubeSearchResult): void {
    this.trackSelected.emit(track);
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  formatViews(views: number): string {
    if (views >= 1000000) {
      return (views / 1000000).toFixed(1) + 'M';
    } else if (views >= 1000) {
      return (views / 1000).toFixed(1) + 'K';
    }
    return views.toString();
  }
}
