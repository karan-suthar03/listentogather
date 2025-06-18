import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {QueueItem} from '../queue.service';

@Component({
  selector: 'app-queue',
  templateUrl: './queue.component.html',
  styleUrls: ['./queue.component.css']
})
export class QueueComponent implements OnInit {
  @Input() queue: QueueItem[] = [];
  @Input() currentlyPlayingId?: number | string;
  @Input() isMobile: boolean = false;
  @Input() onAddToQueue?: () => void;
  @Output() removeFromQueue = new EventEmitter<number | string>();
  @Output() playNext = new EventEmitter<QueueItem>();

  actionStates: { [key: string]: string } = {};

  ngOnInit() {
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
}
