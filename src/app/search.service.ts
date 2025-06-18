import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  description: string;
  duration: {
    seconds: number;
    timestamp: string;
  };
  thumbnail: string;
  views: number;
  author: {
    name: string;
    url: string;
  };
  ago: string;
  url: string;
}

export interface SearchResponse {
  success: boolean;
  data: {
    query: string;
    results: YouTubeSearchResult[];
    total: number;
  };
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private apiUrl: string;
  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = this.configService.apiUrl;
  }

  searchYouTube(query: string, limit: number = 10): Observable<SearchResponse> {
    const params = new HttpParams()
      .set('q', query)
      .set('limit', limit.toString());

    return this.http.get<SearchResponse>(`${this.apiUrl}/search/youtube`, { params });
  }
}
