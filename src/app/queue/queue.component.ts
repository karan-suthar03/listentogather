import {Component, EventEmitter, Input, OnInit, OnChanges, Output} from '@angular/core';
import {QueueItem} from '../queue.service';

@Component({
  selector: 'app-queue',
  templateUrl: './queue.component.html',
  styleUrls: ['./queue.component.css']
})
export class QueueComponent implements OnInit, OnChanges {
  @Input() queue: QueueItem[] = [];
  @Input() currentlyPlayingId?: number | string;
  @Input() isMobile: boolean = false;
  @Input() onAddToQueue?: () => void;
  @Output() removeFromQueue = new EventEmitter<number | string>();
  @Output() playNext = new EventEmitter<QueueItem>();

  actionStates: { [key: string]: string } = {};

  ngOnInit() {
    console.log('🎵 Queue component initialized with items:', this.queue.map(item => ({
      id: item.id,
      title: item.title,
      downloadStatus: item.downloadStatus,
      downloadProgress: item.downloadProgress
    })));
  }

  ngOnChanges() {
    console.log('🔄 Queue component data changed:', this.queue.map(item => ({
      id: item.id,
      title: item.title,
      downloadStatus: item.downloadStatus,
      downloadProgress: item.downloadProgress
    })));
  }

  trackByQueueId(index: number, item: QueueItem): string | number {
    return item.id;
  }

  isCurrentlyPlaying(item: QueueItem): boolean {
    if (this.currentlyPlayingId === undefined) return false;
    const itemIdNum = typeof item.id === 'string' ? parseInt(item.id) : item.id;
    const currentIdNum = typeof this.currentlyPlayingId === 'string' ? parseInt(this.currentlyPlayingId) : this.currentlyPlayingId;
    return itemIdNum === currentIdNum;
  }

  onImageError(event: any) {
    event.target.style.display = 'none';
    const fallbackDiv = event.target.nextElementSibling;
    if (fallbackDiv) {
      fallbackDiv.style.display = 'flex';
    }
  }

  getStringId(id: string | number): string {
    return String(id);
  }

  getMathRound(value: number): number {
    return Math.round(value);
  }

  playTrack(item: QueueItem, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.handleAction(item.id, 'play', () => this.onPlayNext(item));
  }

  removeTrack(id: string | number, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.handleAction(id, 'remove', () => this.onRemoveFromQueue(id));
  }

  handleAction(itemId: number | string, action: string, callback: () => void) {
    this.actionStates[String(itemId)] = action;
    callback();

    // Reset state after a short delay
    setTimeout(() => {
      delete this.actionStates[String(itemId)];
    }, 1000);
  }

  onPlayNext(item: QueueItem) {
    this.playNext.emit(item);
  }

  onRemoveFromQueue(id: number | string) {
    this.removeFromQueue.emit(id);
  }

  handleAddToQueue() {
    if (this.onAddToQueue) {
      this.onAddToQueue();
    }
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  getDownloadStatusText(item: QueueItem): string {
    if (!item.downloadProgress) {
      return 'Preparing...';
    }

    const progress = Math.round(item.downloadProgress);
    if (progress <= 50) {
      return `Downloading ${progress}%`;
    } else {
      return `Uploading ${progress}%`;
    }
  }

  getDownloadIcon(item: QueueItem): string {
    if (!item.downloadProgress) {
      return 'clock';
    }

    const progress = Math.round(item.downloadProgress);
    if (progress <= 50) {
      return 'download';
    } else {
      return 'upload';
    }
  }
}
