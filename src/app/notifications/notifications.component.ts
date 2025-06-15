import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {Notification, NotificationService} from '../notification.service';

@Component({
  selector: 'app-notifications',
  template: `
    <div class="notifications-container">
      <div *ngFor="let notification of notifications; trackBy: trackByNotification"
           class="notification"
           [class]="'notification-' + notification.type"
           (click)="dismiss(notification.id)">
        <div class="notification-content">
          <span class="notification-message">{{ notification.message }}</span>
          <small class="notification-time">{{ formatTime(notification.timestamp) }}</small>
        </div>
        <button class="notification-close" (click)="dismiss(notification.id)">×</button>
      </div>
    </div>
  `,
  styles: [`
    .notifications-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1050;
      max-width: 300px;
    }

    .notification {
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      cursor: pointer;
      transition: all 0.3s ease;
      border-left: 4px solid #007bff;
    }

    .notification:hover {
      transform: translateX(-4px);
    }

    .notification-info {
      border-left-color: #17a2b8;
    }

    .notification-success {
      border-left-color: #28a745;
    }

    .notification-warning {
      border-left-color: #ffc107;
    }

    .notification-error {
      border-left-color: #dc3545;
    }

    .notification-content {
      flex: 1;
    }

    .notification-message {
      display: block;
      font-weight: 500;
      margin-bottom: 2px;
    }

    .notification-time {
      opacity: 0.7;
      font-size: 0.75rem;
    }

    .notification-close {
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      margin-left: 12px;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .notification-close:hover {
      opacity: 1;
    }
  `]
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  private subscription?: Subscription;

  constructor(private notificationService: NotificationService) {
  }

  ngOnInit(): void {
    this.subscription = this.notificationService.getNotifications().subscribe(
      notifications => this.notifications = notifications
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  dismiss(id: string): void {
    this.notificationService.dismiss(id);
  }

  formatTime(timestamp: Date): string {
    return timestamp.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  trackByNotification(index: number, notification: Notification): string {
    return notification.id;
  }
}
