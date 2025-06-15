import { Component, OnInit, OnDestroy } from '@angular/core';
import { QueueService, QueueItem } from '../queue.service';
import { RoomStateService } from '../room-state.service';
import { SocketService } from '../socket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-music-queue',
  templateUrl: './music-queue.component.html',
  styleUrls: ['./music-queue.component.css']
})
export class MusicQueueComponent implements OnInit, OnDestroy {
  queue: QueueItem[] = [];
  currentTrackIndex: number = -1;
  roomCode: string = '';
  currentUser: any = null;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private queueService: QueueService,
    private roomStateService: RoomStateService,
    private socketService: SocketService
  ) { }
  ngOnInit(): void {    // Get current room code
    this.roomCode = this.roomStateService.getRoomCode();
    
    // Get current user
    this.subscriptions.push(
      this.roomStateService.getCurrentUser().subscribe(user => {
        this.currentUser = user;
      })
    );
    
    // Subscribe to queue updates
    this.subscriptions.push(
      this.queueService.queue$.subscribe(queueData => {
        this.queue = queueData.queue;
        this.currentTrackIndex = queueData.currentTrackIndex;
      })
    );

    // Load initial queue
    this.loadQueue();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadQueue(): void {
    if (this.roomCode) {
      this.queueService.getQueue(this.roomCode).subscribe({
        next: (queueData) => {
          this.queueService.updateQueue(queueData);
        },
        error: (error) => {
          console.error('Error loading queue:', error);
        }      });
    }
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  removeFromQueue(index: number): void {
    if (this.roomCode) {
      this.queueService.removeFromQueue(this.roomCode, index).subscribe({
        next: (response) => {
          this.loadQueue(); // Refresh queue
        },
        error: (error) => {
          console.error('Error removing from queue:', error);
        }
      });
    }
  }

  moveUp(index: number): void {
    if (index > 0 && this.roomCode) {      
      this.queueService.moveQueueItem(this.roomCode, index, index - 1).subscribe({
        next: (response) => {
          this.loadQueue(); // Refresh queue
        },
        error: (error) => {
          console.error('Error moving item up:', error);
        }
      });
    }
  }

  moveDown(index: number): void {
    if (index < this.queue.length - 1 && this.roomCode) {
      this.queueService.moveQueueItem(this.roomCode, index, index + 1).subscribe({
        next: (response) => {
          this.loadQueue(); // Refresh queue
        },
        error: (error) => {
          console.error('Error moving item down:', error);
        }
      });
    }
  }

  trackByQueueId(index: number, item: QueueItem): string {
    return item.id;
  }

  playTrack(index: number): void {
    if (!this.currentUser || !this.roomCode) return;
    if (this.queue[index]?.downloadStatus !== 'completed') return;
    
    this.socketService.playTrackAtIndex(this.roomCode, this.currentUser.id, index);
  }

  onImageError(event: any): void {
    event.target.src = 'https://via.placeholder.com/50x50/e9ecef/6c757d?text=♪';
  }
}
