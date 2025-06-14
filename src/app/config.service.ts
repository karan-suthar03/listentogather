import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  get apiUrl(): string {
    return this._manualUrl || environment.apiUrl;
  }
  
  get roomsApiUrl(): string {
    return `${this.apiUrl}/api/rooms`;
  }
  
  get queueApiUrl(): string {
    return `${this.apiUrl}/api/queue`;
  }
  
  get musicApiUrl(): string {
    return `${this.apiUrl}/api/music`;
  }
  
  get socketUrl(): string {
    return this.apiUrl;
  }
    getDownloadUrl(path: string): string {
    // If the path is already a complete URL (Supabase URL), return it as-is
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    // Otherwise, prepend the API URL for local files
    return `${this.apiUrl}${path}`;
  }
  
  private _manualUrl: string | null = null;
  
  setManualUrl(url: string): void {
    this._manualUrl = url;
  }
    clearManualUrl(): void {
    this._manualUrl = null;
  }
}
