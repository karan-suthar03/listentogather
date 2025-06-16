import {Injectable} from '@angular/core';
import {environment} from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private _manualUrl: string | null = null;

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

  get participantsApiUrl(): string {
    return `${this.apiUrl}/api/participants`;
  }

  get socketUrl(): string {
    return this.apiUrl;
  }

  getDownloadUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `${this.apiUrl}${path}`;
  }

  setManualUrl(url: string): void {
    this._manualUrl = url;
  }

  clearManualUrl(): void {
    this._manualUrl = null;
  }
}
