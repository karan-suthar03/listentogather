import {Component, OnDestroy, OnInit} from '@angular/core';
import {QueueItem, QueueService} from '../queue.service';
import {MusicService} from '../music.service';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-music-details',
  templateUrl: './music-details.component.html',
  styleUrls: ['./music-details.component.css']
})
export class MusicDetailsComponent implements OnInit, OnDestroy {
  currentTrack: QueueItem | null = null;
  private subscriptions: Subscription[] = [];
  private lastValidTrack: QueueItem | null = null;

  constructor(
    private queueService: QueueService,
    private musicService: MusicService
  ) {
  }

  ngOnInit(): void {
    this.subscriptions.push(
      this.musicService.getCurrentTrack().subscribe(track => {
        if (track) {
          this.currentTrack = track;
          this.lastValidTrack = track;
        }
      })
    );

    this.subscriptions.push(
      this.queueService.queue$.subscribe(queueData => {
        if (queueData.currentTrackIndex >= 0 && queueData.queue.length > queueData.currentTrackIndex) {
          const newTrack = queueData.queue[queueData.currentTrackIndex];
          if (!this.currentTrack || this.currentTrack.id !== newTrack.id) {
            this.currentTrack = newTrack;
            this.lastValidTrack = newTrack;
          }
        } else if (queueData.queue.length === 0) {
          this.currentTrack = null;
          this.lastValidTrack = null;
        } else {
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
