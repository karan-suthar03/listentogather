import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'listentogether';
  
  leftWidth = 20;
  centerWidth = 60;
  rightWidth = 20;
  
  private isResizing = false;
  private currentResizer: 'left' | 'right' | null = null;
  private startX = 0;
  private startLeftWidth = 0;
  private startCenterWidth = 0;
  private startRightWidth = 0;

  ngOnInit() {
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  ngOnDestroy() {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  startResize(event: MouseEvent, resizer: 'left' | 'right') {
    this.isResizing = true;
    this.currentResizer = resizer;
    this.startX = event.clientX;
    this.startLeftWidth = this.leftWidth;
    this.startCenterWidth = this.centerWidth;
    this.startRightWidth = this.rightWidth;
    
    event.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.isResizing || !this.currentResizer) return;

    const containerWidth = window.innerWidth;
    const deltaX = event.clientX - this.startX;
    const deltaPercent = (deltaX / containerWidth) * 100;

    if (this.currentResizer === 'left') {
      let newLeftWidth = this.startLeftWidth + deltaPercent;
      let newCenterWidth = this.startCenterWidth - deltaPercent;
      
      newLeftWidth = Math.max(15, Math.min(25, newLeftWidth));
      newCenterWidth = Math.max(30, Math.min(65, newCenterWidth));
      
      const adjustment = (this.startLeftWidth + this.startCenterWidth) - (newLeftWidth + newCenterWidth);
      newCenterWidth += adjustment;
      
      this.leftWidth = newLeftWidth;
      this.centerWidth = newCenterWidth;
      
    } else if (this.currentResizer === 'right') {
      let newCenterWidth = this.startCenterWidth + deltaPercent;
      let newRightWidth = this.startRightWidth - deltaPercent;
      
      newCenterWidth = Math.max(30, Math.min(65, newCenterWidth));
      newRightWidth = Math.max(15, Math.min(25, newRightWidth));
      
      const adjustment = (this.startCenterWidth + this.startRightWidth) - (newCenterWidth + newRightWidth);
      newCenterWidth += adjustment;
      
      this.centerWidth = newCenterWidth;
      this.rightWidth = newRightWidth;
    }
  }

  private onMouseUp() {
    this.isResizing = false;
    this.currentResizer = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  @HostListener('window:resize')
  onWindowResize() {
  }
}
