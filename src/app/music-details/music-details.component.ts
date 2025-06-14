import { Component, OnInit, OnDestroy } from '@angular/core';
import { QueueService, QueueItem } from '../queue.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-music-details',
  templateUrl: './music-details.component.html',
  styleUrls: ['./music-details.component.css']
})
export class MusicDetailsComponent implements OnInit, OnDestroy {
  currentTrack: QueueItem | null = null;
  private subscriptions: Subscription[] = [];

  constructor(private queueService: QueueService) { }

  ngOnInit(): void {
    // Subscribe to queue updates to get current track
    this.subscriptions.push(
      this.queueService.queue$.subscribe(queueData => {
        if (queueData.currentTrackIndex >= 0 && queueData.queue.length > queueData.currentTrackIndex) {
          this.currentTrack = queueData.queue[queueData.currentTrackIndex];
        } else {
          this.currentTrack = null;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  onImageError(event: any): void {
    event.target.src = 'https://via.placeholder.com/300x300/e9ecef/6c757d?text=No+Cover';
  }
}
